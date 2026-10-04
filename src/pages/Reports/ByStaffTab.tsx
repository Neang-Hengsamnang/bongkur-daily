import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../components/ui/Toast';
import { riel } from '../../lib/format';
import { exportExcel } from '../../lib/excel';
import {
  getByStaffReport, type ReportFilters, type StaffReportRow,
} from '../../lib/api/reports';

export default function ByStaffTab({ filters }: { filters: ReportFilters }) {
  const { t } = useTranslation();
  const toast = useToast();

  const [rows, setRows] = useState<StaffReportRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await getByStaffReport(filters);
        if (!cancelled) setRows(res);
      } catch (e) {
        if (!cancelled) toast.error((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [filters.from, filters.to, toast]);

  const totals = rows.reduce(
    (a, r) => ({
      transactions: a.transactions + r.transactions,
      billed: a.billed + r.billed,
      collected: a.collected + r.collected,
    }),
    { transactions: 0, billed: 0, collected: 0 },
  );

  const onExport = async () => {
    if (rows.length === 0) return;
    try {
      await exportExcel({
        filename: `report-by-staff-${filters.from}_${filters.to}`,
        sheetName: 'By Staff',
        title: t('reports_tab_staff'),
        subtitle: `${filters.from} → ${filters.to}`,
        columns: [
          { header: t('reports_col_staff_id'),     key: 'user_id',      width: 14, align: 'left' },
          { header: t('reports_col_staff'),        key: 'full_name',    width: 24, align: 'left' },
          { header: t('reports_col_transactions'), key: 'transactions', width: 12, align: 'center' },
          { header: t('reports_col_billed'),       key: 'billed',       width: 16, align: 'right', format: '#,##0 "៛"' },
          { header: t('reports_col_collected'),    key: 'collected',    width: 16, align: 'right', format: '#,##0 "៛"' },
        ],
        rows: rows.map((r) => ({
          user_id: r.user_id,
          full_name: r.full_name,
          transactions: r.transactions,
          billed: r.billed,
          collected: r.collected,
        })),
        totals: {
          user_id: '',
          full_name: t('reports_grand_total'),
          transactions: { formula: '=SUM({col:transactions}{firstRow}:{col:transactions}{lastRow})' },
          billed:       { formula: '=SUM({col:billed}{firstRow}:{col:billed}{lastRow})' },
          collected:    { formula: '=SUM({col:collected}{firstRow}:{col:collected}{lastRow})' },
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
          {filters.from} → {filters.to}
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
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">{t('reports_col_staff_id')}</th>
                <th className="px-3 py-2">{t('reports_col_staff')}</th>
                <th className="px-3 py-2 text-center">{t('reports_col_transactions')}</th>
                <th className="px-3 py-2 text-right">{t('reports_col_billed')}</th>
                <th className="px-3 py-2 text-right">{t('reports_col_collected')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.user_id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-mono text-xs text-slate-500">{r.user_id}</td>
                  <td className="px-3 py-2">{r.full_name}</td>
                  <td className="px-3 py-2 text-center tabular-nums">{r.transactions}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{riel(r.billed)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-emerald-800">{riel(r.collected)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-300 bg-indigo-50 font-semibold">
                <td className="px-3 py-2" colSpan={2}>{t('reports_grand_total')}</td>
                <td className="px-3 py-2 text-center tabular-nums">{totals.transactions}</td>
                <td className="px-3 py-2 text-right tabular-nums">{riel(totals.billed)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-emerald-800">{riel(totals.collected)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}