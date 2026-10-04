import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ui/Toast';
import Modal from '../components/ui/Modal';
import { riel } from '../lib/format';
import {
  listCourses, createCourse, updateCourse, setCourseStatus,
  type Course, type CourseStatus, type CourseInput,
} from '../lib/api/courses';

const emptyForm: CourseInput = { name_kh: '', name_en: '', hourly_fee: 0 };

export default function Courses() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const toast = useToast();
  const isOwner = profile?.role === 'owner';

  const [rows, setRows] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CourseStatus | 'all'>('all');
  const [reloadKey, setReloadKey] = useState(0);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);
  const [form, setForm] = useState<CourseInput>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await listCourses({ search, status: statusFilter });
        if (!cancelled) setRows(data);
      } catch (e) {
        if (!cancelled) toast.error((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [search, statusFilter, reloadKey, toast]);

  const reload = () => setReloadKey((k) => k + 1);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (c: Course) => {
    setEditing(c);
    setForm({ name_kh: c.name_kh, name_en: c.name_en ?? '', hourly_fee: c.hourly_fee });
    setFormError(null);
    setModalOpen(true);
  };

  const onSave = async () => {
    setFormError(null);
    if (!form.name_kh.trim()) { setFormError(t('courses_error_name_required')); return; }
    if (!Number.isFinite(form.hourly_fee) || form.hourly_fee < 0) {
      setFormError(t('courses_error_fee')); return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateCourse(editing.course_id, form);
        toast.success(t('courses_updated'));
      } else {
        await createCourse(form);
        toast.success(t('courses_created'));
      }
      setModalOpen(false);
      reload();
    } catch (e) {
      const msg = (e as Error).message;
      const lower = msg.toLowerCase();
      if (lower.includes('courses_name_kh_unique') || lower.includes('duplicate')) {
        setFormError(t('courses_error_duplicate'));
      } else {
        setFormError(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  const onToggleStatus = async (c: Course) => {
    const next: CourseStatus = c.status === 'active' ? 'inactive' : 'active';
    try {
      await setCourseStatus(c.course_id, next);
      toast.success(next === 'active' ? t('courses_activated') : t('courses_deactivated'));
      reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-heading text-slate-900">{t('courses_title')}</h1>
        {isOwner && (
          <button
            onClick={openAdd}
            className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            + {t('courses_add')}
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('courses_search_placeholder')}
          className="w-full max-w-xs rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as CourseStatus | 'all')}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="all">{t('courses_filter_all')}</option>
          <option value="active">{t('status_active')}</option>
          <option value="inactive">{t('status_inactive')}</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">{t('courses_col_id')}</th>
              <th className="px-4 py-2">{t('courses_col_name_kh')}</th>
              <th className="px-4 py-2">{t('courses_col_name_en')}</th>
              <th className="px-4 py-2 text-right">{t('courses_col_fee')}</th>
              <th className="px-4 py-2">{t('courses_col_status')}</th>
              <th className="px-4 py-2 text-right">{t('courses_col_actions')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  {t('loading')}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  {t('courses_empty')}
                </td>
              </tr>
            ) : rows.map((c) => (
              <tr key={c.course_id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-mono text-xs text-slate-500">{c.course_id}</td>
                <td className="px-4 py-2">{c.name_kh}</td>
                <td className="px-4 py-2 text-slate-600">{c.name_en ?? '—'}</td>
                <td className="px-4 py-2 text-right tabular-nums">{riel(c.hourly_fee)}</td>
                <td className="px-4 py-2">
                  <span
                    className={
                      'rounded-full px-2 py-0.5 text-xs ' +
                      (c.status === 'active'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-slate-100 text-slate-500')
                    }
                  >
                    {c.status === 'active' ? t('status_active') : t('status_inactive')}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  {isOwner ? (
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => openEdit(c)}
                        className="rounded-md border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50"
                      >
                        {t('action_edit')}
                      </button>
                      <button
                        onClick={() => onToggleStatus(c)}
                        className="rounded-md border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50"
                      >
                        {c.status === 'active' ? t('action_deactivate') : t('action_activate')}
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">{t('courses_readonly')}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => { if (!saving) setModalOpen(false); }}
        title={editing ? t('courses_edit') : t('courses_add')}
        footer={
          <>
            <button
              onClick={() => setModalOpen(false)}
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
              {t('courses_field_name_kh')}
            </label>
            <input
              value={form.name_kh}
              onChange={(e) => setForm({ ...form, name_kh: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              {t('courses_field_name_en')}
            </label>
            <input
              value={form.name_en ?? ''}
              onChange={(e) => setForm({ ...form, name_en: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              {t('courses_field_fee')}
            </label>
            <input
              type="number"
              min={0}
              step={100}
              value={form.hourly_fee}
              onChange={(e) => setForm({ ...form, hourly_fee: Number(e.target.value) })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-slate-500">{riel(form.hourly_fee)}</p>
          </div>
          {formError && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
              {formError}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}