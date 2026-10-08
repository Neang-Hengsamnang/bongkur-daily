import { listStudents, type Student } from './students';
import { listPaymentsInRange, type PaymentWithItems } from './payments';

export interface MonthlyCell {
  day: number;
  isFuture: boolean;
  isToday: boolean;
  isPreEnrollment: boolean;
  payment: PaymentWithItems | null;
}

export interface MonthlyRow {
  student: Student;
  cells: MonthlyCell[];
  presentDays: number;
  possibleDays: number;
  totalBilled: number;
  totalPaid: number;
  totalRemaining: number;
}

export interface MonthlyResult {
  year: number;
  month: number;
  daysInMonth: number;
  daysElapsed: number;
  rows: MonthlyRow[];
  totalStudents: number;
  totalPresentDays: number;
  totalAbsentDays: number;
  possibleDays: number;
  rate: number;
  grandBilled: number;
  grandPaid: number;
  grandRemaining: number;
}

export function currentMonthIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function isoDateInMonth(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function daysInMonthOf(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export async function getMonthlyAttendance(opts: {
  month: string;
  grade?: string;
  course?: string;
}): Promise<MonthlyResult> {
  const [yStr, mStr] = opts.month.split('-');
  const year = Number(yStr);
  const month = Number(mStr);
  const dim = daysInMonthOf(year, month);

  const now = new Date();
  const todayY = now.getFullYear();
  const todayM = now.getMonth() + 1;
  const todayD = now.getDate();

  const isCurrentMonth = year === todayY && month === todayM;
  const isPastMonth = year < todayY || (year === todayY && month < todayM);
  const isFutureMonth = !isCurrentMonth && !isPastMonth;
  const daysElapsed = isFutureMonth ? 0 : isCurrentMonth ? todayD : dim;

  const from = isoDateInMonth(year, month, 1);
  const to = isoDateInMonth(year, month, dim);

  // Fetch ALL students (regardless of current status). A student who was active
  // during the queried month may have since been marked inactive/graduated.
  // Excluding them would silently drop their revenue from the totals.
  const [allStudents, payments] = await Promise.all([
    listStudents({ status: 'all', course: opts.course || undefined }),
    listPaymentsInRange(from, to),
  ]);

  // Group payments by student for fast lookup
  const byStudentDay = new Map<string, Map<number, PaymentWithItems>>();
  for (const p of payments) {
    const day = Number(p.payment_date.slice(8, 10));
    const inner = byStudentDay.get(p.student_id) ?? new Map<number, PaymentWithItems>();
    inner.set(day, p);
    byStudentDay.set(p.student_id, inner);
  }

  // Include a student when BOTH:
  //   1. Their record existed by the end of the queried month (no future enrollments)
  //   2. AND they are either currently active OR had ≥1 payment this month
  // This preserves the "no phantom students" rule while ensuring every payment
  // from a now-inactive student still counts toward the money KPIs.
  const monthEndMs = new Date(year, month, 0, 23, 59, 59, 999).getTime();

  const includedStudents = allStudents.filter((s) => {
    const createdMs = new Date(s.created_at).getTime();
    if (!Number.isFinite(createdMs) || createdMs > monthEndMs) return false;

    const isActive = s.status === 'active';
    const hasPaymentThisMonth = byStudentDay.has(s.student_id);

    return isActive || hasPaymentThisMonth;
  });

  const filtered = opts.grade
    ? includedStudents.filter((s) => s.grade === opts.grade)
    : includedStudents

  const rows: MonthlyRow[] = filtered.map((s) => {
    const inner = byStudentDay.get(s.student_id) ?? new Map<number, PaymentWithItems>();
    const cells: MonthlyCell[] = [];
    let presentDays = 0;
    let possibleDays = 0;
    let totalBilled = 0;
    let totalPaid = 0;

    // Compute the effective start day of this student within the queried month.
    // If they were created before the month → start = 1.
    // If created inside the month → start = the day they joined.
    const created = new Date(s.created_at);
    const createdY = created.getFullYear();
    const createdM = created.getMonth() + 1;
    let effectiveStart = 1;
    if (createdY === year && createdM === month) {
      effectiveStart = created.getDate();
    }
    // (If created > queried month, we already filtered them out.)

    for (let d = 1; d <= dim; d++) {
      const payment = inner.get(d) ?? null;
      const isPreEnrollment = d < effectiveStart;
      const isFuture = isFutureMonth || (isCurrentMonth && d > todayD);
      const isToday = isCurrentMonth && d === todayD;

      if (payment) {
        presentDays++;
        totalBilled += payment.total_amount;
        totalPaid += payment.paid_amount;
      }

      // Days the student was actually enrolled AND that have already happened
      if (!isPreEnrollment && !isFuture) possibleDays++;

      cells.push({ day: d, isFuture, isToday, isPreEnrollment, payment });
    }

    return {
      student: s,
      cells,
      presentDays,
      possibleDays,
      totalBilled,
      totalPaid,
      totalRemaining: Math.max(0, totalBilled - totalPaid),
    };
  });

  rows.sort((a, b) => a.student.name_kh.localeCompare(b.student.name_kh, 'km'));

  const totalStudents = rows.length;
  const totalPresentDays = rows.reduce((s, r) => s + r.presentDays, 0);
  const possibleDays = rows.reduce((s, r) => s + r.possibleDays, 0);
  const totalAbsentDays = Math.max(0, possibleDays - totalPresentDays);
  const rate = possibleDays === 0 ? 0 : Math.round((totalPresentDays / possibleDays) * 100);

  const grandBilled    = rows.reduce((s, r) => s + r.totalBilled, 0);
  const grandPaid      = rows.reduce((s, r) => s + r.totalPaid, 0);
  const grandRemaining = Math.max(0, grandBilled - grandPaid);

  return {
    year, month, daysInMonth: dim, daysElapsed,
    rows, totalStudents, totalPresentDays, totalAbsentDays, possibleDays, rate,
    grandBilled, grandPaid, grandRemaining,
  };
}