import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from './ui/Modal';
import { useToast } from './ui/Toast';
import { useSettings } from '../context/SettingsContext';
import { makeQrCards, printQrCards, type QrMode, type QrStudent } from '../lib/qr';

interface Props {
  open: boolean;
  students: QrStudent[];
  onClose: () => void;
}

export default function BulkQRModal({ open, students, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const { settings } = useSettings();

  const [mode, setMode] = useState<QrMode>('payment');
  const [printing, setPrinting] = useState(false);
  const [preview, setPreview] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || students.length === 0) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const cards = await makeQrCards(students, mode);
        if (!cancelled) setPreview(cards.slice(0, 4).map((c) => c.dataUrl));
      } catch (e) {
        if (!cancelled) toast.error((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, students, mode, toast]);

  const onPrint = async () => {
    if (students.length === 0) return;
    setPrinting(true);
    try {
      const cards = await makeQrCards(students, mode);
      const schoolName =
        i18n.language === 'en'
          ? settings.school_name_en || settings.school_name_kh
          : settings.school_name_kh || settings.school_name_en;
      printQrCards({
        cards,
        mode,
        schoolName,
        title: schoolName,
        subtitle:
          (mode === 'payment' ? t('qr_payment_subtitle') : t('qr_portal_subtitle')) +
          ` · ${students.length} ${t('qr_bulk_count_suffix')}`,
      });
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPrinting(false);
    }
  };

  const pages = Math.ceil(students.length / 12);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('qr_bulk_title')}
      maxWidth="max-w-2xl"
      footer={
        <>
          <button
            onClick={onClose}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            {t('action_cancel')}
          </button>
          <button
            onClick={onPrint}
            disabled={printing || students.length === 0}
            className="rounded-md bg-brand-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {printing ? t('saving') : t('qr_print_count', { count: students.length })}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-md bg-slate-50 p-3">
            <div className="text-slate-500">{t('qr_bulk_students')}</div>
            <div className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">
              {students.length}
            </div>
          </div>
          <div className="rounded-md bg-slate-50 p-3">
            <div className="text-slate-500">{t('qr_bulk_pages')}</div>
            <div className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">
              {pages}
            </div>
            <div className="text-[10px] text-slate-400">3 × 4 per page</div>
          </div>
        </div>

        <div>
          <div className="mb-1 text-xs font-medium text-slate-600">
            {t('qr_mode')}
          </div>
          <div className="flex gap-1 rounded-md border border-slate-200 bg-slate-50 p-1">
            {(['payment', 'portal'] as QrMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={
                  'flex-1 rounded px-3 py-1.5 text-xs font-medium ' +
                  (mode === m
                    ? 'bg-white text-brand-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700')
                }
              >
                {m === 'payment' ? t('qr_mode_payment') : t('qr_mode_portal')}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            {mode === 'payment' ? t('qr_payment_hint') : t('qr_portal_hint')}
          </p>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">{t('loading')}</div>
        ) : (
          <div>
            <div className="mb-2 text-xs font-medium text-slate-600">
              {t('qr_preview')}
            </div>
            <div className="grid grid-cols-4 gap-2 rounded-md border border-dashed border-slate-200 bg-slate-50 p-3">
              {preview.map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt=""
                  className="aspect-square w-full rounded bg-white p-1"
                />
              ))}
              {students.length > preview.length && (
                <div className="flex aspect-square items-center justify-center rounded bg-white text-xs text-slate-400">
                  +{students.length - preview.length}
                </div>
              )}
            </div>
          </div>
        )}

        <div>
          <div className="mb-2 text-xs font-medium text-slate-600">
            {t('qr_bulk_students')} ({students.length})
          </div>
          <div className="flex max-h-32 flex-wrap gap-1 overflow-y-auto rounded-md border border-slate-200 bg-white p-2">
            {students.map((s) => (
              <span
                key={s.student_id}
                className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700"
              >
                {s.name_kh}
                <span className="font-mono text-[10px] text-slate-400">
                  {s.student_id}
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}