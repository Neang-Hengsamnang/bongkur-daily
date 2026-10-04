import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/ui/Toast';
import {
  parseCsvFile, runImport,
  type ImportInputs, type ImportReport, type ImportProgress,
} from '../lib/api/import';

interface FileSlot {
  key: keyof ImportInputs;
  labelKey: string;
  required?: boolean;
}

const SLOTS: FileSlot[] = [
  { key: 'courses',      labelKey: 'import_file_courses',       required: true },
  { key: 'students',     labelKey: 'import_file_students',      required: true },
  { key: 'payments',     labelKey: 'import_file_payments' },
  { key: 'paymentItems', labelKey: 'import_file_payment_items' },
  { key: 'users',        labelKey: 'import_file_users' },
];

export default function Import() {
  const { t } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();

  const [files, setFiles] = useState<Partial<Record<keyof ImportInputs, File>>>({});
  const [parsed, setParsed] = useState<Partial<Record<keyof ImportInputs, Record<string, string>[]>>>({});
  const [defaultPassword, setDefaultPassword] = useState('');
  const [wipeFirst, setWipeFirst] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);

  const onFileChange = async (key: keyof ImportInputs, file: File | null) => {
    if (!file) {
      setFiles((f) => { const n = { ...f }; delete n[key]; return n; });
      setParsed((p) => { const n = { ...p }; delete n[key]; return n; });
      return;
    }
    setFiles((f) => ({ ...f, [key]: file }));
    setParsing(true);
    try {
      const rows = await parseCsvFile(file);
      setParsed((p) => ({ ...p, [key]: rows }));
    } catch (e) {
      toast.error(`${file.name}: ${(e as Error).message}`);
    } finally {
      setParsing(false);
    }
  };

  const allRequiredPresent = SLOTS.every((s) =>
    !s.required || (parsed[s.key] && parsed[s.key]!.length > 0),
  );

  const totalRows = Object.values(parsed).reduce((sum, rows) => sum + (rows?.length ?? 0), 0);

  const doImport = async () => {
    if (!allRequiredPresent) {
      toast.error(t('import_error_missing_files'));
      return;
    }
    if (defaultPassword.length < 6) {
      toast.error(t('import_error_default_password'));
      return;
    }
    if (wipeFirst) {
      const ok = window.confirm(t('import_confirm_wipe'));
      if (!ok) return;
    }

    setImporting(true);
    setReport(null);
    try {
      const r = await runImport(
        parsed as ImportInputs,
        { defaultPassword, wipeFirst },
        (p) => setProgress(p),
      );
      setReport(r);
      toast.success(t('import_done'));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setImporting(false);
      setProgress(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-heading text-slate-900">{t('import_title')}</h1>
        <button
          onClick={() => navigate('/dashboard')}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
        >
          {t('action_cancel')}
        </button>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        {t('import_warning')}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-medium text-slate-800">
          {t('import_step1')}
        </h2>
        <p className="mb-4 text-xs text-slate-500">{t('import_step1_hint')}</p>

        <div className="space-y-3">
          {SLOTS.map((slot) => {
            const rows = parsed[slot.key];
            const file = files[slot.key];
            return (
              <div key={slot.key} className="flex items-center gap-3">
                <div className="w-52 shrink-0 text-sm text-slate-700">
                  {t(slot.labelKey)}
                  {slot.required && <span className="ml-1 text-rose-600">*</span>}
                </div>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => onFileChange(slot.key, e.target.files?.[0] ?? null)}
                  className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-xs"
                  disabled={importing}
                />
                {file && rows && (
                  <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">
                    {rows.length} {t('import_rows')}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-medium text-slate-800">
          {t('import_step2')}
        </h2>

        <div className="space-y-3">
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={wipeFirst}
              onChange={(e) => setWipeFirst(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-brand-500"
              disabled={importing}
            />
            <span>
              <span className="font-medium text-slate-700">
                {t('import_option_wipe')}
              </span>
              <span className="mt-0.5 block text-xs text-slate-500">
                {t('import_option_wipe_hint')}
              </span>
            </span>
          </label>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              {t('import_default_password')}
            </label>
            <input
              type="text"
              value={defaultPassword}
              onChange={(e) => setDefaultPassword(e.target.value)}
              placeholder="e.g. Welcome2026"
              className="w-full max-w-sm rounded-md border border-slate-300 px-3 py-2 text-sm"
              disabled={importing}
            />
            <p className="mt-1 text-[11px] text-slate-500">
              {t('import_default_password_hint')}
            </p>
          </div>
        </div>
      </div>

      {progress && (
        <div className="rounded-xl border border-brand-200 bg-brand-50 p-4">
          <div className="flex items-center justify-between text-sm text-brand-900">
            <span>{t(`import_step_${progress.step}`)}</span>
            <span className="tabular-nums">
              {progress.done} / {progress.total}
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-brand-100">
            <div
              className="h-full rounded-full bg-brand-500 transition-all"
              style={{ width: `${progress.total === 0 ? 0 : (progress.done / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {report && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <h2 className="mb-3 text-sm font-medium text-emerald-900">
            {t('import_report_title')}
          </h2>
          <div className="space-y-1.5 text-sm">
            <ReportRow label={t('import_file_courses')}      value={`${report.courses.inserted}`} />
            <ReportRow label={t('import_file_users')}        value={`${report.users.created} ${t('import_created')}, ${report.users.skipped} ${t('import_skipped')}`} />
            <ReportRow label={t('import_file_students')}     value={`${report.students.inserted}`} />
            <ReportRow
                label={t('import_file_payments')}
                value={
                    report.payments.mergedGroups > 0
                    ? `${report.payments.inserted} (merged ${report.payments.mergedRows} → ${report.payments.mergedGroups})`
                    : `${report.payments.inserted}`
                }
            />
            <ReportRow label={t('import_file_payment_items')} value={`${report.paymentItems.inserted}`} />
            <ReportRow label={t('import_sequences')}         value={report.sequencesFixed ? '✓' : '✗'} />
          </div>
          {(report.courses.errors.length + report.students.errors.length +
            report.payments.errors.length + report.paymentItems.errors.length +
            report.users.errors.length) > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-rose-700">
                {t('import_errors_summary')}
              </summary>
              <pre className="mt-2 max-h-40 overflow-auto rounded bg-white p-2 text-[10px]">
                {JSON.stringify(report, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button
          onClick={() => navigate('/dashboard')}
          disabled={importing}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
        >
          {t('action_cancel')}
        </button>
        <button
          onClick={doImport}
          disabled={importing || parsing || !allRequiredPresent || defaultPassword.length < 6}
          className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {importing
            ? t('import_in_progress')
            : `${t('import_start')} (${totalRows} ${t('import_rows')})`}
        </button>
      </div>
    </div>
  );
}

function ReportRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-emerald-900">{label}</span>
      <span className="font-medium tabular-nums text-emerald-900">{value}</span>
    </div>
  );
}