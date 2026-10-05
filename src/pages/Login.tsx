import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import InstallPwaButton from '../components/InstallPwaButton';

export default function Login() {
  const { login, session, loading } = useAuth();
  const { settings } = useSettings();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate('/dashboard', { replace: true });
  }, [loading, session, navigate]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(username, password, remember);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'LOGIN_FAILED';
      setError(msg);
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } finally {
      setBusy(false);
    }
  };

  const toggleLang = () => i18n.changeLanguage(i18n.language === 'km' ? 'en' : 'km');

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div
        className={`w-full max-w-sm rounded-2xl bg-white p-6 shadow-lg ${
          shake ? 'animate-[shake_0.4s]' : ''
        }`}
        style={{ animationName: shake ? 'shake' : undefined }}
      >
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            {settings.logo_url && (
              <img
                src={settings.logo_url}
                alt="logo"
                className="h-10 w-10 rounded object-contain"
              />
            )}
            <div>
              <h1 className="text-lg font-heading text-slate-900">
                {i18n.language === 'en' ? settings.school_name_en : settings.school_name_kh}
              </h1>
              <p className="text-xs text-slate-500">{t('login_subtitle')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={toggleLang}
            className="rounded-md border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50"
          >
            {i18n.language === 'km' ? 'EN' : 'ខ្មែរ'}
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              {t('login_username')}
            </label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              {t('login_password')}
            </label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full rounded-md border border-slate-300 px-3 py-2 pr-10 text-sm outline-none focus:border-brand-500"
                required
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500"
                tabIndex={-1}
              >
                {showPw ? '🙈' : '👁'}
              </button>
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            {t('login_remember')}
          </label>
          {remember && (
            <p className="mt-1 pl-6 text-[10px] text-slate-400">
              {t('login_remember_hint')}
            </p>
          )}

          {error && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
              {error === 'INVALID_CREDENTIALS'
                ? t('login_failed')
                : error === 'LOCKED'
                  ? t('login_locked')
                  : `${t('login_failed')} (${error})`}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {busy ? t('loading') : t('login_submit')}
          </button>
        </form>
      </div>

      <style>{`@keyframes shake {
        0%,100%{transform:translateX(0)}
        20%{transform:translateX(-6px)}
        40%{transform:translateX(6px)}
        60%{transform:translateX(-4px)}
        80%{transform:translateX(4px)}
      }`}</style>
      <div className="mt-4 text-center">
        <InstallPwaButton />
      </div>
    </div>
  );
}