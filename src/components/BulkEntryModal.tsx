import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from './ui/Modal';
import { useToast } from './ui/Toast';
import { useAuth } from '../context/AuthContext';
import { riel } from '../lib/format';
import { todayIso, bulkCreatePayments } from '../lib/api/payments';
import type { Student } from '../lib/api/students';
import type { Course } from '../lib/api/courses';

type Mode = 'full' | 'later';

interface DraftItem {
  key: string;
  course_id: string;
  hours: number;
}

interface Props {
  open: boolean;
  students: Student[];
  courses: Course[];
  defaultDate: string;
  onClose: () => void;
  onSaved: (result: { created: number; merged: number }) => void;
}

let keyCounter = 0;
const nextKey = () => `b${++keyCounter}`;

export default function BulkEntryModal({
  open, students, courses, defaultDate, onClose, onSaved,
}: Props) {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const toast = useToast();

  const [date, setDate] = useState(defaultDate);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [mode, setMode] = useState<Mode>('full');
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
    if (!open) return;

    // Preselect only when EVERY selected student shares the same default course,
    // and that course is currently active.
    let preselect: DraftItem[] = [];
    if (students.length > 0) {
      const sharedCourseIds = new Set(students.map((s) => s.course));
      if (sharedCourseIds.size === 1) {
        const sharedCourseId = [...sharedCourseIds][0];
        const sharedCourse = activeCourses.find((c) => c.course_id === sharedCourseId);
        if (sharedCourse) {
          preselect = [{ key: nextKey(), course_id: sharedCourse.course_id, hours: 1 }];
        }
      }
    }

    setDate(defaultDate);
    setItems(preselect);
    setMode('full');
    setNote('');
    setErr(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultDate]);

  const perStudentTotal = useMemo(() => {
    let sum = 0;
    for (const it of items) {
      const c = courseMap.get(it.course_id);
      if (c && it.hours > 0) sum += c.hourly_fee * it.hours;
    }
    return sum;
  }, [items, courseMap]);

  const grandTotal = perStudentTotal * students.length;

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
        // hours === 1 → drop the item
      }
      return next;
    });
  };

  const onSave = async () => {
    setErr(null);
    if (!profile || students.length === 0) return;

    const cleaned = items
      .filter((i) => i.course_id && i.hours > 0)
      .map((i) => ({ course_id: i.course_id, hours: Math.round(i.hours) }));

    if (cleaned.length === 0) {
      setErr(t('payments_entry_error_no_items'));
      return;
    }

    setSaving(true);
    try {
      const result = await bulkCreatePayments({
        student_ids: students.map((s) => s.student_id),
        payment_date: date,
        recorded_by: profile.user_id,
        pay_full: mode === 'full',
        note: note.trim() || null,
        items: cleaned,
      });
      toast.success(
        t('payments_bulk_saved', { created: result.created, merged: result.merged }),
      );
      onSaved(result);
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
      title={t('payments_bulk_title')}
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
            disabled={saving || students.length === 0}
            className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {saving ? t('saving') : t('payments_bulk_save', { count: students.length })}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Subtitle */}
        <p className="text-sm text-slate-600">
          {t('payments_bulk_subtitle', { count: students.length })}
        </p>

        {/* Student chips */}
        <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto rounded-md border border-slate-200 bg-slate-50 p-2">
          {students.map((s) => (
            <span
              key={s.student_id}
              className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-xs text-slate-700 shadow-sm"
            >
              {s.name_kh}
              <span className="font-mono text-[10px] text-slate-400">{s.student_id}</span>
            </span>
          ))}
        </div>

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

          {items.length === 0 && students.length > 0 && (
            <p className="mb-2 rounded-md bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
              {t('payments_bulk_no_shared_course', { count: students.length })}
            </p>
          )}

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
                    {/* Course name */}
                    <div className="mb-1.5 pb-0.5 text-sm leading-relaxed text-slate-800 line-clamp-2">
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

                        {/* Subtotal for one student */}
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

          {/* Totals banner */}
          <div className="mt-3 flex items-center justify-between rounded-md bg-gradient-to-r from-brand-500 to-brand-700 px-4 py-2.5 text-white">
            <div>
              <div className="text-[10px] uppercase tracking-wide opacity-90">
                {t('payments_bulk_per_student')}
              </div>
              <div className="text-[10px] opacity-75">
                {t('payments_bulk_grand_total', { count: students.length })}
              </div>
            </div>
            <div className="text-right">
              <div className="text-base font-semibold tabular-nums">{riel(perStudentTotal)}</div>
              <div className="text-xs opacity-90 tabular-nums">{riel(grandTotal)}</div>
            </div>
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
              {(['full', 'later'] as Mode[]).map((m) => (
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

        {/* Note */}
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