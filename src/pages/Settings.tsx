import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../components/ui/Toast';
import { useSettings } from '../context/SettingsContext';
import {
  saveSettings, uploadLogo,
  type Settings as SettingsShape, type Language, type PortalInactiveMode,
} from '../lib/api/settings';
import { downloadFullBackup, downloadCsvBundle } from '../lib/api/backup';

export default function Settings() {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const { settings, refresh } = useSettings();

  const [form, setForm] = useState<SettingsShape>(settings);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [backupBusy, setBackupBusy] = useState(false);
  const [csvBusy, setCsvBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setForm(settings);
    setUrlInput(settings.logo_url);
  }, [settings]);

  const patch = <K extends keyof SettingsShape>(k: K, v: SettingsShape[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const onPickFile = () => fileRef.current?.click();

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error(t('settings_logo_too_big'));
      return;
    }
    setUploading(true);
    try {
      const url = await uploadLogo(file);
      patch('logo_url', url);
      setUrlInput(url);
      toast.success(t('settings_logo_uploaded'));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const onApplyUrl = () => {
    patch('logo_url', urlInput.trim());
  };

  const onRemoveLogo = () => {
    patch('logo_url', '');
    setUrlInput('');
  };

  const onSave = async () => {
    setSaving(true);
    try {
      await saveSettings({
        school_name_kh:       form.school_name_kh,
        school_name_en:       form.school_name_en,
        logo_url:             form.logo_url,
        contact_phone:        form.contact_phone,
        contact_email:        form.contact_email,
        address:              form.address,
        default_language:     form.default_language,
        portal_inactive_mode: form.portal_inactive_mode,
      });
      await refresh();
      if (i18n.language !== form.default_language) {
        i18n.changeLanguage(form.default_language);
      }
      toast.success(t('settings_saved'));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const onDownloadBackup = async () => {
    setBackupBusy(true);
    try {
      await downloadFullBackup();
      toast.success(t('settings_backup_done'));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBackupBusy(false);
    }
  };

  const onDownloadCsv = async () => {
    setCsvBusy(true);
    try {
      await downloadCsvBundle();
      toast.success(t('settings_backup_csv_done'));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCsvBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-heading text-slate-900">{t('settings_title')}</h1>

      {/* ---- Branding ---- */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-medium text-slate-800">
          {t('settings_branding')}
        </h2>

        <div className="flex flex-wrap items-start gap-4">
          <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
            {form.logo_url ? (
              <img
                src={form.logo_url}
                alt="logo"
                className="h-full w-full object-contain"
                onError={() => toast.error(t('settings_logo_broken'))}
              />
            ) : (
              <span className="text-xs text-slate-400">{t('settings_no_logo')}</span>
            )}
          </div>

          <div className="flex-1 min-w-[260px] space-y-2">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={onPickFile}
                disabled={uploading}
                className="rounded-md bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {uploading ? t('saving') : t('settings_upload_logo')}
              </button>
              <button
                onClick={onRemoveLogo}
                disabled={!form.logo_url}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
              >
                {t('settings_remove_logo')}
              </button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              onChange={onFileChange}
            />
            <p className="text-[11px] text-slate-500">{t('settings_logo_hint')}</p>

            <div className="flex gap-2">
              <input
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder={t('settings_logo_url_placeholder')}
                className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={onApplyUrl}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
              >
                {t('settings_apply_url')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ---- School Info ---- */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-medium text-slate-800">
          {t('settings_school_info')}
        </h2>

        <div className="grid gap-3 md:grid-cols-2">
          <Field label={t('settings_field_name_kh')}>
            <input
              value={form.school_name_kh}
              onChange={(e) => patch('school_name_kh', e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </Field>

          <Field label={t('settings_field_name_en')}>
            <input
              value={form.school_name_en}
              onChange={(e) => patch('school_name_en', e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </Field>

          <Field label={t('settings_field_phone')}>
            <input
              value={form.contact_phone}
              onChange={(e) => patch('contact_phone', e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </Field>

          <Field label={t('settings_field_email')}>
            <input
              type="email"
              value={form.contact_email}
              onChange={(e) => patch('contact_email', e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </Field>

          <Field label={t('settings_field_address')} full>
            <input
              value={form.address}
              onChange={(e) => patch('address', e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </Field>

          <Field label={t('settings_field_language')}>
            <select
              value={form.default_language}
              onChange={(e) => patch('default_language', e.target.value as Language)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="km">ភាសាខ្មែរ (Khmer)</option>
              <option value="en">English</option>
            </select>
          </Field>

          <Field label={t('settings_field_portal_mode')}>
            <select
              value={form.portal_inactive_mode}
              onChange={(e) =>
                patch('portal_inactive_mode', e.target.value as PortalInactiveMode)
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="show_banner">{t('settings_portal_show_banner')}</option>
              <option value="not_found">{t('settings_portal_not_found')}</option>
              <option value="hide_balance">{t('settings_portal_hide_balance')}</option>
            </select>
          </Field>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            onClick={onSave}
            disabled={saving}
            className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {saving ? t('saving') : t('action_save')}
          </button>
        </div>
      </div>

      {/* ---- Backup ---- */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-2 text-sm font-medium text-slate-800">
          {t('settings_backup_title')}
        </h2>
        <p className="mb-4 text-xs text-slate-500">
          {t('settings_backup_hint')}
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={onDownloadBackup}
            disabled={backupBusy || csvBusy}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {backupBusy ? t('settings_backup_working') : t('settings_backup_download')}
          </button>
          <button
            onClick={onDownloadCsv}
            disabled={backupBusy || csvBusy}
            className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-60"
          >
            {csvBusy ? t('settings_backup_csv_working') : t('settings_backup_csv_download')}
          </button>
        </div>

        <div className="mt-3 space-y-1 text-[11px] text-slate-500">
          <div>
            <span className="font-medium text-slate-600">Excel:</span>{' '}
            {t('settings_backup_format_excel')}
          </div>
          <div>
            <span className="font-medium text-slate-600">CSV:</span>{' '}
            {t('settings_backup_format_csv')}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label, children, full,
}: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? 'md:col-span-2' : ''}>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      {children}
    </div>
  );
}