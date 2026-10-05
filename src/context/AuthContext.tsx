import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, setRemember } from '../lib/supabase';

export type Role = 'owner' | 'staff';

export interface Profile {
  user_id: string;
  username: string;
  role: Role;
  full_name: string;
}

interface AuthCtx {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  login: (username: string, password: string, remember: boolean) => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

function decodeJwt(token: string): Record<string, unknown> {
  try {
    const payload = token.split('.')[1];
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const json = new TextDecoder('utf-8').decode(bytes);
    return JSON.parse(json);
  } catch {
    return {};
  }
}

function profileFromSession(session: Session | null): Profile | null {
  if (!session) return null;
  const claims = decodeJwt(session.access_token);
  if (!claims.user_id) return null;
  return {
    user_id: String(claims.user_id),
    username: String(claims.username ?? ''),
    role: (claims.app_role as Role) ?? 'staff',
    full_name: String(claims.full_name ?? ''),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const login = useCallback(async (username: string, password: string, remember: boolean) => {
    setRemember(remember);
    const { data, error } = await supabase.functions.invoke('auth-login', {
      body: { username: username.trim().toLowerCase(), password },
    });
    if (error) throw new Error(error.message || 'LOGIN_FAILED');
    if (!data?.session) throw new Error(data?.error || 'INVALID_CREDENTIALS');

    const { error: setErr } = await supabase.auth.setSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
    if (setErr) throw new Error(setErr.message);
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const profile = useMemo(() => profileFromSession(session), [session]);

  const value = useMemo(
    () => ({ session, profile, loading, login, logout }),
    [session, profile, loading, login, logout],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}