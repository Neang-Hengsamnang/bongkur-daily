import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ui/Toast';
import { riel, date as fmtDate } from '../lib/format';
import { getDashboardStats, type DashboardStats } from '../lib/api/stats';

interface KpiCard {
  key: string;
  labelKey: string;
  value: number;
  accent: string;
}

export default function Dashboard() {
  const { profile } = useAuth();
  const { t } = useTranslation();
  const toast = useToast();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await getDashboardStats();
        if (!cancelled) setStats(data);
      } catch (e) {
        if (!cancelled) toast.error((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [toast]);

  const kpis: KpiCard[] = stats
    ? [
        {
          key: 'students',
          labelKey: 'dashboard_kpi_students',
          value: stats.total_students,
          accent: 'from-brand-500 to-brand-700',
        },
        {
          key: 'today',
          labelKey: 'dashboard_kpi_today',
          value: stats.today_collection,
          accent: 'from-emerald-500 to-emerald-700',
        },
        {
          key: 'month',
          labelKey: 'dashboard_kpi_month',
          value: stats.month_collection,
          accent: 'from-amber-500 to-amber-700',
        },
        {
          key: 'all',
          labelKey: 'dashboard_kpi_all_time',
          value: stats.all_time_collection,
          accent: 'from-slate-700 to-slate-900',
        },
      ]
    : [];

  const isOwner = profile?.role === 'owner';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading text-slate-900">
          {t('welcome_back')}, {profile?.full_name}
        </h1>
        <p className="mt-1 text-sm text-slate-500">{t('dashboard_subtitle')}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {loading || !stats
          ? Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-xl bg-slate-100"
              />
            ))
          : kpis.map((k) => (
              <div
                key={k.key}
                className={`overflow-hidden rounded-xl bg-gradient-to-br ${k.accent} p-4 text-white shadow-sm`}
              >
                <div className="text-[11px] font-medium uppercase tracking-wide opacity-90">
                  {t(k.labelKey)}
                </div>
                <div className="mt-2 text-2xl font-semibold tabular-nums">
                  {k.key === 'students' ? k.value : riel(k.value)}
                </div>
              </div>
            ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div>
          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-medium text-slate-800">
                {t('dashboard_quick_actions')}
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-2 p-3">
              <QuickAction to="/payments" label={t('dashboard_qa_new_payment')} emoji="💵" />
              <QuickAction to="/students" label={t('dashboard_qa_students')} emoji="🎓" />
              <QuickAction to="/courses" label={t('dashboard_qa_courses')} emoji="📚" />
              <QuickAction to="/reports" label={t('dashboard_qa_reports')} emoji="📊" />
              {isOwner && (
                <QuickAction
                  to="/settings"
                  label={t('dashboard_qa_settings')}
                  emoji="⚙️"
                  wide
                />
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-medium text-slate-800">
                {t('dashboard_recent_title')}
              </h2>
              <Link
                to="/payments"
                className="text-xs text-brand-700 hover:underline"
              >
                {t('dashboard_view_all')}
              </Link>
            </div>

            {loading ? (
              <div className="p-6 text-center text-sm text-slate-500">
                {t('loading')}
              </div>
            ) : !stats || stats.recent.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">
                {t('dashboard_recent_empty')}
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {stats.recent.map((p) => {
                  const status = p.is_paid
                    ? 'paid'
                    : p.paid_amount > 0
                      ? 'partial'
                      : 'unpaid';
                  return (
                    <li
                      key={p.payment_id}
                      className="flex items-center justify-between gap-3 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-slate-900">
                          {p.student_name ?? '—'}
                          <span className="ml-2 font-mono text-[10px] text-slate-400">
                            {p.student_id}
                          </span>
                        </div>
                        <div className="mt-0.5 text-xs text-slate-500">
                          {fmtDate(p.payment_date)}
                          {p.student_grade ? ` · ${p.student_grade}` : ''}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span
                          className={
                            'rounded-full px-2 py-0.5 text-[10px] ' +
                            (status === 'paid'
                              ? 'bg-emerald-50 text-emerald-700'
                              : status === 'partial'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-red-50 text-red-700')
                          }
                        >
                          {t(`payments_status_${status}`)}
                        </span>
                        <span className="text-sm font-semibold tabular-nums">
                          {riel(p.total_amount)}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickAction({
  to, label, emoji, wide,
}: { to: string; label: string; emoji: string; wide?: boolean }) {
  return (
    <Link
      to={to}
      className={
        'flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 transition hover:border-brand-500 hover:bg-white hover:text-brand-700 ' +
        (wide ? 'col-span-2' : '')
      }
    >
      <span aria-hidden className="text-base">{emoji}</span>
      <span className="truncate">{label}</span>
    </Link>
  );
}