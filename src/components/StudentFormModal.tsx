import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from './ui/Modal';
import { useToast } from './ui/Toast';
import { useAuth } from '../context/AuthContext';
import {
  createStudent, updateStudent,
  type Student, type StudentInput, type Gender, type StudentStatus,
} from '../lib/api/students';
import type { Course } from '../lib/api/courses';

const GRADE_SUGGESTIONS = [
  'Kindergarten',
  'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6',
  'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12',
];

interface Props {
  open: boolean;
  student: Student | null;
  courses: Course[];
  onClose: () => void;
  onSaved: () => void;
}

const emptyInput: StudentInput = {
  name_kh: '',
  gender: null,
  date_of_birth: null,
  grade: null,
  course: '',
};

export default function StudentFormModal({
  open, student, courses, onClose, onSaved,
}: Props) {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const toast = useToast();

  const [form, setForm] = useState<StudentInput>(emptyInput);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (student) {
      setForm({
        name_kh: student.name_kh,
        gender: student.gender,
        date_of_birth: student.date_of_birth,
        grade: student.grade,
        course: student.course,
        status: student.status,
      });
    } else {
      setForm({
        ...emptyInput,
        course: courses.find((c) => c.status === 'active')?.course_id ?? '',
      });
    }
    setErr(null);
  }, [open, student, courses]);

  const onSave = async () => {
    setErr(null);
    if (!form.name_kh.trim()) { setErr(t('students_error_name_required')); return; }
    if (!form.course) { setErr(t('students_error_course_required')); return; }

    setSaving(true);
    try {
      if (student) {
        await updateStudent(student.student_id, form);
        toast.success(t('students_updated'));
      } else {
        if (!profile) throw new Error('No profile');
        await createStudent(form, profile.user_id);
        toast.success(t('students_created'));
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
      title={student ? t('students_edit') : t('students_add')}
      maxWidth="max-w-lg"
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
            className="rounded-md bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {saving ? t('saving') : t('action_save')}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            {t('students_field_name_kh')} *
          </label>
          <input
            value={form.name_kh}
            onChange={(e) => setForm({ ...form, name_kh: e.target.value })}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            autoFocus
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              {t('students_field_gender')}
            </label>
            <select
              value={form.gender ?? ''}
              onChange={(e) =>
                setForm({ ...form, gender: (e.target.value || null) as Gender | null })
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">{t('gender_none')}</option>
              <option value="male">{t('gender_male')}</option>
              <option value="female">{t('gender_female')}</option>
              <option value="other">{t('gender_other')}</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              {t('students_field_dob')}
            </label>
            <input
              type="date"
              value={form.date_of_birth ?? ''}
              onChange={(e) =>
                setForm({ ...form, date_of_birth: e.target.value || null })
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              {t('students_field_grade')}
            </label>
            <input
              list="grade-suggestions"
              value={form.grade ?? ''}
              onChange={(e) => setForm({ ...form, grade: e.target.value || null })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <datalist id="grade-suggestions">
              {GRADE_SUGGESTIONS.map((g) => <option key={g} value={g} />)}
            </datalist>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              {t('students_field_course')} *
            </label>
            <select
              value={form.course}
              onChange={(e) => setForm({ ...form, course: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">—</option>
              {courses
                .filter((c) => c.status === 'active' || c.course_id === form.course)
                .map((c) => (
                  <option key={c.course_id} value={c.course_id}>
                    {c.name_kh}{c.name_en ? ` (${c.name_en})` : ''}
                  </option>
                ))}
            </select>
          </div>
        </div>

        {student && (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              {t('students_field_status')}
            </label>
            <select
              value={form.status ?? student.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as StudentStatus })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="active">{t('student_status_active')}</option>
              <option value="inactive">{t('student_status_inactive')}</option>
              <option value="graduated">{t('student_status_graduated')}</option>
              <option value="dropped">{t('student_status_dropped')}</option>
            </select>
          </div>
        )}

        {err && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{err}</div>
        )}
      </div>
    </Modal>
  );
}