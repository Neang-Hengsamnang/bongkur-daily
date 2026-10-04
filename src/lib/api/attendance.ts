import { listStudents, type Student } from './students';
import { listPaymentsInRange, type PaymentWithItems } from './payments';

export interface MonthlyCell {
  day: number;
  isFuture: boolean;
  isToday: boolean;
  payment: PaymentWithItems | null;
}

export interface MonthlyRow {
  student: Student;
  cells: MonthlyCell[];
  presentDays: number;
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

  const [students, payments] = await Promise.all([
    listStudents({ status: 'active', course: opts.course || undefined }),
    listPaymentsInRange(from, to),
  ]);

  const filtered = opts.grade
    ? students.filter((s) => s.grade === opts.grade)
    : students;

  const byStudentDay = new Map<string, Map<number, PaymentWithItems>>();
  for (const p of payments) {
    const day = Number(p.payment_date.slice(8, 10));
    const inner = byStudentDay.get(p.student_id) ?? new Map<number, PaymentWithItems>();
    inner.set(day, p);
    byStudentDay.set(p.student_id, inner);
  }

  const rows: MonthlyRow[] = filtered.map((s) => {
    const inner = byStudentDay.get(s.student_id) ?? new Map<number, PaymentWithItems>();
    const cells: MonthlyCell[] = [];
    let presentDays = 0;
    let totalBilled = 0;
    let totalPaid = 0;
    for (let d = 1; d <= dim; d++) {
      const payment = inner.get(d) ?? null;
      const isFuture = isFutureMonth || (isCurrentMonth && d > todayD);
      const isToday = isCurrentMonth && d === todayD;
      if (payment) {
        presentDays++;
        totalBilled += payment.total_amount;
        totalPaid += payment.paid_amount;
      }
      cells.push({ day: d, isFuture, isToday, payment });
    }
    return {
      student: s,
      cells,
      presentDays,
      totalBilled,
      totalPaid,
      totalRemaining: Math.max(0, totalBilled - totalPaid),
    };
  });

  rows.sort((a, b) => a.student.name_kh.localeCompare(b.student.name_kh, 'km'));

  const totalStudents = rows.length;
  const totalPresentDays = rows.reduce((s, r) => s + r.presentDays, 0);
  const possibleDays = totalStudents * daysElapsed;
  const totalAbsentDays = Math.max(0, possibleDays - totalPresentDays);
  const rate = possibleDays === 0 ? 0 : Math.round((totalPresentDays / possibleDays) * 100);

  const grandBilled    = rows.reduce((s, r) => s + r.totalBilled, 0);
  const grandPaid      = rows.reduce((s, r) => s + r.totalPaid, 0);
  const grandRemaining = Math.max(0, grandBilled - grandPaid);

  return {
    year, month, daysInMonth: dim, daysElapsed,
    rows, totalStudents, totalPresentDays, totalAbsentDays, rate,
    grandBilled, grandPaid, grandRemaining,
  };
}