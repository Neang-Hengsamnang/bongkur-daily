import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../components/ui/Toast';
import { riel } from '../lib/format';
import {
  listStudents, setStudentStatus,
  type Student, type StudentStatus,
} from '../lib/api/students';
import { listCourses, type Course } from '../lib/api/courses';
import StudentFormModal from '../components/StudentFormModal';
import QRModal from '../components/QRModal';
import BulkQRModal from '../components/BulkQRModal';
import type { QrStudent } from '../lib/qr';

const STATUS_STYLES: Record<StudentStatus, string> = {
  active:    'bg-emerald-50 text-emerald-700',
  inactive:  'bg-slate-100 text-slate-500',
  graduated: 'bg-blue-50 text-blue-700',
  dropped:   'bg-red-50 text-red-700',
};

export default function Students() {
  const { t } = useTranslation();
  const toast = useToast();

  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [courseFilter, setCourseFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<StudentStatus | 'all'>('all');
  const [reloadKey, setReloadKey] = useState(0);

  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);

  const [qrOpen, setQrOpen] = useState(false);
  const [qrStudent, setQrStudent] = useState<QrStudent | null>(null);

  const [bulkQrOpen, setBulkQrOpen] = useState(false);

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
        const data = await listStudents({
          search,
          course: courseFilter || undefined,
          status: statusFilter,
        });
        if (!cancelled) {
          setStudents(data);
          setSelected(new Set());
        }
      } catch (e) {
        if (!cancelled) toast.error((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [search, courseFilter, statusFilter, reloadKey, toast]);

  const reload = () => setReloadKey((k) => k + 1);

  const courseMap = useMemo(() => {
    const m = new Map<string, Course>();
    for (const c of courses) m.set(c.course_id, c);
    return m;
  }, [courses]);

  const openAdd = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (s: Student) => { setEditing(s); setModalOpen(true); };

  const openQr = (s: Student) => {
    setQrStudent({
      student_id: s.student_id,
      name_kh: s.name_kh,
      grade: s.grade,
      portal_token: s.portal_token,
    });
    setQrOpen(true);
  };

  const onStatusChange = async (s: Student, status: StudentStatus) => {
    try {
      await setStudentStatus(s.student_id, status);
      toast.success(t('students_status_changed'));
      reload();
    } catch (e) {
      toast.error((e as Error).message);
      reload();
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) => {
      if (prev.size === students.length) return new Set();
      return new Set(students.map((s) => s.student_id));
    });
  };

  const selectedStudents: QrStudent[] = useMemo(
    () =>
      students
        .filter((s) => selected.has(s.student_id))
        .map((s) => ({
          student_id: s.student_id,
          name_kh: s.name_kh,
          grade: s.grade,
          portal_token: s.portal_token,
        })),
    [students, selected],
  );

  const allSelected = students.length > 0 && selected.size === students.length;

  return (
    <div className="space-y-4 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-heading text-slate-900">{t('students_title')}</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setBulkQrOpen(true)}
            disabled={selected.size === 0}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
          >
            {t('students_bulk_qr')}
            {selected.size > 0 ? ` (${selected.size})` : ''}
          </button>
          <button
            onClick={openAdd}
            className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            + {t('students_add')}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('students_search_placeholder')}
          className="w-full max-w-xs rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <select
          value={courseFilter}
          onChange={(e) => setCourseFilter(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">{t('students_filter_course_all')}</option>
          {courses.map((c) => (
            <option key={c.course_id} value={c.course_id}>{c.name_kh}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StudentStatus | 'all')}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="all">{t('students_filter_status_all')}</option>
          <option value="active">{t('student_status_active')}</option>
          <option value="inactive">{t('student_status_inactive')}</option>
          <option value="graduated">{t('student_status_graduated')}</option>
          <option value="dropped">{t('student_status_dropped')}</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="w-8 px-3 py-2">
                <label className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md hover:bg-slate-100">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="h-5 w-5 cursor-pointer accent-brand-500"
                    aria-label={t('students_select_all')}
                  />
                </label>
              </th>
              <th className="px-3 py-2">{t('students_col_id')}</th>
              <th className="px-3 py-2">{t('students_col_name_kh')}</th>
              <th className="px-3 py-2">{t('students_col_gender')}</th>
              <th className="px-3 py-2">{t('students_col_dob')}</th>
              <th className="px-3 py-2">{t('students_col_grade')}</th>
              <th className="px-3 py-2">{t('students_col_course')}</th>
              <th className="px-3 py-2">{t('students_col_status')}</th>
              <th className="px-3 py-2 text-right">{t('students_col_actions')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-slate-500">
                  {t('loading')}
                </td>
              </tr>
            ) : students.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-slate-500">
                  {t('students_empty')}
                </td>
              </tr>
            ) : students.map((s) => {
              const course = courseMap.get(s.course);
              const isSel = selected.has(s.student_id);
              return (
                <tr
                  key={s.student_id}
                  className={
                    'border-t border-slate-100 ' +
                    (isSel ? 'bg-brand-50' : '')
                  }
                >
                  <td className="px-3 py-2">
                    <label className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md hover:bg-slate-100">
                      <input
                        type="checkbox"
                        checked={isSel}
                        onChange={() => toggleSelect(s.student_id)}
                        className="h-5 w-5 cursor-pointer accent-brand-500"
                        aria-label={t('students_select_all')}
                      />
                    </label>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-500">{s.student_id}</td>
                  <td className="px-3 py-2">{s.name_kh}</td>
                  <td className="px-3 py-2 text-slate-600">
                    {s.gender ? t(`gender_${s.gender}`) : '—'}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{s.date_of_birth ?? '—'}</td>
                  <td className="px-3 py-2 text-slate-600">{s.grade ?? '—'}</td>
                  <td className="px-3 py-2">
                    {course ? course.name_kh : s.course}
                    {course && (
                      <span className="ml-1 text-xs text-slate-400">
                        {riel(course.hourly_fee)}/h
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLES[s.status]}`}>
                      {t(`student_status_${s.status}`)}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openQr(s)}
                        className="rounded-md border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50"
                        title={t('qr_single_title')}
                      >
                        📱 QR
                      </button>
                      <button
                        onClick={() => openEdit(s)}
                        className="rounded-md border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50"
                      >
                        {t('action_edit')}
                      </button>
                      <select
                        value={s.status}
                        onChange={(e) => onStatusChange(s, e.target.value as StudentStatus)}
                        className="rounded-md border border-slate-200 px-1 py-1 text-xs"
                        title={t('students_change_status')}
                      >
                        <option value="active">{t('student_status_active')}</option>
                        <option value="inactive">{t('student_status_inactive')}</option>
                        <option value="graduated">{t('student_status_graduated')}</option>
                        <option value="dropped">{t('student_status_dropped')}</option>
                      </select>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-4 z-[1070] flex justify-center px-4">
          <div className="flex items-center gap-3 rounded-full bg-slate-900 px-4 py-2 text-white shadow-2xl">
            <span className="text-sm font-medium">
              {t('students_selected_count', { count: selected.size })}
            </span>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="rounded-full border border-white/20 px-3 py-1 text-xs hover:bg-white/10"
            >
              {t('payments_bulk_clear')}
            </button>
            <button
              type="button"
              onClick={() => setBulkQrOpen(true)}
              className="rounded-full bg-brand-500 px-4 py-1.5 text-xs font-medium hover:bg-brand-700"
            >
              {t('students_bulk_qr')}
            </button>
          </div>
        </div>
      )}

      <StudentFormModal
        open={modalOpen}
        student={editing}
        courses={courses}
        onClose={() => setModalOpen(false)}
        onSaved={() => { setModalOpen(false); reload(); }}
      />

      <QRModal
        open={qrOpen}
        student={qrStudent}
        onClose={() => { setQrOpen(false); setQrStudent(null); }}
      />

      <BulkQRModal
        open={bulkQrOpen}
        students={selectedStudents}
        onClose={() => setBulkQrOpen(false)}
      />
    </div>
  );
}