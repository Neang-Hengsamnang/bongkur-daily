import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from './ui/Modal';
import { useToast } from './ui/Toast';
import { useAuth } from '../context/AuthContext';
import { riel } from '../lib/format';
import {
  todayIso, upsertPayment, replacePaymentItems,
  type PaymentWithItems,
} from '../lib/api/payments';
import type { Student } from '../lib/api/students';
import type { Course } from '../lib/api/courses';

type Mode = 'full' | 'partial' | 'later';

interface DraftItem {
  key: string;
  course_id: string;
  hours: number;
}

interface Props {
  open: boolean;
  student: Student | null;
  courses: Course[];
  existing: PaymentWithItems | null;
  defaultDate: string;
  onClose: () => void;
  onSaved: () => void;
}

let keyCounter = 0;
const nextKey = () => `d${++keyCounter}`;

export default function PaymentEntryModal({
  open, student, courses, existing, defaultDate, onClose, onSaved,
}: Props) {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const toast = useToast();

  const [date, setDate] = useState(defaultDate);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [mode, setMode] = useState<Mode>('full');
  const [partialAmount, setPartialAmount] = useState<number>(0);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const isEditing = Boolean(existing);

  const activeCourses = useMemo(
    () => courses.filter((c) => c.status === 'active'),
    [courses],
  );

  const courseMap = useMemo(() => {
    const m = new Map<string, Course>();
    for (const c of courses) m.set(c.course_id, c);
    return m;
  }, [courses]);

  useEffect(() => {
    if (!open || !student) return;

    if (existing && existing.payment_items.length > 0) {
      // Edit mode: preload the existing line items into the cards
      setItems(
        existing.payment_items.map((it) => ({
          key: nextKey(),
          course_id: it.course_id,
          hours: it.hours,
        })),
      );
      setDate(existing.payment_date);
      setNote(existing.note ?? '');
      setPartialAmount(existing.paid_amount);
      setMode('full');      // default to Pay Full when editing
    } else {
      // New payment: default course ×1
      const defaultCourse =
        courses.find((c) => c.course_id === student.course && c.status === 'active')
        ?? activeCourses[0];
      setItems(
        defaultCourse
          ? [{ key: nextKey(), course_id: defaultCourse.course_id, hours: 1 }]
          : [],
      );
      setDate(defaultDate);
      setNote('');
      setPartialAmount(0);
      setMode('full');
    }
    setErr(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, student?.student_id, existing?.payment_id, defaultDate]);

  const previewTotal = useMemo(() => {
    let sum = 0;
    for (const it of items) {
      const c = courseMap.get(it.course_id);
      if (c && it.hours > 0) sum += c.hourly_fee * it.hours;
    }
    return sum;
  }, [items, courseMap]);

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
    if (!student || !profile) return;

    const cleaned = items
      .filter((i) => i.course_id && i.hours > 0)
      .map((i) => ({ course_id: i.course_id, hours: Math.round(i.hours) }));

    if (cleaned.length === 0) { setErr(t('payments_entry_error_no_items')); return; }

    let paidAmountToSave = 0;
    if (mode === 'full') paidAmountToSave = previewTotal;
    else if (mode === 'partial') {
      if (!Number.isFinite(partialAmount) || partialAmount < 0) {
        setErr(t('payments_entry_error_partial_amount'));
        return;
      }
      paidAmountToSave = Math.min(Math.round(partialAmount), previewTotal);
    }
    // later = 0

    setSaving(true);
    try {
      if (existing) {
        await replacePaymentItems({
          payment_id: existing.payment_id,
          items: cleaned,
          paid_amount: paidAmountToSave,
          note: note.trim() || null,
        });
        toast.success(t('payments_entry_updated'));
      } else {
        await upsertPayment({
          student_id: student.student_id,
          payment_date: date,
          recorded_by: profile.user_id,
          paid_amount: paidAmountToSave,
          note: note.trim() || null,
          items: cleaned,
        });
        toast.success(t('payments_entry_saved'));
      }
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => { if (!saving) onClose(); }}
      title={
        student
          ? `${student.name_kh} · ${student.student_id}`
          : t('payments_entry_title')
      }
      maxWidth="max-w-2xl"
      mobileSheet
      footer={
        <>
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
          >
            {t('action_cancel')}
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {saving
              ? t('saving')
              : isEditing
                ? t('payments_entry_update')
                : t('payments_entry_save')}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Editing info bar */}
        {existing && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {t('payments_entry_editing_today', {
              total: riel(existing.total_amount),
              paid: riel(existing.paid_amount),
            })}
          </div>
        )}

        {/* Course cards */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-xs font-medium text-slate-600">
              {isEditing
                ? t('payments_entry_edit_items_title')
                : t('payments_entry_new_items_title')}
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
                const hours = draftItem?.hours ?? 0;
                const subtotal = c.hourly_fee * hours;

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
                            aria-label={t('payments_entry_col_hours')}
                          >
                            −
                          </button>
                          <span className="min-w-[2ch] text-center text-sm font-semibold tabular-nums text-slate-800">
                            {hours}
                          </span>
                          <button
                            type="button"
                            onClick={() => incrementCourse(c.course_id)}
                            className="flex h-7 w-7 items-center justify-center rounded text-base font-semibold text-slate-600 hover:bg-slate-100"
                            aria-label={t('payments_entry_col_hours')}
                          >
                            +
                          </button>
                        </div>
                        <div className="text-right text-[11px] font-semibold text-emerald-800 tabular-nums">
                          {riel(subtotal)}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-3 flex items-center justify-between rounded-md bg-gradient-to-r from-brand-500 to-brand-700 px-4 py-2.5 text-white">
            <span className="text-xs uppercase tracking-wide opacity-90">
              {t('payments_entry_total')}
            </span>
            <span className="text-lg font-semibold tabular-nums">{riel(previewTotal)}</span>
          </div>
        </div>

        {/* Date + Mode */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              {t('payments_entry_date')}
            </label>
            <input
              type="date"
              value={date}
              max={todayIso()}
              onChange={(e) => setDate(e.target.value)}
              disabled={isEditing}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100 disabled:text-slate-500"
            />
            {isEditing && (
              <p className="mt-1 text-[10px] text-slate-500">
                {t('payments_entry_date_locked')}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              {t('payments_entry_mode')}
            </label>
            <div className="flex gap-1 rounded-md border border-slate-200 bg-slate-50 p-1">
              {(['full', 'partial', 'later'] as Mode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={
                    'flex flex-1 items-center justify-center rounded px-2 py-1.5 text-center text-xs font-medium leading-tight ' +
                    (mode === m
                      ? 'bg-white text-brand-700 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700')
                  }
                >
                  {t(`payments_entry_mode_${m}`)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {mode === 'partial' && (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              {t('payments_entry_paid_so_far')}
            </label>
            <input
              type="number"
              min={0}
              max={previewTotal}
              step={100}
              inputMode="numeric"
              value={partialAmount}
              onChange={(e) => setPartialAmount(Number(e.target.value))}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm tabular-nums"
            />
            <p className="mt-1 text-xs text-slate-500">
              {t('payments_entry_after_payment', {
                amount: riel(previewTotal - Math.min(partialAmount, previewTotal)),
              })}
            </p>
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            {t('payments_entry_note')}
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            rows={2}
            placeholder={t('payments_entry_note_placeholder')}
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