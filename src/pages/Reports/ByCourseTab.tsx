import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import 'chart.js/auto';
import { Doughnut } from 'react-chartjs-2';
import { useToast } from '../../components/ui/Toast';
import { riel } from '../../lib/format';
import { exportExcel } from '../../lib/excel';
import {
  getByCourseReport, type ReportFilters, type CourseReportRow,
} from '../../lib/api/reports';

const COLORS = [
  '#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed',
  '#0891b2', '#be185d', '#4d7c0f', '#6366f1', '#a16207',
];

export default function ByCourseTab({ filters }: { filters: ReportFilters }) {
  const { t } = useTranslation();
  const toast = useToast();

  const [rows, setRows] = useState<CourseReportRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await getByCourseReport(filters);
        if (!cancelled) setRows(res);
      } catch (e) {
        if (!cancelled) toast.error((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [filters.from, filters.to, filters.course, filters.grade, toast]);

  const grandRevenue = rows.reduce((s, r) => s + r.revenue, 0);

  const onExport = async () => {
    if (rows.length === 0) return;
    try {
      await exportExcel({
        filename: `report-by-course-${filters.from}_${filters.to}`,
        sheetName: 'By Course',
        title: t('reports_tab_course'),
        subtitle: `${filters.from} → ${filters.to}`,
        columns: [
          { header: t('reports_col_course'),  key: 'name',    width: 26, align: 'left' },
          { header: t('reports_col_hours'),   key: 'hours',   width: 12, align: 'center' },
          { header: t('reports_col_revenue'), key: 'revenue', width: 18, align: 'right', format: '#,##0 "៛"' },
          {
            header: t('reports_col_share'),
            key: 'share',
            width: 12,
            align: 'right',
            format: '0.00%',
            formula: '=IFERROR({col:revenue}{row}/{col:revenue}{totalRow},"")',
          },
        ],
        rows: rows.map((r) => ({
          name: r.name, hours: r.hours, revenue: r.revenue, share: 0,
        })),
        totals: {
          name: t('reports_grand_total'),
          hours:   { formula: '=SUM({col:hours}{firstRow}:{col:hours}{lastRow})' },
          revenue: { formula: '=SUM({col:revenue}{firstRow}:{col:revenue}{lastRow})' },
          share:   { formula: '=SUM({col:share}{firstRow}:{col:share}{lastRow})' },
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

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500">
        {t('reports_empty')}
      </div>
    );
  }

  const chartData = {
    labels: rows.map((r) => r.name),
    datasets: [
      {
        data: rows.map((r) => r.revenue),
        backgroundColor: rows.map((_, i) => COLORS[i % COLORS.length]),
        borderWidth: 2,
        borderColor: '#ffffff',
      },
    ],
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          {filters.from} → {filters.to}
        </p>
        <button
          onClick={onExport}
          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
        >
          {t('reports_export')}
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white p-4 lg:col-span-2">
          <h3 className="mb-3 text-sm font-medium text-slate-800">
            {t('reports_col_share')}
          </h3>
          <div style={{ height: 260 }}>
            <Doughnut
              data={chartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } },
                  tooltip: {
                    callbacks: {
                      label: (ctx) => {
                        const v = Number(ctx.raw) || 0;
                        const pct = grandRevenue === 0 ? 0 : (v / grandRevenue) * 100;
                        return `${ctx.label}: ${riel(v)} (${pct.toFixed(1)}%)`;
                      },
                    },
                  },
                },
              }}
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white lg:col-span-3">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">{t('reports_col_course')}</th>
                <th className="px-4 py-2 text-right">{t('reports_col_hours')}</th>
                <th className="px-4 py-2 text-right">{t('reports_col_revenue')}</th>
                <th className="px-4 py-2 text-right">{t('reports_col_share')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const pct = grandRevenue === 0 ? 0 : (r.revenue / grandRevenue) * 100;
                return (
                  <tr key={r.course_id} className="border-t border-slate-100">
                    <td className="px-4 py-2">{r.name}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{r.hours}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{riel(r.revenue)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{pct.toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-300 bg-indigo-50 font-semibold">
                <td className="px-4 py-2">{t('reports_grand_total')}</td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {rows.reduce((s, r) => s + r.hours, 0)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">{riel(grandRevenue)}</td>
                <td className="px-4 py-2 text-right tabular-nums">100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}