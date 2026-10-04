import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY     = Deno.env.get('SUPABASE_ANON_KEY')!;

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
    const authUserId = String(claims.sub ?? '');
    if (!authUserId) return json({ error: 'UNAUTHENTICATED' }, 401);

    const body = await req.json().catch(() => ({}));
    const currentPassword = String(body.current_password ?? '');
    const newPassword     = String(body.new_password ?? '');

    if (currentPassword.length === 0)
      return json({ error: 'MISSING_CURRENT' }, 400);
    if (newPassword.length < 6)
      return json({ error: 'INVALID_PASSWORD' }, 400);
    if (currentPassword === newPassword)
      return json({ error: 'SAME_PASSWORD' }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: getErr } = await admin.auth.admin.getUserById(authUserId);
    if (getErr || !userData.user?.email)
      return json({ error: 'NOT_FOUND' }, 404);

    const email = userData.user.email;

    // Verify current password by attempting a sign-in with an anon client
    const anon = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: signErr } = await anon.auth.signInWithPassword({
      email,
      password: currentPassword,
    });
    if (signErr) return json({ error: 'WRONG_PASSWORD' }, 401);

    const { error: updErr } = await admin.auth.admin.updateUserById(authUserId, {
      password: newPassword,
    });
    if (updErr) return json({ error: 'AUTH_ERROR', message: updErr.message }, 400);

    return json({ ok: true });
  } catch (err) {
    return json({ error: 'SERVER_ERROR', message: String(err) }, 500);
  }
});