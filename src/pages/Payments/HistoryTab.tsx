import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../components/ui/Toast';
import { riel, date as fmtDate } from '../../lib/format';
import {
  listPaymentsHistory, type PaymentListItem,
} from '../../lib/api/payments';
import PaymentDetailModal from '../../components/PaymentDetailModal';
import RecordPaymentModal from '../../components/RecordPaymentModal';

const PAGE_SIZE = 15;
type StatusFilter = 'all' | 'paid' | 'partial' | 'unpaid';

interface Props {
  mode: 'history' | 'outstanding';
}

export default function HistoryTab({ mode }: Props) {
  const { t } = useTranslation();
  const toast = useToast();

  const [rows, setRows] = useState<PaymentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

  const [detailPayment, setDetailPayment] = useState<PaymentListItem | null>(null);
  const [recordTarget, setRecordTarget] = useState<PaymentListItem | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await listPaymentsHistory(
          mode === 'outstanding'
            ? { status: 'all' }
            : { status: statusFilter },
        );
        const filtered = mode === 'outstanding'
          ? data.filter((p) => !p.is_paid)
          : data;
        if (!cancelled) {
          setRows(filtered);
          setPage(1);
        }
      } catch (e) {
        if (!cancelled) toast.error((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [mode, statusFilter, reloadKey, toast]);

  const reload = () => setReloadKey((k) => k + 1);

  const searched = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((p) => {
      const name = (p.students?.name_kh ?? '').toLowerCase();
      return (
        name.includes(s) ||
        p.student_id.toLowerCase().includes(s) ||
        p.payment_id.toLowerCase().includes(s)
      );
    });
  }, [rows, search]);

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return searched.slice(start, start + PAGE_SIZE);
  }, [searched, page]);

  const totalPages = Math.max(1, Math.ceil(searched.length / PAGE_SIZE));

  const statusOf = (p: PaymentListItem) =>
    p.is_paid ? 'paid' : p.paid_amount > 0 ? 'partial' : 'unpaid';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder={t('payments_search_placeholder')}
          className="w-full max-w-xs rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        {mode === 'history' && (
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as StatusFilter);
              setPage(1);
            }}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="all">{t('payments_status_all')}</option>
            <option value="paid">{t('payments_status_paid')}</option>
            <option value="partial">{t('payments_status_partial')}</option>
            <option value="unpaid">{t('payments_status_unpaid')}</option>
          </select>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">{t('payments_col_id')}</th>
              <th className="px-3 py-2">{t('payments_col_date')}</th>
              <th className="px-3 py-2">{t('payments_col_student')}</th>
              <th className="px-3 py-2 text-right">{t('payments_col_total')}</th>
              <th className="px-3 py-2 text-right">{t('payments_col_paid')}</th>
              <th className="px-3 py-2 text-right">{t('payments_col_remaining')}</th>
              <th className="px-3 py-2">{t('payments_col_status')}</th>
              <th className="px-3 py-2 text-right">{t('payments_col_actions')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                  {t('loading')}
                </td>
              </tr>
            ) : paged.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                  {t('payments_table_empty')}
                </td>
              </tr>
            ) : paged.map((p) => {
              const remaining = Math.max(0, p.total_amount - p.paid_amount);
              const status = statusOf(p);
              return (
                <tr key={p.payment_id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-mono text-xs text-slate-500">
                    {p.payment_id}
                  </td>
                  <td className="px-3 py-2">{fmtDate(p.payment_date)}</td>
                  <td className="px-3 py-2">
                    {p.students?.name_kh ?? '—'}
                    <span className="ml-1 font-mono text-[10px] text-slate-400">
                      {p.student_id}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {riel(p.total_amount)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {riel(p.paid_amount)}
                  </td>
                  <td
                    className={
                      'px-3 py-2 text-right tabular-nums ' +
                      (remaining > 0 ? 'text-red-700' : 'text-slate-500')
                    }
                  >
                    {riel(remaining)}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        'rounded-full px-2 py-0.5 text-xs ' +
                        (status === 'paid'
                          ? 'bg-emerald-50 text-emerald-700'
                          : status === 'partial'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-red-50 text-red-700')
                      }
                    >
                      {t(`payments_status_${status}`)}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => setDetailPayment(p)}
                        className="rounded-md border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50"
                      >
                        {t('payments_action_view')}
                      </button>
                      {!p.is_paid && (
                        <button
                          onClick={() => setRecordTarget(p)}
                          className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-800 hover:bg-emerald-100"
                        >
                          {t('payments_action_record')}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-600">
          <span>
            {t('payments_page_info', {
              page,
              total: totalPages,
              count: searched.length,
            })}
          </span>
          <div className="flex gap-1">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-md border border-slate-200 px-2 py-1 disabled:opacity-40"
            >
              ←
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-md border border-slate-200 px-2 py-1 disabled:opacity-40"
            >
              →
            </button>
          </div>
        </div>
      )}

      <PaymentDetailModal
        open={!!detailPayment}
        payment={detailPayment}
        onClose={() => setDetailPayment(null)}
      />

      <RecordPaymentModal
        open={!!recordTarget}
        paymentId={recordTarget?.payment_id ?? null}
        studentName={recordTarget?.students?.name_kh ?? ''}
        total={recordTarget?.total_amount ?? 0}
        paid={recordTarget?.paid_amount ?? 0}
        onClose={() => setRecordTarget(null)}
        onSaved={() => {
          setRecordTarget(null);
          reload();
        }}
      />
    </div>
  );
}