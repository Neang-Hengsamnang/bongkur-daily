import { supabase } from '../supabase';

export async function updateOwnProfile(input: {
  full_name: string;
  email: string | null;
}): Promise<void> {
  const { error } = await supabase.rpc('update_own_profile', {
    p_full_name: input.full_name,
    p_email:     input.email ?? '',
  } as never);
  if (error) throw new Error(error.message);
}

export async function changeOwnPassword(
  current_password: string,
  new_password: string,
): Promise<void> {
  const { data, error } = await supabase.functions.invoke('profile-password', {
    body: { current_password, new_password },
  });
  if (error) {
    let msg = error.message;
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === 'function') {
        const parsed = await ctx.json();
        if (parsed?.error) msg = parsed.error;
      }
    } catch { /* ignore */ }
    throw new Error(msg);
  }
  if (data && typeof data === 'object' && 'error' in data) {
    throw new Error(String((data as { error: unknown }).error));
  }
}