import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ui/Toast';
import { supabase } from '../lib/supabase';
import { datetime as fmtDateTime } from '../lib/format';
import { updateOwnProfile, changeOwnPassword } from '../lib/api/profile';

export default function Profile() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const toast = useToast();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileErr, setProfileErr] = useState<string | null>(null);

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [savingPw, setSavingPw] = useState(false);
  const [pwErr, setPwErr] = useState<string | null>(null);

  const [lastLogin, setLastLogin] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('full_name, email, last_login')
        .eq('user_id', profile.user_id)
        .maybeSingle();
      if (data) {
        setFullName(data.full_name ?? '');
        setEmail(data.email ?? '');
        setLastLogin(data.last_login ?? null);
      }
    })();
  }, [profile]);

  const initials = (profile?.full_name ?? '')
    .split(/\s+/).filter(Boolean).slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('');

  const saveProfile = async () => {
    setProfileErr(null);
    if (!fullName.trim()) { setProfileErr(t('users_error_name_required')); return; }
    setSavingProfile(true);
    try {
      await updateOwnProfile({ full_name: fullName.trim(), email: email.trim() || null });
      toast.success(t('profile_saved'));
      // Refresh JWT-embedded full_name so the sidebar updates on next login.
      // For an immediate effect, force a token refresh:
      await supabase.auth.refreshSession();
    } catch (e) {
      setProfileErr((e as Error).message);
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async () => {
    setPwErr(null);
    if (newPw.length < 6)     { setPwErr(t('users_error_password_short')); return; }
    if (newPw !== confirmPw)  { setPwErr(t('users_error_password_mismatch')); return; }
    if (currentPw === newPw)  { setPwErr(t('profile_error_same_pw')); return; }

    setSavingPw(true);
    try {
      await changeOwnPassword(currentPw, newPw);
      toast.success(t('profile_pw_changed'));
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } catch (e) {
      const code = (e as Error).message;
      const map: Record<string, string> = {
        WRONG_PASSWORD:  t('profile_error_wrong_pw'),
        INVALID_PASSWORD:t('users_error_password_short'),
        SAME_PASSWORD:   t('profile_error_same_pw'),
      };
      setPwErr(map[code] ?? code);
    } finally {
      setSavingPw(false);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-heading text-slate-900">{t('profile_title')}</h1>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ---- Summary card ---- */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-1">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-2xl font-semibold text-white">
              {initials || '?'}
            </div>
            <div className="mt-3 text-lg font-medium text-slate-900">
              {profile?.full_name ?? '—'}
            </div>
            <div className="mt-1 text-sm text-slate-500">@{profile?.username ?? '—'}</div>
            <span
              className={
                'mt-2 rounded-full px-3 py-0.5 text-xs ' +
                (profile?.role === 'owner'
                  ? 'bg-amber-50 text-amber-800'
                  : 'bg-slate-100 text-slate-600')
              }
            >
              {t(`role_${profile?.role}`)}
            </span>

            <dl className="mt-5 w-full space-y-2 text-left text-xs">
              <div className="flex justify-between">
                <dt className="text-slate-500">{t('profile_user_id')}</dt>
                <dd className="font-mono text-slate-700">{profile?.user_id ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">{t('profile_last_login')}</dt>
                <dd className="text-slate-700">
                  {lastLogin ? fmtDateTime(lastLogin) : '—'}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* ---- Right column ---- */}
        <div className="space-y-4 lg:col-span-2">
          {/* Profile card */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-4 text-sm font-medium text-slate-800">
              {t('profile_update_title')}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  {t('users_field_full_name')}
                </label>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  {t('users_field_email')}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  {t('profile_email_hint')}
                </p>
              </div>
              {profileErr && (
                <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
                  {profileErr}
                </div>
              )}
              <div className="flex justify-end">
                <button
                  onClick={saveProfile}
                  disabled={savingProfile}
                  className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
                >
                  {savingProfile ? t('saving') : t('action_save')}
                </button>
              </div>
            </div>
          </div>

          {/* Password card */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-4 text-sm font-medium text-slate-800">
              {t('profile_change_pw_title')}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  {t('profile_current_pw')}
                </label>
                <input
                  type="password"
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  autoComplete="current-password"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    {t('users_field_new_password')}
                  </label>
                  <input
                    type="password"
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    autoComplete="new-password"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    {t('users_field_confirm_password')}
                  </label>
                  <input
                    type="password"
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                    autoComplete="new-password"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              {pwErr && (
                <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
                  {pwErr}
                </div>
              )}
              <div className="flex justify-end">
                <button
                  onClick={savePassword}
                  disabled={savingPw}
                  className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
                >
                  {savingPw ? t('saving') : t('profile_change_pw_button')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}