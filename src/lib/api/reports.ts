import { supabase } from '../supabase';

export interface ReportFilters {
  from: string;
  to: string;
  course: string | null;
  grade: string | null;
}

export interface OverviewDailyPoint { day: string; amount: number }
export interface OverviewTopCourse { name: string; hours: number; revenue: number }

export interface OverviewReport {
  total_billed: number;
  total_paid: number;
  outstanding: number;
  transactions: number;
  students_served: number;
  daily: OverviewDailyPoint[];
  top_courses: OverviewTopCourse[];
}

export interface CourseReportRow {
  course_id: string;
  name: string;
  hours: number;
  revenue: number;
}

export interface StudentReportRow {
  student_id: string;
  name_kh: string;
  grade: string | null;
  billed: number;
  paid: number;
  remaining: number;
  transactions: number;
}

export interface OutstandingReportRow {
  payment_id: string;
  payment_date: string;
  student_id: string;
  name_kh: string;
  grade: string | null;
  billed: number;
  paid: number;
  remaining: number;
  days_overdue: number;
}

export interface StaffReportRow {
  user_id: string;
  full_name: string;
  transactions: number;
  billed: number;
  collected: number;
}

async function rpc<T>(name: string, params: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(name, params as never);
  if (error) throw error;
  return data as T;
}

const base = (f: ReportFilters) => ({
  p_from: f.from,
  p_to: f.to,
  p_course: f.course,
  p_grade: f.grade,
});

export const getOverviewReport    = (f: ReportFilters) => rpc<OverviewReport>('report_overview', base(f));
export const getByCourseReport    = (f: ReportFilters) => rpc<CourseReportRow[]>('report_by_course', base(f));
export const getByStudentReport   = (f: ReportFilters) => rpc<StudentReportRow[]>('report_by_student', base(f));
export const getOutstandingReport = (f: ReportFilters) => rpc<OutstandingReportRow[]>('report_outstanding', base(f));
export const getByStaffReport     = (f: ReportFilters) =>
  rpc<StaffReportRow[]>('report_by_staff', { p_from: f.from, p_to: f.to });