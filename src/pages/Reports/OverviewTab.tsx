import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import 'chart.js/auto';
import { Bar } from 'react-chartjs-2';
import { useToast } from '../../components/ui/Toast';
import { riel } from '../../lib/format';
import { exportExcel } from '../../lib/excel';
import {
  getOverviewReport, type ReportFilters, type OverviewReport,
} from '../../lib/api/reports';

export default function OverviewTab({ filters }: { filters: ReportFilters }) {
  const { t } = useTranslation();
  const toast = useToast();

  const [data, setData] = useState<OverviewReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await getOverviewReport(filters);
        if (!cancelled) setData(res);
      } catch (e) {
        if (!cancelled) toast.error((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [filters.from, filters.to, filters.course, filters.grade, toast]);

  const onExport = async () => {
    if (!data) return;
    try {
      await exportExcel({
        filename: `report-overview-${filters.from}_${filters.to}`,
        sheetName: 'Overview',
        title: t('reports_tab_overview'),
        subtitle:
          `${filters.from} → ${filters.to} · ` +
          `${t('reports_kpi_billed')}: ${riel(data.total_billed)} · ` +
          `${t('reports_kpi_paid')}: ${riel(data.total_paid)} · ` +
          `${t('reports_kpi_outstanding')}: ${riel(data.outstanding)}`,
        columns: [
          { header: t('reports_col_course'),  key: 'name',    width: 26, align: 'left' },
          { header: t('reports_col_hours'),   key: 'hours',   width: 12, align: 'center' },
          { header: t('reports_col_revenue'), key: 'revenue', width: 18, align: 'right', format: '#,##0 "៛"' },
        ],
        rows: data.top_courses.map((c) => ({
          name: c.name, hours: c.hours, revenue: c.revenue,
        })),
        totals: {
          name: t('reports_grand_total'),
          hours:   { formula: '=SUM({col:hours}{firstRow}:{col:hours}{lastRow})' },
          revenue: { formula: '=SUM({col:revenue}{firstRow}:{col:revenue}{lastRow})' },
        },
      });
      toast.success(t('reports_export_done'));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  if (loading || !data) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500">
        {t('loading')}
      </div>
    );
  }

  const kpis = [
    { label: t('reports_kpi_billed'),      value: riel(data.total_billed),    accent: 'from-slate-600 to-slate-800' },
    { label: t('reports_kpi_paid'),        value: riel(data.total_paid),      accent: 'from-emerald-500 to-emerald-700' },
    { label: t('reports_kpi_outstanding'), value: riel(data.outstanding),     accent: 'from-rose-500 to-rose-700' },
    { label: t('reports_kpi_transactions'),value: String(data.transactions), accent: 'from-brand-500 to-brand-700' },
    { label: t('reports_kpi_students'),    value: String(data.students_served), accent: 'from-amber-500 to-amber-700' },
  ];

  const chartData = {
    labels: data.daily.map((d) => d.day.slice(5)),
    datasets: [
      {
        label: t('reports_chart_daily'),
        data: data.daily.map((d) => d.amount),
        backgroundColor: '#2563eb',
        borderRadius: 6,
        barPercentage: 0.7,
        categoryPercentage: 0.8,
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

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {kpis.map((k) => (
          <div key={k.label} className={`rounded-xl bg-gradient-to-br ${k.accent} p-3 text-white shadow-sm`}>
            <div className="text-[10px] font-medium uppercase tracking-wide opacity-90">
              {k.label}
            </div>
            <div className="mt-1 text-xl font-semibold tabular-nums">{k.value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-medium text-slate-800">
          {t('reports_chart_daily')}
        </h3>
        {data.daily.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">
            {t('reports_chart_no_data')}
          </div>
        ) : (
          <div style={{ height: 260 }}>
            <Bar
              data={chartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    callbacks: {
                      label: (ctx) => riel(Number(ctx.raw) || 0),
                    },
                  },
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    ticks: { callback: (v) => Number(v).toLocaleString() },
                    grid: { color: '#f1f5f9' },
                  },
                  x: { grid: { display: false } },
                },
              }}
            />
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-medium text-slate-800">
            {t('reports_top_courses')}
          </h3>
        </div>
        {data.top_courses.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-500">{t('reports_empty')}</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">{t('reports_col_course')}</th>
                <th className="px-4 py-2 text-right">{t('reports_col_hours')}</th>
                <th className="px-4 py-2 text-right">{t('reports_col_revenue')}</th>
              </tr>
            </thead>
            <tbody>
              {data.top_courses.map((c) => (
                <tr key={c.name} className="border-t border-slate-100">
                  <td className="px-4 py-2">{c.name}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{c.hours}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{riel(c.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}