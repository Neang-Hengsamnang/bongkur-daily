import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../components/ui/Toast';
import { riel, date as fmtDate } from '../../lib/format';
import { exportExcel } from '../../lib/excel';
import {
  getOutstandingReport, type ReportFilters, type OutstandingReportRow,
} from '../../lib/api/reports';

const OVERDUE_DAYS = 30;

export default function OutstandingTab({ filters }: { filters: ReportFilters }) {
  const { t } = useTranslation();
  const toast = useToast();

  const [rows, setRows] = useState<OutstandingReportRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await getOutstandingReport(filters);
        if (!cancelled) setRows(res);
      } catch (e) {
        if (!cancelled) toast.error((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [filters.from, filters.to, filters.course, filters.grade, toast]);

  const grand = rows.reduce((s, r) => s + r.remaining, 0);

  const onExport = async () => {
    if (rows.length === 0) return;
    try {
      await exportExcel({
        filename: `report-outstanding-${filters.from}_${filters.to}`,
        sheetName: 'Outstanding',
        title: t('reports_tab_outstanding'),
        subtitle: `${filters.from} → ${filters.to}`,
        columns: [
          { header: t('reports_col_payment_id'),   key: 'payment_id',    width: 14, align: 'left' },
          { header: t('reports_col_date'),         key: 'payment_date',  width: 14, align: 'center' },
          { header: t('reports_col_student_id'),   key: 'student_id',    width: 14, align: 'left' },
          { header: t('reports_col_name'),         key: 'name_kh',       width: 22, align: 'left' },
          { header: t('reports_col_grade'),        key: 'grade',         width: 12, align: 'center' },
          { header: t('reports_col_billed'),       key: 'billed',        width: 16, align: 'right', format: '#,##0 "៛"' },
          { header: t('reports_col_paid'),         key: 'paid',          width: 16, align: 'right', format: '#,##0 "៛"' },
          {
            header: t('reports_col_remaining'),
            key: 'remaining',
            width: 16,
            align: 'right',
            format: '#,##0 "៛"',
            formula: '={col:billed}{row}-{col:paid}{row}',
          },
          {
            header: t('reports_col_days_overdue'),
            key: 'days_overdue',
            width: 12,
            align: 'center',
            formula: `=MAX(0, TODAY()-{col:payment_date}{row})`,
          },
        ],
        rows: rows.map((r) => ({
          payment_id: r.payment_id,
          payment_date: r.payment_date,
          student_id: r.student_id,
          name_kh: r.name_kh,
          grade: r.grade ?? '',
          billed: r.billed,
          paid: r.paid,
          remaining: 0,
          days_overdue: 0,
        })),
        totals: {
          payment_id: t('reports_grand_total'),
          payment_date: '',
          student_id: '',
          name_kh: '',
          grade: '',
          billed:    { formula: '=SUM({col:billed}{firstRow}:{col:billed}{lastRow})' },
          paid:      { formula: '=SUM({col:paid}{firstRow}:{col:paid}{lastRow})' },
          remaining: { formula: '=SUM({col:remaining}{firstRow}:{col:remaining}{lastRow})' },
          days_overdue: '',
        },
      });
      toast.success(t('reports_export_done'));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500">
        {t('loading')}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          {filters.from} → {filters.to} · {rows.length} {t('reports_col_transactions')}
        </p>
        <button
          onClick={onExport}
          disabled={rows.length === 0}
          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {t('reports_export')}
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500">
          {t('reports_empty')}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">{t('reports_col_payment_id')}</th>
                <th className="px-3 py-2">{t('reports_col_date')}</th>
                <th className="px-3 py-2">{t('reports_col_name')}</th>
                <th className="px-3 py-2">{t('reports_col_grade')}</th>
                <th className="px-3 py-2 text-right">{t('reports_col_billed')}</th>
                <th className="px-3 py-2 text-right">{t('reports_col_paid')}</th>
                <th className="px-3 py-2 text-right">{t('reports_col_remaining')}</th>
                <th className="px-3 py-2 text-center">{t('reports_col_days_overdue')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const overdue = r.days_overdue > OVERDUE_DAYS;
                return (
                  <tr
                    key={r.payment_id}
                    className={'border-t border-slate-100 ' + (overdue ? 'bg-rose-50' : '')}
                  >
                    <td className="px-3 py-2 font-mono text-xs text-slate-500">{r.payment_id}</td>
                    <td className="px-3 py-2">{fmtDate(r.payment_date)}</td>
                    <td className="px-3 py-2">
                      {r.name_kh}
                      <span className="ml-1 font-mono text-[10px] text-slate-400">{r.student_id}</span>
                    </td>
                    <td className="px-3 py-2 text-center text-slate-600">{r.grade ?? '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{riel(r.billed)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{riel(r.paid)}</td>
                    <td className={'px-3 py-2 text-right tabular-nums ' + (overdue ? 'font-semibold text-rose-800' : 'text-rose-700')}>
                      {riel(r.remaining)}
                    </td>
                    <td className={'px-3 py-2 text-center tabular-nums ' + (overdue ? 'font-semibold text-rose-800' : 'text-slate-600')}>
                      {r.days_overdue}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-300 bg-rose-50 font-semibold">
                <td className="px-3 py-2" colSpan={6}>{t('reports_grand_total')}</td>
                <td className="px-3 py-2 text-right tabular-nums text-rose-800">{riel(grand)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}