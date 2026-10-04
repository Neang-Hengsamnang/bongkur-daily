import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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

interface InputUser {
  user_id?: string;
  username: string;
  full_name: string;
  email?: string | null;
  role: 'owner' | 'staff';
  is_active?: boolean;
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
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = await req.json().catch(() => ({}));
    const defaultPassword = String(body.default_password ?? '');
    const users = Array.isArray(body.users) ? (body.users as InputUser[]) : [];

    if (defaultPassword.length < 6) {
      return json({ error: 'INVALID_DEFAULT_PASSWORD' }, 400);
    }
    if (users.length === 0) {
      return json({ created: 0, skipped: 0, errors: [] });
    }

    let created = 0;
    let skipped = 0;
    const errors: Array<{ username: string; reason: string }> = [];

    for (const u of users) {
      try {
        if (typeof u.username !== 'string' || !/^[a-z0-9_]{3,30}$/.test(u.username)) {
          errors.push({ username: String(u.username ?? ''), reason: 'INVALID_USERNAME' });
          continue;
        }

        // Skip if username already exists
        const { data: existing } = await admin
          .from('profiles')
          .select('user_id')
          .eq('username', u.username)
          .maybeSingle();
        if (existing) {
          skipped++;
          continue;
        }

        const loginEmail =
          typeof u.email === 'string' && u.email.includes('@')
            ? u.email.trim()
            : `${u.username}@sdps.local`;

        const { data: authData, error: authErr } = await admin.auth.admin.createUser({
          email: loginEmail,
          password: defaultPassword,
          email_confirm: true,
        });
        if (authErr || !authData.user) {
          errors.push({
            username: u.username,
            reason: authErr?.message ?? 'AUTH_CREATE_FAILED',
          });
          continue;
        }

        // Preserve the original USR-xxxx ID when provided
        const profileInsert: Record<string, unknown> = {
          auth_user_id: authData.user.id,
          username: u.username,
          role: u.role === 'owner' ? 'owner' : 'staff',
          full_name: (u.full_name ?? '').trim() || u.username,
          email: loginEmail,
          is_active: u.is_active !== false,
          created_by: callerId,
        };
        if (typeof u.user_id === 'string' && /^USR-\d{4}$/.test(u.user_id)) {
          profileInsert.user_id = u.user_id;
        }

        const { error: profErr } = await admin.from('profiles').insert(profileInsert);
        if (profErr) {
          await admin.auth.admin.deleteUser(authData.user.id).catch(() => {});
          errors.push({ username: u.username, reason: profErr.message });
          continue;
        }

        created++;
      } catch (e) {
        errors.push({ username: String(u.username ?? ''), reason: String(e) });
      }
    }

    return json({ created, skipped, errors });
  } catch (err) {
    return json({ error: 'SERVER_ERROR', message: String(err) }, 500);
  }
});