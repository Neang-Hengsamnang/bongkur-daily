import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from './ui/Modal';
import { useToast } from './ui/Toast';
import { useAuth } from '../context/AuthContext';
import { riel } from '../lib/format';
import { todayIso, upsertPayment, type PaymentWithItems } from '../lib/api/payments';
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
    const defaultCourse =
      courses.find((c) => c.course_id === student.course && c.status === 'active')
      ?? activeCourses[0];

    setDate(defaultDate);
    setItems(
      defaultCourse
        ? [{ key: nextKey(), course_id: defaultCourse.course_id, hours: 1 }]
        : [],
    );
    setMode('full');
    setPartialAmount(0);
    setNote('');
    setErr(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, student?.student_id, defaultDate]);

  const previewTotal = useMemo(() => {
    let sum = 0;
    for (const it of items) {
      const c = courseMap.get(it.course_id);
      if (c && it.hours > 0) sum += c.hourly_fee * it.hours;
    }
    return sum;
  }, [items, courseMap]);

  // Pre-computed map: existing hours per course (from today's paid record)
  const existingHoursByCourse = useMemo(() => {
    const m = new Map<string, number>();
    if (!existing) return m;
    for (const it of existing.payment_items) {
      m.set(it.course_id, (m.get(it.course_id) ?? 0) + it.hours);
    }
    return m;
  }, [existing]);

  const addCourse = (courseId: string) => {
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
        if (i.course_id !== courseId) {
          next.push(i);
        } else if (i.hours > 1) {
          next.push({ ...i, hours: i.hours - 1 });
        }
        // hours === 1 → drop the item (card returns to unselected)
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
    if (cleaned.some((i) => i.hours < 1)) { setErr(t('payments_entry_error_hours')); return; }

    let paidAmount = 0;
    if (mode === 'full') paidAmount = previewTotal;
    else if (mode === 'partial') {
      if (!Number.isFinite(partialAmount) || partialAmount <= 0) {
        setErr(t('payments_entry_error_partial_amount'));
        return;
      }
      paidAmount = Math.min(Math.round(partialAmount), previewTotal);
    }

    setSaving(true);
    try {
      await upsertPayment({
        student_id: student.student_id,
        payment_date: date,
        recorded_by: profile.user_id,
        paid_amount: paidAmount,
        note: note.trim() || null,
        items: cleaned,
      });
      toast.success(t('payments_entry_saved'));
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
            {saving ? t('saving') : t('payments_entry_save')}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Existing payment banner */}
        {existing && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-medium text-emerald-800">
                ✓ {t('payments_entry_existing_title')}
              </div>
              <div className="shrink-0 text-xs text-emerald-700 tabular-nums">
                {riel(existing.total_amount)} / {riel(existing.paid_amount)}
              </div>
            </div>
            <ul className="mt-2 space-y-0.5 text-xs text-emerald-900">
              {existing.payment_items.map((it) => (
                <li key={it.item_id} className="flex justify-between gap-2">
                  <span className="truncate">
                    {it.course_name_at_time} · {it.hours}h × {riel(it.hourly_fee_at_time)}
                  </span>
                  <span className="shrink-0 tabular-nums">{riel(it.subtotal)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Course cards */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-xs font-medium text-slate-600">
              {t('payments_entry_new_items_title')}
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
                const existingHrs = existingHoursByCourse.get(c.course_id) ?? 0;

                return (
                  <div
                    key={c.course_id}
                    onClick={() => { if (!isSelected) addCourse(c.course_id); }}
                    className={
                      'relative flex min-h-[104px] flex-col rounded-lg border p-2.5 transition select-none ' +
                      (isSelected
                        ? 'border-emerald-300 bg-emerald-50'
                        : 'cursor-pointer border-slate-200 bg-white hover:border-brand-500 hover:shadow-sm active:scale-[0.98]')
                    }
                  >
                    {/* Existing-paid badge */}
                    {existingHrs > 0 && (
                      <span
                        className={
                          'absolute right-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-medium leading-none ' +
                          (isSelected
                            ? 'bg-emerald-200 text-emerald-800'
                            : 'bg-emerald-100 text-emerald-700')
                        }
                      >
                        ✓ {existingHrs}h
                      </span>
                    )}

                    {/* Course name */}
                    <div className="mb-2 pr-11 text-xs font-medium leading-snug text-slate-800 line-clamp-2">
                      {c.name_kh}
                    </div>

                    {!isSelected ? (
                      <div className="mt-auto text-[11px] text-slate-500 tabular-nums">
                        {riel(c.hourly_fee)}/h
                      </div>
                    ) : (
                      <div className="mt-auto space-y-1.5">
                        {/* Hours stepper */}
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
                            {newHours}
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

                        {/* Subtotal */}
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

          {/* Total banner */}
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
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
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
              {t('payments_entry_partial_amount')}
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