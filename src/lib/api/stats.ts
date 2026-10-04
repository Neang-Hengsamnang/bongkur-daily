import { supabase } from '../supabase';
import { todayIso } from './payments';

export interface DashboardRecentPayment {
  payment_id: string;
  student_id: string;
  payment_date: string;
  paid_amount: number;
  total_amount: number;
  is_paid: boolean;
  student_name: string | null;
  student_grade: string | null;
}

export interface DashboardStats {
  total_students: number;
  today_collection: number;
  month_collection: number;
  all_time_collection: number;
  recent: DashboardRecentPayment[];
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const { data, error } = await supabase.rpc('dashboard_stats', {
    p_today: todayIso(),
  } as never);
  if (error) throw error;
  return data as DashboardStats;
}