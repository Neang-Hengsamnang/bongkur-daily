import { supabase } from '../supabase';

export type PortalInactiveMode = 'show_banner' | 'not_found' | 'hide_balance';
export type Language = 'km' | 'en';

export interface Settings {
  school_name_kh: string;
  school_name_en: string;
  logo_url: string;
  contact_phone: string;
  contact_email: string;
  address: string;
  default_language: Language;
  portal_inactive_mode: PortalInactiveMode;
}

export const DEFAULT_SETTINGS: Settings = {
  school_name_kh: 'ប្រព័ន្ធគ្រប់គ្រងការបង់ប្រាក់ប្រចាំថ្ងៃ',
  school_name_en: 'Student Daily Payment',
  logo_url: '',
  contact_phone: '',
  contact_email: '',
  address: '',
  default_language: 'km',
  portal_inactive_mode: 'show_banner',
};

export async function loadSettings(): Promise<Settings> {
  const { data, error } = await supabase.from('settings').select('key, value');
  if (error) throw error;
  const m: Record<string, string> = {};
  for (const r of (data ?? []) as { key: string; value: string }[]) m[r.key] = r.value;
  return {
    school_name_kh:       m.school_name_kh       ?? DEFAULT_SETTINGS.school_name_kh,
    school_name_en:       m.school_name_en       ?? DEFAULT_SETTINGS.school_name_en,
    logo_url:             m.logo_url             ?? '',
    contact_phone:        m.contact_phone        ?? '',
    contact_email:        m.contact_email        ?? '',
    address:              m.address              ?? '',
    default_language:     (m.default_language as Language) ?? 'km',
    portal_inactive_mode: (m.portal_inactive_mode as PortalInactiveMode) ?? 'show_banner',
  };
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  const { error } = await supabase.rpc('update_settings', { patch } as never);
  if (error) throw new Error(error.message);
}

export async function uploadLogo(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
  const path = `logo/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from('public-assets')
    .upload(path, file, { upsert: true, cacheControl: '3600' });
  if (upErr) throw upErr;
  const { data } = supabase.storage.from('public-assets').getPublicUrl(path);
  return data.publicUrl;
}