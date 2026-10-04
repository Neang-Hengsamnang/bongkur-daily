import { createClient } from '@supabase/supabase-js';

const REMEMBER_KEY = 'sdps_remember';

/**
 * Storage adapter that routes Supabase session data to
 * localStorage (remember = ON) or sessionStorage (remember = OFF).
 * The flag is set by the login page BEFORE setSession is called.
 */
const hybridStorage = {
  getItem(key: string): string | null {
    return sessionStorage.getItem(key) ?? localStorage.getItem(key);
  },
  setItem(key: string, value: string): void {
    if (localStorage.getItem(REMEMBER_KEY) === '1') {
      localStorage.setItem(key, value);
      sessionStorage.removeItem(key);
    } else {
      sessionStorage.setItem(key, value);
      localStorage.removeItem(key);
    }
  },
  removeItem(key: string): void {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  },
};

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      storage: hybridStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  },
);

export function setRemember(remember: boolean) {
  localStorage.setItem(REMEMBER_KEY, remember ? '1' : '0');
}

export function getRemember(): boolean {
  return localStorage.getItem(REMEMBER_KEY) === '1';
}