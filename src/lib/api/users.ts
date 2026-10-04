import { supabase } from '../supabase';

export type Role = 'owner' | 'staff';

export interface UserProfile {
  user_id: string;
  auth_user_id: string | null;
  username: string;
  role: Role;
  full_name: string;
  email: string | null;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
  updated_at: string;
}

export async function listUsers(
  opts: { search?: string; status?: 'all' | 'active' | 'inactive' } = {},
): Promise<UserProfile[]> {
  let q = supabase.from('profiles').select('*').order('created_at', { ascending: false });
  if (opts.status === 'active')   q = q.eq('is_active', true);
  if (opts.status === 'inactive') q = q.eq('is_active', false);
  const s = opts.search?.trim();
  if (s) q = q.or(`username.ilike.%${s}%,full_name.ilike.%${s}%,user_id.ilike.%${s}%`);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as UserProfile[];
}

async function adminCall(body: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await supabase.functions.invoke('admin-users', { body });
  if (error) {
    let msg = error.message;
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === 'function') {
        const parsed = await ctx.json();
        if (parsed?.error) msg = parsed.error;
      }
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  if (data && typeof data === 'object' && 'error' in data) {
    throw new Error(String((data as { error: unknown }).error));
  }
  return data;
}

export async function createUser(input: {
  username: string;
  password: string;
  full_name: string;
  email?: string | null;
  role: Role;
}): Promise<void> {
  await adminCall({ action: 'create', ...input });
}

export async function updateUser(input: {
  user_id: string;
  full_name?: string;
  email?: string | null;
  role?: Role;
}): Promise<void> {
  await adminCall({ action: 'update', ...input });
}

export async function resetUserPassword(user_id: string, new_password: string): Promise<void> {
  await adminCall({ action: 'reset_password', user_id, new_password });
}

export async function setUserActive(user_id: string, is_active: boolean): Promise<void> {
  await adminCall({ action: 'set_active', user_id, is_active });
}