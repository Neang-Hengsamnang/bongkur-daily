import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
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
  { to: '/import',     key: 'nav_import', ownerOnly: true },
  { to: '/profile',    key: 'nav_profile' },
];

export default function ProtectedShell() {
  const { session, profile, loading, logout } = useAuth();
  const { t, i18n } = useTranslation();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const location = useLocation();

  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!loading && !session) navigate('/login', { replace: true });
  }, [loading, session, navigate]);

  // Close the drawer on every route change
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  // Lock body scroll while the drawer is open
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

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

  const schoolName = i18n.language === 'en'
    ? (settings.school_name_en || settings.school_name_kh)
    : (settings.school_name_kh || settings.school_name_en);

  return (
    <div className="flex min-h-screen">
      {/* Mobile backdrop */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar — fixed drawer on mobile, static column on md+ */}
      <aside
        className={
          'fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col bg-[#0f172a] text-slate-200 transition-transform duration-200 ' +
          'md:static md:translate-x-0 ' +
          (drawerOpen ? 'translate-x-0' : '-translate-x-full')
        }
      >
        {/* Brand + close button */}
        <div className="flex items-start justify-between gap-2 px-5 py-5">
          <div className="flex min-w-0 items-center gap-2">
            {settings.logo_url && (
              <img
                src={settings.logo_url}
                alt="logo"
                className="h-8 w-8 shrink-0 rounded object-contain bg-white/10"
              />
            )}
            <div className="truncate text-sm font-heading leading-tight text-white">
              {schoolName}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-white/10 hover:text-white md:hidden"
            aria-label={t('action_close')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="6" y1="18" x2="18" y2="6" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-2 pb-6">
          {NAV_ITEMS.filter((it) => !it.ownerOnly || profile.role === 'owner').map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              className={({ isActive }) =>
                'block rounded-md px-3 py-2 text-sm ' +
                (isActive ? 'bg-brand-500 text-white' : 'hover:bg-white/5')
              }
            >
              {t(it.key)}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 md:px-4">
          <div className="flex min-w-0 items-center gap-2">
            {/* Hamburger — mobile only */}
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 md:hidden"
              aria-label={t('action_menu')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="6"  x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>

            <div className="truncate text-sm font-medium text-slate-700">
              {profile.full_name}{' '}
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                {t(`role_${profile.role}`)}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
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

        <main className="flex-1 p-3 md:p-6">
          <div className="mx-auto max-w-[1400px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}