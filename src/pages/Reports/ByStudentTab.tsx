import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../components/ui/Toast';
import { riel } from '../../lib/format';
import { exportExcel } from '../../lib/excel';
import {
  getByStudentReport, type ReportFilters, type StudentReportRow,
} from '../../lib/api/reports';

export default function ByStudentTab({ filters }: { filters: ReportFilters }) {
  const { t } = useTranslation();
  const toast = useToast();

  const [rows, setRows] = useState<StudentReportRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await getByStudentReport(filters);
        if (!cancelled) setRows(res);
      } catch (e) {
        if (!cancelled) toast.error((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [filters.from, filters.to, filters.course, filters.grade, toast]);

  const onExport = async () => {
    if (rows.length === 0) return;
    try {
      await exportExcel({
        filename: `report-by-student-${filters.from}_${filters.to}`,
        sheetName: 'By Student',
        title: t('reports_tab_student'),
        subtitle: `${filters.from} → ${filters.to}`,
        columns: [
          { header: t('reports_col_student_id'), key: 'student_id', width: 14, align: 'left' },
          { header: t('reports_col_name'),       key: 'name_kh',    width: 24, align: 'left' },
          { header: t('reports_col_grade'),      key: 'grade',      width: 14, align: 'center' },
          { header: t('reports_col_billed'),     key: 'billed',     width: 16, align: 'right', format: '#,##0 "៛"' },
          { header: t('reports_col_paid'),       key: 'paid',       width: 16, align: 'right', format: '#,##0 "៛"' },
          {
            header: t('reports_col_remaining'),
            key: 'remaining',
            width: 16,
            align: 'right',
            format: '#,##0 "៛"',
            formula: '={col:billed}{row}-{col:paid}{row}',
          },
          { header: t('reports_col_transactions'), key: 'transactions', width: 12, align: 'center' },
        ],
        rows: rows.map((r) => ({
          student_id: r.student_id,
          name_kh: r.name_kh,
          grade: r.grade ?? '',
          billed: r.billed,
          paid: r.paid,
          remaining: 0,
          transactions: r.transactions,
        })),
        totals: {
          student_id: '',
          name_kh: t('reports_grand_total'),
          grade: '',
          billed:      { formula: '=SUM({col:billed}{firstRow}:{col:billed}{lastRow})' },
          paid:        { formula: '=SUM({col:paid}{firstRow}:{col:paid}{lastRow})' },
          remaining:   { formula: '=SUM({col:remaining}{firstRow}:{col:remaining}{lastRow})' },
          transactions:{ formula: '=SUM({col:transactions}{firstRow}:{col:transactions}{lastRow})' },
        },
      });
      toast.success(t('reports_export_done'));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const totals = rows.reduce(
    (a, r) => ({
      billed: a.billed + r.billed,
      paid: a.paid + r.paid,
      remaining: a.remaining + r.remaining,
      transactions: a.transactions + r.transactions,
    }),
    { billed: 0, paid: 0, remaining: 0, transactions: 0 },
  );

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
          {filters.from} → {filters.to} · {rows.length} {t('reports_kpi_students')}
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
                <th className="px-3 py-2">{t('reports_col_student_id')}</th>
                <th className="px-3 py-2">{t('reports_col_name')}</th>
                <th className="px-3 py-2">{t('reports_col_grade')}</th>
                <th className="px-3 py-2 text-right">{t('reports_col_billed')}</th>
                <th className="px-3 py-2 text-right">{t('reports_col_paid')}</th>
                <th className="px-3 py-2 text-right">{t('reports_col_remaining')}</th>
                <th className="px-3 py-2 text-center">{t('reports_col_transactions')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.student_id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-mono text-xs text-slate-500">{r.student_id}</td>
                  <td className="px-3 py-2">{r.name_kh}</td>
                  <td className="px-3 py-2 text-center text-slate-600">{r.grade ?? '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{riel(r.billed)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{riel(r.paid)}</td>
                  <td className={'px-3 py-2 text-right tabular-nums ' + (r.remaining > 0 ? 'text-rose-700' : 'text-slate-400')}>
                    {riel(r.remaining)}
                  </td>
                  <td className="px-3 py-2 text-center tabular-nums">{r.transactions}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-300 bg-indigo-50 font-semibold">
                <td className="px-3 py-2" colSpan={3}>{t('reports_grand_total')}</td>
                <td className="px-3 py-2 text-right tabular-nums">{riel(totals.billed)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{riel(totals.paid)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-rose-700">{riel(totals.remaining)}</td>
                <td className="px-3 py-2 text-center tabular-nums">{totals.transactions}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}