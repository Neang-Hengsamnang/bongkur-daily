import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from './ui/Modal';
import { useToast } from './ui/Toast';
import { riel } from '../lib/format';
import { markPaymentPaid } from '../lib/api/payments';

interface Props {
  open: boolean;
  paymentId: string | null;
  studentName: string;
  total: number;
  paid: number;
  onClose: () => void;
  onSaved: () => void;
}

export default function RecordPaymentModal({
  open, paymentId, studentName, total, paid, onClose, onSaved,
}: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const remaining = Math.max(0, total - paid);

  const [amount, setAmount] = useState<number>(remaining);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setAmount(remaining);
    setErr(null);
  }, [open, remaining]);

  const after = Math.max(0, remaining - Math.min(amount, remaining));

  const onSave = async () => {
    if (!paymentId) return;
    if (!Number.isFinite(amount) || amount <= 0) {
      setErr(t('payments_record_error_amount'));
      return;
    }
    setSaving(true);
    try {
      await markPaymentPaid(paymentId, amount);
      toast.success(t('payments_record_saved'));
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
      title={t('payments_record_title')}
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
            {saving ? t('saving') : t('payments_record_save')}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="text-sm font-medium text-slate-700">{studentName}</div>

        <div className="grid grid-cols-3 gap-2 rounded-md bg-slate-50 p-3 text-center">
          <div>
            <div className="text-[10px] uppercase text-slate-500">
              {t('payments_col_total')}
            </div>
            <div className="text-sm font-medium tabular-nums">{riel(total)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-slate-500">
              {t('payments_col_paid')}
            </div>
            <div className="text-sm font-medium tabular-nums">{riel(paid)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-slate-500">
              {t('payments_col_remaining')}
            </div>
            <div className="text-sm font-medium text-red-700 tabular-nums">
              {riel(remaining)}
            </div>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            {t('payments_record_amount')}
          </label>
          <input
            type="number"
            min={1}
            max={remaining}
            step={100}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm tabular-nums"
          />
        </div>

        <p className="text-xs text-slate-500">
          {t('payments_record_after', { amount: riel(after) })}
        </p>

        {err && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{err}</div>
        )}
      </div>
    </Modal>
  );
}