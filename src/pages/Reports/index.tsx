import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui/Toast';
import { listCourses, type Course } from '../../lib/api/courses';
import { listStudents, type Student } from '../../lib/api/students';
import { todayIso } from '../../lib/api/payments';
import type { ReportFilters } from '../../lib/api/reports';
import OverviewTab from './OverviewTab';
import ByCourseTab from './ByCourseTab';
import ByStudentTab from './ByStudentTab';
import OutstandingTab from './OutstandingTab';
import ByStaffTab from './ByStaffTab';

type Tab = 'overview' | 'course' | 'student' | 'outstanding' | 'staff';

function startOfMonthIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function startOfWeekIso(): string {
  const d = new Date();
  d.setDate(d.getDate() - 6);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function startOfYearIso(): string {
  return `${new Date().getFullYear()}-01-01`;
}

export default function Reports() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const toast = useToast();
  const isOwner = profile?.role === 'owner';

  const [tab, setTab] = useState<Tab>('overview');
  const [from, setFrom] = useState(startOfMonthIso());
  const [to, setTo]     = useState(todayIso());
  const [courseId, setCourseId] = useState<string>('');
  const [grade, setGrade] = useState<string>('');

  const [courses, setCourses] = useState<Course[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [cs, ss] = await Promise.all([
          listCourses({ status: 'all' }),
          listStudents({ status: 'active' }),
        ]);
        if (!cancelled) {
          setCourses(cs);
          setAllStudents(ss);
        }
      } catch (e) {
        if (!cancelled) toast.error((e as Error).message);
      }
    })();
    return () => { cancelled = true; };
  }, [toast]);

  const gradeOptions = useMemo(() => {
    const s = new Set<string>();
    for (const st of allStudents) if (st.grade) s.add(st.grade);
    return Array.from(s).sort();
  }, [allStudents]);

  const filters: ReportFilters = {
    from,
    to,
    course: courseId || null,
    grade:  grade    || null,
  };

  const applyPreset = (preset: 'today' | 'week' | 'month' | 'year') => {
    const today = todayIso();
    if (preset === 'today') { setFrom(today); setTo(today); }
    if (preset === 'week')  { setFrom(startOfWeekIso()); setTo(today); }
    if (preset === 'month') { setFrom(startOfMonthIso()); setTo(today); }
    if (preset === 'year')  { setFrom(startOfYearIso()); setTo(today); }
  };

  const tabs: { key: Tab; labelKey: string; ownerOnly?: boolean }[] = [
    { key: 'overview',    labelKey: 'reports_tab_overview' },
    { key: 'course',      labelKey: 'reports_tab_course' },
    { key: 'student',     labelKey: 'reports_tab_student' },
    { key: 'outstanding', labelKey: 'reports_tab_outstanding' },
    { key: 'staff',       labelKey: 'reports_tab_staff', ownerOnly: true },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-heading text-slate-900">{t('reports_title')}</h1>

      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              {t('reports_from')}
            </label>
            <input
              type="date"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              {t('reports_to')}
            </label>
            <input
              type="date"
              value={to}
              min={from}
              max={todayIso()}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              {t('reports_course')}
            </label>
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">{t('reports_all')}</option>
              {courses.map((c) => (
                <option key={c.course_id} value={c.course_id}>{c.name_kh}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              {t('reports_grade')}
            </label>
            <select
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">{t('reports_all')}</option>
              {gradeOptions.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>

          <div className="ml-auto flex flex-wrap gap-1">
            <PresetBtn onClick={() => applyPreset('today')}>{t('reports_preset_today')}</PresetBtn>
            <PresetBtn onClick={() => applyPreset('week')}>{t('reports_preset_week')}</PresetBtn>
            <PresetBtn onClick={() => applyPreset('month')}>{t('reports_preset_month')}</PresetBtn>
            <PresetBtn onClick={() => applyPreset('year')}>{t('reports_preset_year')}</PresetBtn>
          </div>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {tabs.filter((tb) => !tb.ownerOnly || isOwner).map((tb) => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            className={
              'relative -mb-px whitespace-nowrap px-4 py-2 text-sm font-medium ' +
              (tab === tb.key
                ? 'border-b-2 border-brand-500 text-brand-700'
                : 'text-slate-500 hover:text-slate-800')
            }
          >
            {t(tb.labelKey)}
          </button>
        ))}
      </div>

      {tab === 'overview'    && <OverviewTab filters={filters} />}
      {tab === 'course'      && <ByCourseTab filters={filters} />}
      {tab === 'student'     && <ByStudentTab filters={filters} />}
      {tab === 'outstanding' && <OutstandingTab filters={filters} />}
      {tab === 'staff'       && isOwner && <ByStaffTab filters={filters} />}
    </div>
  );
}

function PresetBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600 hover:border-brand-500 hover:bg-white hover:text-brand-700"
    >
      {children}
    </button>
  );
}