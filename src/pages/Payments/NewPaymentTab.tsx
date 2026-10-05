import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../components/ui/Toast';
import { riel } from '../../lib/format';
import { listStudents, type Student } from '../../lib/api/students';
import { listCourses, type Course } from '../../lib/api/courses';
import {
  listPaymentsForDate, todayIso,
  type PaymentWithItems,
} from '../../lib/api/payments';
import PaymentEntryModal from '../../components/PaymentEntryModal';
import BulkEntryModal from '../../components/BulkEntryModal';

export default function NewPaymentTab() {
  const { t } = useTranslation();
  const toast = useToast();

  const [date, setDate] = useState<string>(todayIso());
  const [grade, setGrade] = useState<string>('');
  const [search, setSearch] = useState<string>('');

  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [payments, setPayments] = useState<PaymentWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [modalOpen, setModalOpen] = useState(false);
  const [modalStudent, setModalStudent] = useState<Student | null>(null);

  const [bulkOpen, setBulkOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cs = await listCourses({ status: 'all' });
        if (!cancelled) setCourses(cs);
      } catch (e) {
        toast.error((e as Error).message);
      }
    })();
    return () => { cancelled = true; };
  }, [toast]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [ss, ps] = await Promise.all([
          listStudents({ status: 'active' }),
          listPaymentsForDate(date),
        ]);
        if (!cancelled) {
          setStudents(ss);
          setPayments(ps);
          setSelectedIds(new Set());
        }
      } catch (e) {
        if (!cancelled) toast.error((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [date, reloadKey, toast]);

  const reload = () => setReloadKey((k) => k + 1);

  const paymentByStudent = useMemo(() => {
    const m = new Map<string, PaymentWithItems>();
    for (const p of payments) m.set(p.student_id, p);
    return m;
  }, [payments]);

  const gradeOptions = useMemo(() => {
    const set = new Set<string>();
    for (const s of students) if (s.grade) set.add(s.grade);
    return Array.from(set).sort();
  }, [students]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return students.filter((st) => {
      if (grade && st.grade !== grade) return false;
      if (!s) return true;
      return (
        st.name_kh.toLowerCase().includes(s) ||
        st.student_id.toLowerCase().includes(s)
      );
    });
  }, [students, grade, search]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const selectedStudents = useMemo(
    () => filtered.filter((s) => selectedIds.has(s.student_id)),
    [filtered, selectedIds],
  );

  const openFor = (st: Student) => {
    setModalStudent(st);
    setModalOpen(true);
  };

  return (
    <div className="space-y-4 pb-24">
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            {t('payments_filter_date')}
          </label>
          <input
            type="date"
            value={date}
            max={todayIso()}
            onChange={(e) => setDate(e.target.value || todayIso())}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            {t('payments_filter_grade')}
          </label>
          <select
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">{t('payments_filter_grade_all')}</option>
            {gradeOptions.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>

        <div className="min-w-[180px] flex-1">
          <label className="mb-1 block text-xs font-medium text-slate-600">
            {t('payments_search')}
          </label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('payments_search_placeholder')}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-slate-500">
            {t('payments_students_count', { count: filtered.length })}
          </span>
          <button
            type="button"
            onClick={reload}
            disabled={loading}
            title={t('action_refresh')}
            className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            ↻ <span className="hidden sm:inline">{t('action_refresh')}</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-md bg-white p-8 text-center text-slate-500">
          {t('loading')}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-md bg-white p-8 text-center text-slate-500">
          {t('payments_empty')}
        </div>
      ) : (
        <div
          className="gap-3"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))',
          }}
        >
          {filtered.map((st) => {
            const payment = paymentByStudent.get(st.student_id);
            const paid = payment?.is_paid ?? false;
            const partial = !paid && payment && payment.paid_amount > 0;
            const hasRecord = Boolean(payment);
            const isSelected = selectedIds.has(st.student_id);

            return (
              <div
                key={st.student_id}
                onClick={() => openFor(st)}
                className={
                  'group relative flex cursor-pointer flex-col rounded-lg border p-3 text-left transition ' +
                  (isSelected
                    ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500'
                    : hasRecord
                      ? 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100 hover:border-emerald-300'
                      : 'border-slate-200 bg-white hover:border-brand-500 hover:shadow-sm')
                }
              >
                <label
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-1 top-1 flex h-11 w-11 cursor-pointer items-center justify-center rounded-md transition hover:bg-white/60 active:scale-95"
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(st.student_id)}
                    className="h-5 w-5 cursor-pointer rounded border-slate-300 accent-brand-500"
                    aria-label={t('payments_bulk_select')}
                  />
                </label>

                <div className="flex items-start justify-between gap-1 pr-5">
                  <span className="text-sm font-medium text-slate-900 line-clamp-2">
                    {st.name_kh}
                  </span>
                  {hasRecord && !isSelected && <span className="text-emerald-600">✓</span>}
                </div>
                <span className="mt-0.5 font-mono text-[10px] text-slate-500">
                  {st.student_id}
                </span>

                {hasRecord && payment && (
                  <>
                    <div className="mt-2 text-sm font-semibold text-emerald-800 tabular-nums">
                      {riel(payment.total_amount)} &nbsp;&nbsp;
                        <span
                        className={
                          'mt-1 inline-block self-start rounded-full px-1.5 py-0.5 text-[10px] ' +
                          (paid
                            ? 'bg-emerald-200 text-emerald-900'
                            : partial
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-200 text-slate-700')
                        }
                      >
                        {paid
                          ? t('payments_status_paid')
                          : partial
                            ? t('payments_status_partial')
                            : t('payments_status_unpaid')}
                      </span>
                    </div>
                    
                  </>
                )}

                {st.grade && (
                  <span className="mt-auto pt-2 text-[10px] text-slate-500">
                    {st.grade}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {selectedIds.size > 0 && (
        <div className="fixed inset-x-0 bottom-4 z-[1070] flex justify-center px-4">
          <div className="flex items-center gap-3 rounded-full bg-slate-900 px-4 py-2 text-white shadow-2xl">
            <span className="text-sm font-medium">
              {t('payments_bulk_selected', { count: selectedIds.size })}
            </span>
            <button
              type="button"
              onClick={clearSelection}
              className="rounded-full border border-white/20 px-3 py-1 text-xs hover:bg-white/10"
            >
              {t('payments_bulk_clear')}
            </button>
            <button
              type="button"
              onClick={() => setBulkOpen(true)}
              className="rounded-full bg-brand-500 px-4 py-1.5 text-xs font-medium hover:bg-brand-700"
            >
              {t('payments_bulk_record')}
            </button>
          </div>
        </div>
      )}

      <PaymentEntryModal
        open={modalOpen}
        student={modalStudent}
        courses={courses}
        existing={
          modalStudent ? paymentByStudent.get(modalStudent.student_id) ?? null : null
        }
        defaultDate={date}
        onClose={() => { setModalOpen(false); setModalStudent(null); }}
        onSaved={() => {
          setModalOpen(false);
          setModalStudent(null);
          reload();
        }}
      />

      <BulkEntryModal
        open={bulkOpen}
        students={selectedStudents}
        courses={courses}
        defaultDate={date}
        onClose={() => setBulkOpen(false)}
        onSaved={() => {
          setBulkOpen(false);
          clearSelection();
          reload();
        }}
      />
    </div>
  );
}