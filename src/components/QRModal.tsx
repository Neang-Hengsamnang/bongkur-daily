import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from './ui/Modal';
import { useToast } from './ui/Toast';
import { useSettings } from '../context/SettingsContext';
import { makeQrCards, printQrCards, type QrMode, type QrStudent } from '../lib/qr';

interface Props {
  open: boolean;
  student: QrStudent | null;
  onClose: () => void;
}

export default function QRModal({ open, student, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const { settings } = useSettings();

  const [mode, setMode] = useState<QrMode>('payment');
  const [dataUrl, setDataUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !student) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const [card] = await makeQrCards([student], mode);
        if (!cancelled) setDataUrl(card.dataUrl);
      } catch (e) {
        if (!cancelled) toast.error((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, student, mode, toast]);

  const onPrint = async () => {
    if (!student) return;
    try {
      const [card] = await makeQrCards([student], mode);
      const schoolName =
        i18n.language === 'en'
          ? settings.school_name_en || settings.school_name_kh
          : settings.school_name_kh || settings.school_name_en;
      printQrCards({
        cards: [card],
        mode,
        schoolName,
        title: schoolName,
        subtitle:
          mode === 'payment'
            ? t('qr_payment_subtitle')
            : t('qr_portal_subtitle'),
      });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  if (!student) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('qr_single_title')}
      footer={
        <>
          <button
            onClick={onClose}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            {t('action_close')}
          </button>
          <button
            onClick={onPrint}
            className="rounded-md bg-brand-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            {t('qr_print')}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <div className="text-sm font-medium text-slate-800">{student.name_kh}</div>
          <div className="mt-0.5 font-mono text-xs text-slate-500">{student.student_id}</div>
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

        <div className="flex flex-col items-center rounded-lg border border-slate-200 bg-white p-6">
          {loading || !dataUrl ? (
            <div className="flex h-[220px] w-[220px] items-center justify-center text-sm text-slate-400">
              {t('loading')}
            </div>
          ) : (
            <img
              src={dataUrl}
              alt="QR code"
              className="h-[220px] w-[220px]"
            />
          )}
          <p className="mt-4 text-center text-xs text-slate-500">
            {mode === 'payment' ? t('qr_payment_hint') : t('qr_portal_hint')}
          </p>
        </div>
      </div>
    </Modal>
  );
}