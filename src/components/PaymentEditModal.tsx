import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from './ui/Modal';
import { useToast } from './ui/Toast';
import { riel } from '../lib/format';
import {
  replacePaymentItems,
  deletePayment,
  type PaymentListItem,
} from '../lib/api/payments';
import type { Course } from '../lib/api/courses';

interface DraftItem {
  key: string;
  course_id: string;
  hours: number;
}

interface Props {
  open: boolean;
  payment: PaymentListItem | null;
  courses: Course[];
  canDelete: boolean;
  onClose: () => void;
  onSaved: () => void;
}

let keyCounter = 0;
const nextKey = () => `e${++keyCounter}`;

export default function PaymentEditModal({
  open, payment, courses, canDelete, onClose, onSaved,
}: Props) {
  const { t } = useTranslation();
  const toast = useToast();

  const [items, setItems] = useState<DraftItem[]>([]);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const activeCourses = useMemo(
    () => courses.filter((c) => c.status === 'active'),
    [courses],
  );

  const courseMap = useMemo(() => {
    const m = new Map<string, Course>();
    for (const c of courses) m.set(c.course_id, c);
    return m;
  }, [courses]);

  // Seed from the payment every time the modal opens
  useEffect(() => {
    if (!open || !payment) return;
    setItems(
      payment.payment_items.map((it) => ({
        key: nextKey(),
        course_id: it.course_id,
        hours: it.hours,
      })),
    );
    setPaidAmount(payment.paid_amount);
    setNote(payment.note ?? '');
    setErr(null);
  }, [open, payment]);

  const newTotal = useMemo(() => {
    let sum = 0;
    for (const it of items) {
      const c = courseMap.get(it.course_id);
      if (c && it.hours > 0) sum += c.hourly_fee * it.hours;
    }
    return sum;
  }, [items, courseMap]);

  // Adjust paid amount to never exceed the new total
  useEffect(() => {
    if (paidAmount > newTotal) setPaidAmount(newTotal);
  }, [newTotal, paidAmount]);

  const addCourse = (courseId: string) => {
    if (items.some((i) => i.course_id === courseId)) return;
    setItems((prev) => [...prev, { key: nextKey(), course_id: courseId, hours: 1 }]);
  };

  const incrementCourse = (courseId: string) => {
    setItems((prev) =>
      prev.map((i) => (i.course_id === courseId ? { ...i, hours: i.hours + 1 } : i)),
    );
  };

  const decrementCourse = (courseId: string) => {
    setItems((prev) => {
      const next: DraftItem[] = [];
      for (const i of prev) {
        if (i.course_id !== courseId) next.push(i);
        else if (i.hours > 1) next.push({ ...i, hours: i.hours - 1 });
      }
      return next;
    });
  };

  const onSave = async () => {
    setErr(null);
    if (!payment) return;

    if (items.length === 0) { setErr(t('payments_entry_error_no_items')); return; }

    const cleaned = items
      .filter((i) => i.course_id && i.hours > 0)
      .map((i) => ({ course_id: i.course_id, hours: Math.round(i.hours) }));

    setSaving(true);
    try {
      await replacePaymentItems({
        payment_id: payment.payment_id,
        items: cleaned,
        paid_amount: paidAmount,
        note: note.trim() || null,
      });
      toast.success(t('payments_edit_saved'));
      onSaved();
    } catch (e) {
      const code = (e as Error).message;
      const map: Record<string, string> = {
        DUPLICATE_COURSES: t('payments_edit_error_duplicate'),
        INVALID_HOURS:     t('payments_entry_error_hours'),
        NO_ITEMS:          t('payments_entry_error_no_items'),
      };
      setErr(map[code] ?? code);
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!payment || !canDelete) return;
    const ok = window.confirm(
      t('payments_edit_delete_confirm', {
        name: payment.students?.name_kh ?? '',
        date: payment.payment_date,
      }),
    );
    if (!ok) return;

    setDeleting(true);
    try {
      await deletePayment(payment.payment_id);
      toast.success(t('payments_edit_deleted'));
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  const status: 'paid' | 'partial' | 'unpaid' =
    newTotal > 0 && paidAmount >= newTotal ? 'paid'
    : paidAmount > 0 ? 'partial'
    : 'unpaid';

  const busy = saving || deleting;

  return (
    <Modal
      open={open}
      onClose={() => { if (!busy) onClose(); }}
      title={
        payment
          ? `${t('payments_edit_title')} · ${payment.payment_id}`
          : t('payments_edit_title')
      }
      maxWidth="max-w-2xl"
      mobileSheet
      footer={
        <>
          {canDelete && (
            <button
              onClick={onDelete}
              disabled={busy}
              className="mr-auto rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800 hover:bg-rose-100 disabled:opacity-50"
            >
              {deleting ? t('saving') : t('action_delete')}
            </button>
          )}
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
          >
            {t('action_cancel')}
          </button>
          <button
            onClick={onSave}
            disabled={busy}
            className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {saving ? t('saving') : t('action_save')}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Header info */}
        {payment && (
          <div className="grid grid-cols-2 gap-3 rounded-md bg-slate-50 p-3 text-sm">
            <div>
              <div className="text-[10px] uppercase text-slate-500">
                {t('payments_col_student')}
              </div>
              <div className="font-medium">
                {payment.students?.name_kh ?? '—'}
                <span className="ml-1 font-mono text-[10px] text-slate-400">
                  {payment.student_id}
                </span>
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-slate-500">
                {t('payments_col_date')}
              </div>
              <div className="font-medium tabular-nums">{payment.payment_date}</div>
            </div>
          </div>
        )}

        {/* Course cards */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-xs font-medium text-slate-600">
              {t('payments_edit_items_title')}
            </label>
            <span className="text-[10px] text-slate-400">
              {t('payments_entry_tap_to_add')}
            </span>
          </div>

          {activeCourses.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">
              {t('payments_entry_no_courses')}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {activeCourses.map((c) => {
                const draftItem = items.find((i) => i.course_id === c.course_id);
                const isSelected = Boolean(draftItem);
                const newHours = draftItem?.hours ?? 0;
                const newSubtotal = c.hourly_fee * newHours;

                return (
                  <div
                    key={c.course_id}
                    onClick={() => { if (!isSelected) addCourse(c.course_id); }}
                    className={
                      'relative flex min-h-[124px] flex-col rounded-lg border p-3 transition select-none ' +
                      (isSelected
                        ? 'border-emerald-300 bg-emerald-50'
                        : 'cursor-pointer border-slate-200 bg-white hover:border-brand-500 hover:shadow-sm active:scale-[0.98]')
                    }
                  >
                    <div className="mb-1.5 pb-0.5 text-sm leading-relaxed text-slate-800 line-clamp-2">
                      {c.name_kh}
                    </div>

                    {!isSelected ? (
                      <div className="mt-auto text-[11px] text-slate-500 tabular-nums">
                        {riel(c.hourly_fee)}/h
                      </div>
                    ) : (
                      <div className="mt-auto space-y-1.5">
                        <div
                          className="flex items-center justify-between gap-1 rounded-md border border-emerald-200 bg-white p-0.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => decrementCourse(c.course_id)}
                            className="flex h-7 w-7 items-center justify-center rounded text-base font-semibold text-slate-600 hover:bg-slate-100"
                          >
                            −
                          </button>
                          <span className="min-w-[2ch] text-center text-sm font-semibold tabular-nums text-slate-800">
                            {newHours}
                          </span>
                          <button
                            type="button"
                            onClick={() => incrementCourse(c.course_id)}
                            className="flex h-7 w-7 items-center justify-center rounded text-base font-semibold text-slate-600 hover:bg-slate-100"
                          >
                            +
                          </button>
                        </div>
                        <div className="text-right text-[11px] font-semibold text-emerald-800 tabular-nums">
                          {riel(newSubtotal)}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Totals + paid amount */}
        <div className="rounded-md bg-gradient-to-r from-brand-500 to-brand-700 px-4 py-3 text-white">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wide opacity-90">
              {t('payments_edit_new_total')}
            </span>
            <span className="text-lg font-semibold tabular-nums">{riel(newTotal)}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              {t('payments_edit_paid_amount')}
            </label>
            <input
              type="number"
              min={0}
              max={newTotal}
              step={100}
              inputMode="numeric"
              value={paidAmount}
              onChange={(e) => setPaidAmount(Number(e.target.value))}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm tabular-nums"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              {t('payments_col_status')}
            </label>
            <div className="flex h-[38px] items-center">
              <span
                className={
                  'rounded-full px-3 py-1 text-xs font-medium ' +
                  (status === 'paid'
                    ? 'bg-emerald-100 text-emerald-800'
                    : status === 'partial'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-rose-100 text-rose-800')
                }
              >
                {t(`payments_status_${status}`)}
              </span>
            </div>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            {t('payments_entry_note')}
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            rows={2}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        {err && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{err}</div>
        )}
      </div>
    </Modal>
  );
}