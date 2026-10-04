import { useEffect, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { riel, date as fmtDate } from '../lib/format';

interface PortalPaymentItem {
  course_name: string;
  hours: number;
  hourly_fee: number;
  subtotal: number;
}

interface PortalPayment {
  payment_date: string;
  total_amount: number;
  paid_amount: number;
  remaining: number;
  is_paid: boolean;
  items: PortalPaymentItem[];
}

interface PortalStudent {
  student_id: string;
  name_kh: string;
  gender: 'male' | 'female' | 'other' | null;
  grade: string | null;
  course_name: string | null;
  status: 'active' | 'inactive' | 'graduated' | 'dropped';
}

interface PortalSettings {
  school_name_kh?: string;
  school_name_en?: string;
  logo_url?: string;
  contact_phone?: string;
  contact_email?: string;
  address?: string;
  default_language?: 'km' | 'en';
}

interface PortalData {
  settings: PortalSettings;
  student: PortalStudent;
  payments: PortalPayment[];
  month?: { billed: number; paid: number; outstanding: number };
}

type State =
  | { kind: 'loading' }
  | { kind: 'not_found' }
  | { kind: 'rate_limited' }
  | { kind: 'error'; message: string }
  | { kind: 'ok'; data: PortalData };

const PAGE_SIZE = 10;

export default function StudentPortal() {
  const [params] = useSearchParams();
  const token = params.get('t') ?? '';
  const { t, i18n } = useTranslation();

  const [state, setState] = useState<State>({ kind: 'loading' });
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) { setState({ kind: 'not_found' }); return; }
      const { data, error } = await supabase.rpc('portal_data', { p_token: token } as never);
      if (cancelled) return;
      if (error) { setState({ kind: 'error', message: error.message }); return; }
      const d = data as { error?: string } & PortalData;
      if (d?.error === 'NOT_FOUND')     { setState({ kind: 'not_found' }); return; }
      if (d?.error === 'RATE_LIMITED')  { setState({ kind: 'rate_limited' }); return; }
      setState({ kind: 'ok', data: d });

      const stored = localStorage.getItem('sdps_lang');
      if (!stored && d.settings?.default_language && d.settings.default_language !== i18n.language) {
        i18n.changeLanguage(d.settings.default_language);
      }
    })();
    return () => { cancelled = true; };
  }, [token, i18n]);

  const toggleLang = () => i18n.changeLanguage(i18n.language === 'km' ? 'en' : 'km');

  if (state.kind === 'loading') {
    return <Shell><div className="p-10 text-center text-sm text-slate-500">{t('loading')}</div></Shell>;
  }
  if (state.kind === 'rate_limited') {
    return <Shell><div className="p-10 text-center text-sm text-slate-500">{t('portal_rate_limited')}</div></Shell>;
  }
  if (state.kind === 'not_found') {
    return (
      <Shell>
        <div className="p-10 text-center">
          <div className="text-4xl">🔍</div>
          <div className="mt-3 text-sm text-slate-600">{t('portal_not_found')}</div>
        </div>
      </Shell>
    );
  }
  if (state.kind === 'error') {
    return <Shell><div className="p-10 text-center text-sm text-rose-700">{state.message}</div></Shell>;
  }

  const { student, settings, payments } = state.data;
  const schoolName = i18n.language === 'en'
    ? (settings.school_name_en || settings.school_name_kh || '')
    : (settings.school_name_kh || settings.school_name_en || '');

  const initials = student.name_kh.trim().slice(0, 1) || '?';
  const avatarGradient =
    student.gender === 'male'   ? 'from-blue-500 to-blue-700'
    : student.gender === 'female' ? 'from-pink-500 to-pink-700'
    : 'from-slate-400 to-slate-600';

  const inactive = student.status !== 'active';
  const shown = payments.slice(0, visible);

  return (
    <Shell>
      {/* Header */}
      <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          {settings.logo_url && (
            <img src={settings.logo_url} alt="logo" className="h-8 w-8 rounded object-contain" />
          )}
          <span className="truncate text-sm font-medium text-slate-800">{schoolName}</span>
        </div>
        <button
          type="button"
          onClick={toggleLang}
          className="shrink-0 rounded-md border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50"
        >
          {i18n.language === 'km' ? 'EN' : 'ខ្មែរ'}
        </button>
      </header>

      {/* Inactive banner */}
      {inactive && (
        <div className="mx-4 mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          {t(`portal_inactive_banner_${student.status}`)}
        </div>
      )}

      {/* Profile */}
      <section className="px-4 pt-4">
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${avatarGradient} text-xl font-semibold text-white`}
            >
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-base font-semibold text-slate-900">{student.name_kh}</div>
              <div className="mt-0.5 font-mono text-[11px] text-slate-500">{student.student_id}</div>
              <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-slate-500">
                {student.grade && <span>{student.grade}</span>}
                {student.grade && student.course_name && <span>·</span>}
                {student.course_name && <span>{student.course_name}</span>}
              </div>
            </div>
            <span
              className={
                'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ' +
                (student.status === 'active'
                  ? 'bg-emerald-50 text-emerald-700'
                  : student.status === 'graduated'
                    ? 'bg-blue-50 text-blue-700'
                    : student.status === 'dropped'
                      ? 'bg-rose-50 text-rose-700'
                      : 'bg-slate-100 text-slate-600')
              }
            >
              {t(`student_status_${student.status}`)}
            </span>
          </div>
        </div>
      </section>

      {/* Month KPIs */}
      {state.data.month && (
        <section className="px-4 pt-4">
          <h2 className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-slate-500">
            {t('portal_this_month')}
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 p-3 text-white shadow-sm">
              <div className="text-[10px] uppercase opacity-90">{t('portal_paid')}</div>
              <div className="mt-1 text-lg font-semibold tabular-nums">
                {riel(state.data.month.paid)}
              </div>
            </div>
            <div className="rounded-xl bg-gradient-to-br from-rose-500 to-rose-700 p-3 text-white shadow-sm">
              <div className="text-[10px] uppercase opacity-90">{t('portal_outstanding')}</div>
              <div className="mt-1 text-lg font-semibold tabular-nums">
                {riel(state.data.month.outstanding)}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* History */}
      <section className="px-4 pt-4">
        <h2 className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-slate-500">
          {t('portal_history')}
        </h2>
        {payments.length === 0 ? (
          <div className="rounded-xl bg-white p-6 text-center text-sm text-slate-500 shadow-sm">
            {t('portal_no_payments')}
          </div>
        ) : (
          <ul className="space-y-2">
            {shown.map((p, idx) => {
              const isOpen = expanded.has(idx);
              const status = p.is_paid ? 'paid' : p.paid_amount > 0 ? 'partial' : 'unpaid';
              const summary = p.items.map((it) => it.course_name).join(', ');
              return (
                <li key={idx} className="overflow-hidden rounded-xl bg-white shadow-sm">
                  <button
                    type="button"
                    onClick={() =>
                      setExpanded((prev) => {
                        const next = new Set(prev);
                        if (next.has(idx)) next.delete(idx); else next.add(idx);
                        return next;
                      })
                    }
                    className="w-full px-4 py-3 text-left"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-slate-900">
                          {fmtDate(p.payment_date)}
                        </div>
                        <div className="mt-0.5 truncate text-xs text-slate-500">
                          {summary || '—'}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-sm font-semibold tabular-nums">
                          {riel(p.total_amount)}
                        </div>
                        <span
                          className={
                            'mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] ' +
                            (status === 'paid'
                              ? 'bg-emerald-100 text-emerald-800'
                              : status === 'partial'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800')
                          }
                        >
                          {t(`payments_status_${status}`)}
                        </span>
                      </div>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t border-slate-100 bg-slate-50 px-4 py-2">
                      {p.items.map((it, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between py-1 text-xs text-slate-600"
                        >
                          <span>
                            {it.course_name} · {it.hours}h × {riel(it.hourly_fee)}
                          </span>
                          <span className="tabular-nums">{riel(it.subtotal)}</span>
                        </div>
                      ))}
                      <div className="mt-1 space-y-0.5 border-t border-slate-200 pt-1 text-xs text-slate-500">
                        <div className="flex justify-between">
                          <span>{t('portal_paid')}</span>
                          <span className="tabular-nums">{riel(p.paid_amount)}</span>
                        </div>
                        {p.remaining > 0 && (
                          <div className="flex justify-between text-rose-700">
                            <span>{t('portal_remaining')}</span>
                            <span className="tabular-nums">{riel(p.remaining)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {visible < payments.length && (
          <div className="mt-3 text-center">
            <button
              type="button"
              onClick={() => setVisible((v) => v + PAGE_SIZE)}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs text-slate-700 hover:bg-slate-50"
            >
              {t('portal_show_more', { count: Math.min(PAGE_SIZE, payments.length - visible) })}
            </button>
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="mt-6 border-t border-slate-200 bg-white px-4 py-4 text-center text-[11px] text-slate-500">
        <p>{t('portal_footer_note')}</p>
        {(settings.contact_phone || settings.contact_email || settings.address) && (
          <p className="mt-2">
            {settings.contact_phone && <span>{settings.contact_phone}</span>}
            {settings.contact_phone && settings.contact_email && <span> · </span>}
            {settings.contact_email && <span>{settings.contact_email}</span>}
            {settings.address && <span> · {settings.address}</span>}
          </p>
        )}
      </footer>
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-[520px] pb-6">{children}</div>
    </div>
  );
}