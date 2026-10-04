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
    const first = activeCourses[0];
    setDate(defaultDate);
    setItems(first ? [{ key: nextKey(), course_id: first.course_id, hours: 1 }] : []);
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

  const addRow = () => {
    const used = new Set(items.map((i) => i.course_id));
    const next = activeCourses.find((c) => !used.has(c.course_id)) ?? activeCourses[0];
    if (!next) return;
    setItems((prev) => [...prev, { key: nextKey(), course_id: next.course_id, hours: 1 }]);
  };

  const updateRow = (key: string, patch: Partial<DraftItem>) => {
    setItems((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const removeRow = (key: string) => {
    setItems((prev) => prev.filter((r) => r.key !== key));
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
      footer={
        <>
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            {t('action_cancel')}
          </button>
          <button
            onClick={onSave}
            disabled={saving || students.length === 0}
            className="rounded-md bg-brand-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {saving ? t('saving') : t('payments_bulk_save', { count: students.length })}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          {t('payments_bulk_subtitle', { count: students.length })}
        </p>

        <div className="flex flex-wrap gap-1.5 rounded-md border border-slate-200 bg-slate-50 p-2">
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

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-xs font-medium text-slate-600">
              {t('payments_entry_new_items_title')}
            </label>
            <button
              type="button"
              onClick={addRow}
              disabled={activeCourses.length === 0}
              className="rounded-md border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-50"
            >
              + {t('payments_entry_add_course')}
            </button>
          </div>

          <div className="overflow-hidden rounded-md border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-1.5">{t('payments_entry_col_course')}</th>
                  <th className="w-20 px-2 py-1.5 text-right">{t('payments_entry_col_hours')}</th>
                  <th className="w-28 px-2 py-1.5 text-right">{t('payments_entry_col_fee')}</th>
                  <th className="w-28 px-2 py-1.5 text-right">{t('payments_entry_col_subtotal')}</th>
                  <th className="w-10 px-2 py-1.5" />
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-4 text-center text-xs text-slate-500">
                      {t('payments_entry_no_items')}
                    </td>
                  </tr>
                ) : items.map((row) => {
                  const course = courseMap.get(row.course_id);
                  const subtotal = course ? course.hourly_fee * (row.hours || 0) : 0;
                  return (
                    <tr key={row.key} className="border-t border-slate-100">
                      <td className="px-3 py-1.5">
                        <select
                          value={row.course_id}
                          onChange={(e) => updateRow(row.key, { course_id: e.target.value })}
                          className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm"
                        >
                          {activeCourses.map((c) => (
                            <option key={c.course_id} value={c.course_id}>
                              {c.name_kh}{c.name_en ? ` (${c.name_en})` : ''}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={row.hours}
                          onChange={(e) =>
                            updateRow(row.key, { hours: Number(e.target.value) })
                          }
                          className="w-full rounded-md border border-slate-200 px-2 py-1 text-right text-sm tabular-nums"
                        />
                      </td>
                      <td className="px-2 py-1.5 text-right text-xs text-slate-500 tabular-nums">
                        {course ? riel(course.hourly_fee) : '—'}
                      </td>
                      <td className="px-2 py-1.5 text-right text-sm tabular-nums">
                        {riel(subtotal)}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <button
                          type="button"
                          onClick={() => removeRow(row.key)}
                          className="text-slate-400 hover:text-red-600"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex items-center justify-between rounded-md bg-gradient-to-r from-brand-500 to-brand-700 px-4 py-2.5 text-white">
            <div>
              <div className="text-xs uppercase tracking-wide opacity-90">
                {t('payments_bulk_per_student')}
              </div>
              <div className="text-xs opacity-80">
                {t('payments_bulk_grand_total', { count: students.length })}
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-semibold tabular-nums">{riel(perStudentTotal)}</div>
              <div className="text-xs opacity-90 tabular-nums">{riel(grandTotal)}</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
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
                    'flex-1 rounded px-2 py-1 text-xs font-medium ' +
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