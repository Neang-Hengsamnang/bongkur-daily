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
    if (!student || !profile) return;

    const cleaned = items
      .filter((i) => i.course_id && i.hours > 0)
      .map((i) => ({ course_id: i.course_id, hours: Math.round(i.hours) }));

    if (cleaned.length === 0) {
      setErr(t('payments_entry_error_no_items'));
      return;
    }
    if (cleaned.some((i) => i.hours < 1)) {
      setErr(t('payments_entry_error_hours'));
      return;
    }

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

  const showPartialInput = mode === 'partial';

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
            disabled={saving}
            className="rounded-md bg-brand-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {saving ? t('saving') : t('payments_entry_save')}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {existing && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-emerald-800">
                ✓ {t('payments_entry_existing_title')}
              </div>
              <div className="text-xs text-emerald-700">
                {t('payments_entry_existing_total')}: {riel(existing.total_amount)} ·{' '}
                {t('payments_entry_existing_paid')}: {riel(existing.paid_amount)}
              </div>
            </div>
            <ul className="mt-2 space-y-0.5 text-xs text-emerald-900">
              {existing.payment_items.map((it) => (
                <li key={it.item_id} className="flex justify-between">
                  <span>
                    {it.course_name_at_time} · {it.hours}h × {riel(it.hourly_fee_at_time)}
                  </span>
                  <span className="tabular-nums">{riel(it.subtotal)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

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
                          title={t('payments_entry_remove')}
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
            <span className="text-xs uppercase tracking-wide opacity-90">
              {t('payments_entry_total')}
            </span>
            <span className="text-lg font-semibold tabular-nums">{riel(previewTotal)}</span>
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
              {(['full', 'partial', 'later'] as Mode[]).map((m) => (
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

        {showPartialInput && (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              {t('payments_entry_partial_amount')}
            </label>
            <input
              type="number"
              min={0}
              max={previewTotal}
              step={100}
              value={partialAmount}
              onChange={(e) => setPartialAmount(Number(e.target.value))}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm tabular-nums"
            />
            <p className="mt-1 text-xs text-slate-500">
              {t('payments_entry_after_payment', { amount: riel(previewTotal - Math.min(partialAmount, previewTotal)) })}
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