import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function decodeJwt(token: string): Record<string, unknown> {
  try {
    const p = token.split('.')[1];
    return JSON.parse(atob(p.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return {};
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'UNAUTHENTICATED' }, 401);

    const claims = decodeJwt(token);
    if (claims.app_role !== 'owner') return json({ error: 'FORBIDDEN' }, 403);

    const callerId = String(claims.user_id ?? '');
    if (!callerId) return json({ error: 'UNAUTHENTICATED' }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? '');

    // Snapshot active owners for last-owner protection
    const { data: owners } = await admin
      .from('profiles')
      .select('user_id')
      .eq('role', 'owner')
      .eq('is_active', true);
    const activeOwnerIds = new Set((owners ?? []).map((o) => o.user_id as string));

    switch (action) {
      // ------------------------------------------------------------- CREATE
      case 'create': {
        const { username, password, full_name, email, role } = body;
        if (typeof username !== 'string' || !/^[a-z0-9_]{3,30}$/.test(username))
          return json({ error: 'INVALID_USERNAME' }, 400);
        if (typeof password !== 'string' || password.length < 6)
          return json({ error: 'INVALID_PASSWORD' }, 400);
        if (typeof full_name !== 'string' || !full_name.trim())
          return json({ error: 'INVALID_NAME' }, 400);
        if (role !== 'owner' && role !== 'staff')
          return json({ error: 'INVALID_ROLE' }, 400);

        const { data: existing } = await admin
          .from('profiles')
          .select('user_id')
          .eq('username', username)
          .maybeSingle();
        if (existing) return json({ error: 'USERNAME_TAKEN' }, 409);

        const loginEmail =
          typeof email === 'string' && email.trim()
            ? email.trim()
            : `${username}@sdps.local`;

        const { data: authData, error: authErr } = await admin.auth.admin.createUser({
          email: loginEmail,
          password,
          email_confirm: true,
        });
        if (authErr || !authData.user) {
          const dup = authErr?.message?.toLowerCase().includes('already');
          return json(
            { error: dup ? 'EMAIL_TAKEN' : 'AUTH_ERROR', message: authErr?.message },
            400,
          );
        }

        const { data: profileRow, error: profErr } = await admin
          .from('profiles')
          .insert({
            auth_user_id: authData.user.id,
            username,
            role,
            full_name: full_name.trim(),
            email: loginEmail,
            created_by: callerId,
          })
          .select('*')
          .single();

        if (profErr) {
          await admin.auth.admin.deleteUser(authData.user.id).catch(() => {});
          return json({ error: 'PROFILE_ERROR', message: profErr.message }, 400);
        }

        return json({ profile: profileRow });
      }

      // ------------------------------------------------------------- UPDATE
      case 'update': {
        const { user_id, full_name, email, role } = body;
        if (typeof user_id !== 'string' || !user_id)
          return json({ error: 'INVALID_ID' }, 400);

        const patch: Record<string, unknown> = {};
        if (typeof full_name === 'string' && full_name.trim()) patch.full_name = full_name.trim();
        if (typeof email === 'string') patch.email = email.trim() || null;
        if (role === 'owner' || role === 'staff') patch.role = role;

        if (patch.role === 'staff' && activeOwnerIds.has(user_id) && activeOwnerIds.size === 1)
          return json({ error: 'LAST_OWNER' }, 400);

        const { data: updated, error: updErr } = await admin
          .from('profiles')
          .update(patch)
          .eq('user_id', user_id)
          .select('*')
          .single();
        if (updErr) return json({ error: 'UPDATE_ERROR', message: updErr.message }, 400);

        return json({ profile: updated });
      }

      // ------------------------------------------------------- RESET_PASSWORD
      case 'reset_password': {
        const { user_id, new_password } = body;
        if (typeof user_id !== 'string' || !user_id)
          return json({ error: 'INVALID_ID' }, 400);
        if (typeof new_password !== 'string' || new_password.length < 6)
          return json({ error: 'INVALID_PASSWORD' }, 400);

        const { data: profile } = await admin
          .from('profiles')
          .select('auth_user_id')
          .eq('user_id', user_id)
          .maybeSingle();
        if (!profile?.auth_user_id) return json({ error: 'NOT_FOUND' }, 404);

        const { error: pwErr } = await admin.auth.admin.updateUserById(
          profile.auth_user_id,
          { password: new_password },
        );
        if (pwErr) return json({ error: 'AUTH_ERROR', message: pwErr.message }, 400);

        return json({ ok: true });
      }

      // --------------------------------------------------------- SET_ACTIVE
      case 'set_active': {
        const { user_id, is_active } = body;
        if (typeof user_id !== 'string' || !user_id)
          return json({ error: 'INVALID_ID' }, 400);
        if (typeof is_active !== 'boolean')
          return json({ error: 'INVALID_BOOL' }, 400);

        if (user_id === callerId && !is_active)
          return json({ error: 'SELF_DEACTIVATE' }, 400);

        if (!is_active && activeOwnerIds.has(user_id) && activeOwnerIds.size === 1)
          return json({ error: 'LAST_OWNER' }, 400);

        const { data: profile } = await admin
          .from('profiles')
          .select('auth_user_id')
          .eq('user_id', user_id)
          .maybeSingle();
        if (!profile?.auth_user_id) return json({ error: 'NOT_FOUND' }, 404);

        // Ban / unban the auth user so existing sessions can't re-issue tokens
        const { error: banErr } = await admin.auth.admin.updateUserById(
          profile.auth_user_id,
          { ban_duration: is_active ? 'none' : '876000h' },
        );
        if (banErr) return json({ error: 'AUTH_ERROR', message: banErr.message }, 400);

        const { error: updErr } = await admin
          .from('profiles')
          .update({ is_active })
          .eq('user_id', user_id);
        if (updErr) return json({ error: 'UPDATE_ERROR', message: updErr.message }, 400);

        return json({ ok: true });
      }

      default:
        return json({ error: 'UNKNOWN_ACTION' }, 400);
    }
  } catch (err) {
    return json({ error: 'SERVER_ERROR', message: String(err) }, 500);
  }
});