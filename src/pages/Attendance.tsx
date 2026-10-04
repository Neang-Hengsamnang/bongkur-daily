import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../components/ui/Toast';
import { exportExcel, type ExcelColumn } from '../lib/excel';
import { riel } from '../lib/format';
import {
  getMonthlyAttendance, currentMonthIso, isoDateInMonth,
  type MonthlyResult, type MonthlyRow, type MonthlyCell,
} from '../lib/api/attendance';
import { listCourses, type Course } from '../lib/api/courses';
import { listStudents, type Student } from '../lib/api/students';
import PaymentEntryModal from '../components/PaymentEntryModal';
import PaymentDetailModal from '../components/PaymentDetailModal';
import type { PaymentListItem } from '../lib/api/payments';

const STICKY_ID_W = 76;
const STICKY_NAME_W = 160;

// Excel ARGB fills for Sunday columns
const SUNDAY_HEADER_FILL = 'FFF43F5E'; // rose-500
const SUNDAY_DATA_FILL   = 'FFFFF1F2'; // rose-50

export default function Attendance() {
  const { t } = useTranslation();
  const toast = useToast();

  const [month, setMonth] = useState<string>(currentMonthIso());
  const [grade, setGrade] = useState('');
  const [courseId, setCourseId] = useState('');

  const [data, setData] = useState<MonthlyResult | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  const [entryOpen, setEntryOpen] = useState(false);
  const [entryStudent, setEntryStudent] = useState<Student | null>(null);
  const [entryDate, setEntryDate] = useState('');

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailPayment, setDetailPayment] = useState<PaymentListItem | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [cs, ss] = await Promise.all([
          listCourses({ status: 'all' }),
          listStudents({ status: 'active' }),
        ]);
        if (!cancelled) {
          setCourses(cs);
          setAllStudents(ss);
        }
      } catch (e) {
        if (!cancelled) toast.error((e as Error).message);
      }
    })();
    return () => { cancelled = true; };
  }, [reloadKey, toast]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await getMonthlyAttendance({
          month,
          grade: grade || undefined,
          course: courseId || undefined,
        });
        if (!cancelled) setData(res);
      } catch (e) {
        if (!cancelled) toast.error((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [month, grade, courseId, reloadKey, toast]);

  const gradeOptions = useMemo(() => {
    const s = new Set<string>();
    for (const st of allStudents) if (st.grade) s.add(st.grade);
    return Array.from(s).sort();
  }, [allStudents]);

  /** Array indexed by day-1: true if that day is a Sunday */
  const dayIsSunday = useMemo(() => {
    if (!data) return [];
    return Array.from({ length: data.daysInMonth }, (_, i) =>
      new Date(data.year, data.month - 1, i + 1).getDay() === 0,
    );
  }, [data]);

  const reload = () => setReloadKey((k) => k + 1);

  const onCellClick = (row: MonthlyRow, cell: MonthlyCell) => {
    if (!cell.payment) {
      if (cell.isFuture || !data) return;
      setEntryStudent(row.student);
      setEntryDate(isoDateInMonth(data.year, data.month, cell.day));
      setEntryOpen(true);
      return;
    }
    const pl: PaymentListItem = {
      ...cell.payment,
      students: { name_kh: row.student.name_kh, grade: row.student.grade },
      profiles: null,
    };
    setDetailPayment(pl);
    setDetailOpen(true);
  };

  const cellClass = (cell: MonthlyCell, isSunday: boolean): string => {
    // Payment cells keep their color regardless of weekday
    if (cell.payment) {
      if (cell.payment.is_paid) return 'bg-emerald-200 text-emerald-900 hover:bg-emerald-300';
      if (cell.payment.paid_amount > 0) return 'bg-amber-200 text-amber-900 hover:bg-amber-300';
      return 'bg-slate-200 text-slate-800 hover:bg-slate-300';
    }
    if (cell.isFuture) {
      return isSunday ? 'bg-rose-50 text-rose-200' : 'bg-slate-50 text-slate-200';
    }
    return isSunday
      ? 'bg-rose-50 text-rose-300 hover:bg-rose-100'
      : 'bg-white text-slate-300 hover:bg-slate-100';
  };

  const onExport = async () => {
    if (!data || data.rows.length === 0) return;
    try {
      const columns: ExcelColumn[] = [
        { header: t('attendance_csv_id'),   key: 'id',   width: 14, align: 'left' },
        { header: t('attendance_csv_name'), key: 'name', width: 22, align: 'left' },
      ];
      for (let d = 1; d <= data.daysInMonth; d++) {
        const isSun = dayIsSunday[d - 1];
        columns.push({
          header: String(d),
          key: `d${d}`,
          width: 4,
          align: 'center',
          headerFill: isSun ? SUNDAY_HEADER_FILL : undefined,
          dataFill:   isSun ? SUNDAY_DATA_FILL   : undefined,
        });
      }
      columns.push(
        {
          header: t('attendance_csv_present_days'),
          key: 'total_present',
          width: 12,
          align: 'center',
          formula: `=COUNTIF({col:d1}{row}:{col:d${data.daysInMonth}}{row},"✓")`,
        },
        { header: t('attendance_col_billed'),      key: 'billed', width: 16, align: 'right', format: '#,##0 "៛"' },
        { header: t('attendance_col_paid_amount'), key: 'paid',   width: 16, align: 'right', format: '#,##0 "៛"' },
        {
          header: t('attendance_col_unpaid'),
          key: 'unpaid',
          width: 16,
          align: 'right',
          format: '#,##0 "៛"',
          formula: '={col:billed}{row}-{col:paid}{row}',
        },
      );

      const exportRows = data.rows.map((r) => {
        const row: Record<string, string | number | null> = {
          id: r.student.student_id,
          name: r.student.name_kh,
          billed: r.totalBilled,
          paid: r.totalPaid,
          unpaid: 0,
        };
        for (const c of r.cells) row[`d${c.day}`] = c.payment ? '✓' : null;
        return row;
      });

      const totals: Record<string, string | number | { formula: string }> = {
        id: t('attendance_csv_totals'),
        name: '',
      };
      for (let d = 1; d <= data.daysInMonth; d++) {
        totals[`d${d}`] = {
          formula: `=COUNTIF({col:d${d}}{firstRow}:{col:d${d}}{lastRow},"✓")`,
        };
      }
      totals.total_present = { formula: `=SUM({col:total_present}{firstRow}:{col:total_present}{lastRow})` };
      totals.billed        = { formula: `=SUM({col:billed}{firstRow}:{col:billed}{lastRow})` };
      totals.paid          = { formula: `=SUM({col:paid}{firstRow}:{col:paid}{lastRow})` };
      totals.unpaid        = { formula: `=SUM({col:unpaid}{firstRow}:{col:unpaid}{lastRow})` };

      await exportExcel({
        filename: `attendance-${month}`,
        sheetName: 'Attendance',
        title: t('attendance_title'),
        subtitle:
          `${t('attendance_month')}: ${month} · ` +
          `${t('attendance_kpi_present')}: ${data.totalPresentDays} / ` +
          `${data.totalStudents * data.daysElapsed} (${data.rate}%) · ` +
          `${t('attendance_col_paid_amount')}: ${riel(data.grandPaid)}`,
        columns,
        rows: exportRows,
        totals,
      });
      toast.success(t('attendance_export_done'));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-heading text-slate-900">{t('attendance_title')}</h1>
        <div className="flex gap-2">
          <button
            onClick={reload}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
          >
            ↻ {t('attendance_refresh')}
          </button>
          <button
            onClick={onExport}
            disabled={!data || data.rows.length === 0}
            className="rounded-md bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {t('attendance_export_excel')}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            {t('attendance_filter_month')}
          </label>
          <input
            type="month"
            value={month}
            max={currentMonthIso()}
            onChange={(e) => setMonth(e.target.value || currentMonthIso())}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            {t('attendance_filter_grade')}
          </label>
          <select
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">{t('attendance_filter_grade_all')}</option>
            {gradeOptions.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            {t('attendance_filter_course')}
          </label>
          <select
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">{t('attendance_filter_course_all')}</option>
            {courses.map((c) => (
              <option key={c.course_id} value={c.course_id}>{c.name_kh}</option>
            ))}
          </select>
        </div>
      </div>

      <p className="text-xs text-slate-500">{t('attendance_hint')}</p>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label={t('attendance_kpi_students')} value={String(data?.totalStudents ?? 0)} accent="from-slate-600 to-slate-800" />
        <KpiCard label={t('attendance_kpi_present')}  value={String(data?.totalPresentDays ?? 0)} accent="from-emerald-500 to-emerald-700" />
        <KpiCard label={t('attendance_kpi_absent')}   value={String(data?.totalAbsentDays ?? 0)}  accent="from-amber-500 to-amber-700" />
        <KpiCard label={t('attendance_kpi_rate')}     value={`${data?.rate ?? 0}%`}                accent="from-brand-500 to-brand-700" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard label={t('attendance_col_billed')}      value={riel(data?.grandBilled ?? 0)}    accent="from-slate-500 to-slate-700" />
        <KpiCard label={t('attendance_col_paid_amount')} value={riel(data?.grandPaid ?? 0)}      accent="from-emerald-600 to-emerald-800" />
        <KpiCard label={t('attendance_col_unpaid')}      value={riel(data?.grandRemaining ?? 0)} accent="from-rose-500 to-rose-700" />
      </div>

      {loading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500">
          {t('loading')}
        </div>
      ) : !data || data.rows.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500">
          {t('attendance_empty')}
        </div>
      ) : (
        <div className="overflow-auto max-h-[72vh] rounded-lg border border-slate-200 bg-white">
          <table className="border-separate border-spacing-0 text-xs">
            <thead className="sticky top-0 z-20">
              <tr>
                <th
                  className="sticky left-0 z-30 border-b border-slate-200 bg-slate-100 px-2 py-2 text-left font-semibold text-slate-600"
                  style={{ width: STICKY_ID_W, minWidth: STICKY_ID_W }}
                >
                  {t('attendance_col_id')}
                </th>
                <th
                  className="sticky z-30 border-b border-l border-slate-200 bg-slate-100 px-2 py-2 text-left font-semibold text-slate-600"
                  style={{ left: STICKY_ID_W, width: STICKY_NAME_W, minWidth: STICKY_NAME_W }}
                >
                  {t('attendance_col_name')}
                </th>
                {Array.from({ length: data.daysInMonth }, (_, i) => i + 1).map((d) => {
                  const isSun = dayIsSunday[d - 1];
                  const isToday =
                    d === new Date().getDate() &&
                    data.year === new Date().getFullYear() &&
                    data.month === new Date().getMonth() + 1;
                  return (
                    <th
                      key={d}
                      className={
                        'border-b py-2 text-center font-medium ' +
                        (isSun
                          ? 'border-rose-200 bg-rose-100 text-rose-700'
                          : 'border-slate-200 bg-slate-100 ' +
                            (isToday ? 'text-brand-700' : 'text-slate-500'))
                      }
                      style={{ width: 30, minWidth: 30 }}
                    >
                      {d}
                    </th>
                  );
                })}
                <th
                  className="border-b border-l border-slate-200 bg-slate-100 px-2 py-2 text-center font-semibold text-slate-600"
                  style={{ width: 56, minWidth: 56 }}
                >
                  {t('attendance_col_total')}
                </th>
                <th
                  className="border-b border-l border-slate-200 bg-slate-100 px-2 py-2 text-right font-semibold text-slate-600"
                  style={{ width: 110, minWidth: 110 }}
                >
                  {t('attendance_col_billed')}
                </th>
                <th
                  className="border-b border-slate-200 bg-slate-100 px-2 py-2 text-right font-semibold text-slate-600"
                  style={{ width: 110, minWidth: 110 }}
                >
                  {t('attendance_col_paid_amount')}
                </th>
                <th
                  className="border-b border-slate-200 bg-slate-100 px-2 py-2 text-right font-semibold text-slate-600"
                  style={{ width: 110, minWidth: 110 }}
                >
                  {t('attendance_col_unpaid')}
                </th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r, idx) => (
                <tr key={r.student.student_id}>
                  <td
                    className={
                      'sticky left-0 z-10 border-b border-slate-100 px-2 py-1.5 font-mono text-[10px] text-slate-500 ' +
                      (idx % 2 === 0 ? 'bg-white' : 'bg-slate-50')
                    }
                  >
                    {r.student.student_id}
                  </td>
                  <td
                    className={
                      'sticky z-10 truncate border-b border-l border-slate-100 px-2 py-1.5 text-slate-800 ' +
                      (idx % 2 === 0 ? 'bg-white' : 'bg-slate-50')
                    }
                    style={{ left: STICKY_ID_W }}
                  >
                    {r.student.name_kh}
                  </td>
                  {r.cells.map((c) => {
                    const isSun = dayIsSunday[c.day - 1];
                    return (
                      <td
                        key={c.day}
                        onClick={() => onCellClick(r, c)}
                        className={
                          'border-b border-slate-100 text-center select-none ' +
                          (c.isFuture ? 'cursor-default ' : 'cursor-pointer ') +
                          cellClass(c, isSun) +
                          (c.isToday ? ' ring-1 ring-inset ring-brand-500' : '')
                        }
                        title={
                          c.payment
                            ? `${r.student.name_kh} · ${c.day}: ✓`
                            : c.isFuture
                              ? ''
                              : t('attendance_click_to_record')
                        }
                      >
                        {c.payment ? '✓' : ''}
                      </td>
                    );
                  })}
                  <td
                    className={
                      'border-b border-l border-slate-100 px-2 py-1.5 text-center font-semibold tabular-nums text-slate-700 ' +
                      (idx % 2 === 0 ? 'bg-slate-50' : 'bg-slate-100')
                    }
                  >
                    {r.presentDays}
                  </td>
                  <td
                    className={
                      'border-b border-l border-slate-100 px-2 py-1.5 text-right tabular-nums text-slate-700 ' +
                      (idx % 2 === 0 ? 'bg-white' : 'bg-slate-50')
                    }
                  >
                    {riel(r.totalBilled)}
                  </td>
                  <td
                    className={
                      'border-b border-slate-100 px-2 py-1.5 text-right tabular-nums text-emerald-800 ' +
                      (idx % 2 === 0 ? 'bg-white' : 'bg-slate-50')
                    }
                  >
                    {riel(r.totalPaid)}
                  </td>
                  <td
                    className={
                      'border-b border-slate-100 px-2 py-1.5 text-right tabular-nums ' +
                      (r.totalRemaining > 0 ? 'text-rose-700' : 'text-slate-400') +
                      ' ' +
                      (idx % 2 === 0 ? 'bg-white' : 'bg-slate-50')
                    }
                  >
                    {riel(r.totalRemaining)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0 z-20">
              <tr>
                <td className="sticky left-0 z-30 border-t-2 border-slate-300 bg-slate-100 px-2 py-1.5 text-[10px] font-semibold uppercase text-slate-600">
                  {t('attendance_csv_totals')}
                </td>
                <td
                  className="sticky z-30 border-l border-t-2 border-slate-300 bg-slate-100"
                  style={{ left: STICKY_ID_W }}
                />
                {Array.from({ length: data.daysInMonth }, (_, i) => i + 1).map((d) => {
                  const count = data.rows.filter(
                    (r) => r.cells[d - 1]?.payment,
                  ).length;
                  const isSun = dayIsSunday[d - 1];
                  return (
                    <td
                      key={d}
                      className={
                        'border-t-2 py-1.5 text-center text-[10px] font-medium tabular-nums ' +
                        (isSun
                          ? 'border-rose-200 bg-rose-50 text-rose-700'
                          : 'border-slate-300 bg-slate-100 text-slate-600')
                      }
                    >
                      {count || ''}
                    </td>
                  );
                })}
                <td className="border-l border-t-2 border-slate-300 bg-slate-100 px-2 py-1.5 text-center text-[10px] font-semibold tabular-nums text-slate-700">
                  {data.totalPresentDays}
                </td>
                <td className="border-l border-t-2 border-slate-300 bg-slate-100 px-2 py-1.5 text-right text-[11px] font-semibold tabular-nums text-slate-700">
                  {riel(data.grandBilled)}
                </td>
                <td className="border-t-2 border-slate-300 bg-slate-100 px-2 py-1.5 text-right text-[11px] font-semibold tabular-nums text-emerald-800">
                  {riel(data.grandPaid)}
                </td>
                <td className="border-t-2 border-slate-300 bg-slate-100 px-2 py-1.5 text-right text-[11px] font-semibold tabular-nums text-rose-700">
                  {riel(data.grandRemaining)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <Legend />

      <PaymentEntryModal
        open={entryOpen}
        student={entryStudent}
        courses={courses}
        existing={null}
        defaultDate={entryDate}
        onClose={() => { setEntryOpen(false); setEntryStudent(null); }}
        onSaved={() => {
          setEntryOpen(false);
          setEntryStudent(null);
          reload();
        }}
      />

      <PaymentDetailModal
        open={detailOpen}
        payment={detailPayment}
        onClose={() => { setDetailOpen(false); setDetailPayment(null); }}
      />
    </div>
  );
}

function KpiCard({
  label, value, accent,
}: { label: string; value: string; accent: string }) {
  return (
    <div className={`rounded-xl bg-gradient-to-br ${accent} p-3 text-white shadow-sm`}>
      <div className="text-[10px] font-medium uppercase tracking-wide opacity-90">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function Legend() {
  const { t } = useTranslation();
  const items: Array<{ cls: string; label: string }> = [
    { cls: 'bg-emerald-200', label: t('attendance_legend_paid') },
    { cls: 'bg-amber-200',   label: t('attendance_legend_partial') },
    { cls: 'bg-slate-200',   label: t('attendance_legend_unpaid') },
    { cls: 'bg-white border border-slate-200', label: t('attendance_legend_absent') },
    { cls: 'bg-slate-50 border border-slate-200', label: t('attendance_legend_future') },
    { cls: 'bg-rose-100 border border-rose-200', label: t('attendance_legend_sunday') },
  ];
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-1.5">
          <span className={`inline-block h-3.5 w-3.5 rounded ${it.cls}`} />
          <span>{it.label}</span>
        </div>
      ))}
    </div>
  );
}