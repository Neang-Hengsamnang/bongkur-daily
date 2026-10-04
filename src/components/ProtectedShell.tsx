import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useEffect } from 'react';
import { useSettings } from '../context/SettingsContext';
import InstallPwaButton from './InstallPwaButton';

const NAV_ITEMS: Array<{ to: string; key: string; ownerOnly?: boolean }> = [
  { to: '/dashboard',  key: 'nav_dashboard' },
  { to: '/payments',   key: 'nav_payments' },
  { to: '/students',   key: 'nav_students' },
  { to: '/courses',    key: 'nav_courses' },
  { to: '/attendance', key: 'nav_attendance' },
  { to: '/reports',    key: 'nav_reports' },
  { to: '/users',      key: 'nav_users', ownerOnly: true },
  { to: '/settings',   key: 'nav_settings', ownerOnly: true },
  { to: '/profile',    key: 'nav_profile' },
];

export default function ProtectedShell() {
  const { session, profile, loading, logout } = useAuth();
  const { settings } = useSettings();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !session) navigate('/login', { replace: true });
  }, [loading, session, navigate]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-slate-500">
        {t('loading')}
      </div>
    );
  }
  if (!session || !profile) return null;

  const toggleLang = () => {
    i18n.changeLanguage(i18n.language === 'km' ? 'en' : 'km');
  };

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 flex-col bg-[#0f172a] text-slate-200 md:flex">
        <div className="flex items-center gap-2 px-5 py-5">
          {settings.logo_url && (
            <img
              src={settings.logo_url}
              alt="logo"
              className="h-8 w-8 rounded object-contain bg-white/10"
            />
          )}
          <div className="text-sm font-heading leading-tight text-white">
            {i18n.language === 'en'
              ? settings.school_name_en
              : settings.school_name_kh}
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-2">
          {NAV_ITEMS.filter((it) => !it.ownerOnly || profile.role === 'owner').map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              className={({ isActive }) =>
                `block rounded-md px-3 py-2 text-sm ${
                  isActive ? 'bg-brand-500 text-white' : 'hover:bg-white/5'
                }`
              }
            >
              {t(it.key)}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4">
          <div className="truncate text-sm font-medium text-slate-700">
            {profile.full_name}{' '}
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
              {t(`role_${profile.role}`)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <InstallPwaButton />
            <button
              onClick={toggleLang}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-xs hover:bg-slate-50"
            >
              {i18n.language === 'km' ? 'EN' : 'ខ្មែរ'}
            </button>
            <button
              onClick={logout}
              className="rounded-md bg-slate-900 px-3 py-1.5 text-xs text-white hover:bg-slate-800"
            >
              {t('action_logout')}
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6">
          <div className="mx-auto max-w-[1400px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}