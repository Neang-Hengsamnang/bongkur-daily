import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL    = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY        = Deno.env.get('SUPABASE_ANON_KEY')!;
const MAX_ATTEMPTS    = 5;
const LOCKOUT_MINUTES = 15;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { username, password } = await req.json().catch(() => ({}));
    if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
      return json({ error: 'MISSING_FIELDS' }, 400);
    }
    const uname = username.trim().toLowerCase();

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 1. Lockout check
    const { data: lock } = await admin
      .from('login_lockout')
      .select('failed_count, locked_until')
      .eq('username', uname)
      .maybeSingle();

    if (lock?.locked_until && new Date(lock.locked_until).getTime() > Date.now()) {
      const secs = Math.ceil((new Date(lock.locked_until).getTime() - Date.now()) / 1000);
      return json({ error: 'LOCKED', retry_after: secs }, 429);
    }

    // 2. Find profile
    const { data: profile } = await admin
      .from('profiles')
      .select('user_id, auth_user_id, is_active, username')
      .eq('username', uname)
      .maybeSingle();

    // 3. Find the auth user's email
    let email: string | null = null;
    if (profile?.auth_user_id) {
      const { data: userData } = await admin.auth.admin.getUserById(profile.auth_user_id);
      email = userData?.user?.email ?? null;
    }

    const recordFailure = async (): Promise<void> => {
      const next = (lock?.failed_count ?? 0) + 1;
      const lockedUntil =
        next >= MAX_ATTEMPTS
          ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000).toISOString()
          : null;

      await admin.from('login_lockout').upsert({
        username: uname,
        failed_count: next,
        locked_until: lockedUntil,
        last_attempt: new Date().toISOString(),
      });

      await admin.from('login_log').insert({
        user_id: profile?.user_id ?? null,
        success: false,
      });
    };

    if (!profile || !profile.is_active || !email) {
      await recordFailure();
      return json({ error: 'INVALID_CREDENTIALS' }, 401);
    }

    // 4. Attempt password sign-in with an anon client (uses bcrypt in auth.users)
    const anon = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: signIn, error: signErr } = await anon.auth.signInWithPassword({
      email,
      password,
    });

    if (signErr || !signIn.session) {
      await recordFailure();
      return json({ error: 'INVALID_CREDENTIALS' }, 401);
    }

    // 5. Success — clear lockout, stamp last_login, log success
    await admin.from('login_lockout').delete().eq('username', uname);
    await admin
      .from('profiles')
      .update({ last_login: new Date().toISOString() })
      .eq('user_id', profile.user_id);
    await admin.from('login_log').insert({
      user_id: profile.user_id,
      success: true,
    });

    return json({
      session: {
        access_token: signIn.session.access_token,
        refresh_token: signIn.session.refresh_token,
      },
    });
  } catch (err) {
    return json({ error: 'SERVER_ERROR', message: String(err) }, 500);
  }
});