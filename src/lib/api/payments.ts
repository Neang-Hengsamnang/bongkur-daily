import { supabase } from '../supabase';

export interface PaymentItem {
  item_id: string;
  payment_id: string;
  course_id: string;
  course_name_at_time: string;
  hours: number;
  hourly_fee_at_time: number;
  subtotal: number;
}

export interface Payment {
  payment_id: string;
  student_id: string;
  payment_date: string;
  is_paid: boolean;
  paid_amount: number;
  total_amount: number;
  recorded_by: string;
  note: string | null;
  created_at: string;
  updated_at: string;
  paid_at: string | null;
}

export interface PaymentWithItems extends Payment {
  payment_items: PaymentItem[];
}

export interface UpsertItem {
  course_id: string;
  hours: number;
}

export function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function listPaymentsForDate(date: string): Promise<PaymentWithItems[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('*, payment_items(*)')
    .eq('payment_date', date);
  if (error) throw error;
  return (data ?? []) as PaymentWithItems[];
}

export async function upsertPayment(params: {
  student_id: string;
  payment_date: string;
  recorded_by: string;
  paid_amount: number;
  note: string | null;
  items: UpsertItem[];
}): Promise<string> {
  const { data, error } = await supabase.rpc('upsert_payment_with_items', {
    p_student_id:   params.student_id,
    p_payment_date: params.payment_date,
    p_recorded_by:  params.recorded_by,
    p_paid_amount:  Math.max(0, Math.round(params.paid_amount)),
    p_note:         params.note,
    p_items:        params.items,
  } as never);
  if (error) throw error;
  return String(data);
}

export async function bulkCreatePayments(params: {
  student_ids: string[];
  payment_date: string;
  recorded_by: string;
  pay_full: boolean;
  note: string | null;
  items: UpsertItem[];
}): Promise<{ created: number; merged: number }> {
  const { data, error } = await supabase.rpc('bulk_create_payments', {
    p_student_ids:  params.student_ids,
    p_payment_date: params.payment_date,
    p_recorded_by:  params.recorded_by,
    p_pay_full:     params.pay_full,
    p_note:         params.note,
    p_items:        params.items,
  } as never);
  if (error) throw error;
  const result = data as { created: number; merged: number } | null;
  return result ?? { created: 0, merged: 0 };
}

export interface PaymentListItem extends PaymentWithItems {
  students: { name_kh: string; grade: string | null } | null;
  profiles: { full_name: string } | null;
}

export async function listPaymentsHistory(opts: {
  status?: 'all' | 'paid' | 'partial' | 'unpaid';
  from?: string;
  to?: string;
} = {}): Promise<PaymentListItem[]> {
  let q = supabase
    .from('payments')
    .select('*, students(name_kh, grade), payment_items(*), profiles(full_name)')
    .order('created_at', { ascending: false });

  if (opts.from) q = q.gte('payment_date', opts.from);
  if (opts.to) q = q.lte('payment_date', opts.to);

  if (opts.status === 'paid') {
    q = q.eq('is_paid', true);
  } else if (opts.status === 'unpaid') {
    q = q.eq('is_paid', false).eq('paid_amount', 0);
  } else if (opts.status === 'partial') {
    q = q.eq('is_paid', false).gt('paid_amount', 0);
  }

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as PaymentListItem[];
}

export async function markPaymentPaid(payment_id: string, amount: number): Promise<void> {
  const { error } = await supabase.rpc('mark_payment_paid', {
    p_payment_id: payment_id,
    p_amount: Math.max(1, Math.round(amount)),
  } as never);
  if (error) throw error;
}

export async function countOutstanding(): Promise<number> {
  const { count, error } = await supabase
    .from('payments')
    .select('payment_id', { count: 'exact', head: true })
    .eq('is_paid', false);
  if (error) throw error;
  return count ?? 0;
}

export async function listPaymentsInRange(
  from: string, to: string,
): Promise<PaymentWithItems[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('*, payment_items(*)')
    .gte('payment_date', from)
    .lte('payment_date', to)
    .order('payment_date', { ascending: true });
  if (error) throw error;
  return (data ?? []) as PaymentWithItems[];
}