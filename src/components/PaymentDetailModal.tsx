import { useTranslation } from 'react-i18next';
import Modal from './ui/Modal';
import { riel, date as fmtDate, datetime as fmtDateTime } from '../lib/format';
import type { PaymentListItem } from '../lib/api/payments';

interface Props {
  open: boolean;
  payment: PaymentListItem | null;
  canEdit?: boolean;
  onEdit?: () => void;
  onClose: () => void;
}

export default function PaymentDetailModal({
  open, payment, canEdit, onEdit, onClose,
}: Props) {
  const { t } = useTranslation();
  if (!payment) return null;

  const remaining = Math.max(0, payment.total_amount - payment.paid_amount);
  const status = payment.is_paid
    ? 'paid'
    : payment.paid_amount > 0
      ? 'partial'
      : 'unpaid';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('payments_detail_title')}
      maxWidth="max-w-2xl"
      mobileSheet
      footer={
        <>
          {canEdit && onEdit && (
            <button
              onClick={onEdit}
              className="mr-auto rounded-md border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-800 hover:bg-brand-100"
            >
              {t('action_edit')}
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
          >
            {t('action_close')}
          </button>
        </>
      }
    >
      {/* ...body unchanged from Phase 7... */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-xs text-slate-500">{t('payments_col_id')}</div>
            <div className="font-mono text-xs">{payment.payment_id}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">{t('payments_col_date')}</div>
            <div>{fmtDate(payment.payment_date)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">{t('payments_col_student')}</div>
            <div>
              {payment.students?.name_kh ?? '—'}{' '}
              <span className="ml-1 font-mono text-[10px] text-slate-400">
                {payment.student_id}
              </span>
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">{t('payments_detail_recorded_by')}</div>
            <div>{payment.profiles?.full_name ?? '—'}</div>
          </div>
        </div>

        <div className="overflow-hidden rounded-md border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-1.5">{t('payments_entry_col_course')}</th>
                <th className="px-2 py-1.5 text-right">{t('payments_entry_col_hours')}</th>
                <th className="px-2 py-1.5 text-right">{t('payments_entry_col_fee')}</th>
                <th className="px-2 py-1.5 text-right">{t('payments_entry_col_subtotal')}</th>
              </tr>
            </thead>
            <tbody>
              {payment.payment_items.map((it) => (
                <tr key={it.item_id} className="border-t border-slate-100">
                  <td className="px-3 py-1.5">{it.course_name_at_time}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{it.hours}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {riel(it.hourly_fee_at_time)}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{riel(it.subtotal)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50 font-medium">
                <td colSpan={3} className="px-3 py-1.5 text-right">{t('payments_col_total')}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {riel(payment.total_amount)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="grid grid-cols-3 gap-2 rounded-md bg-slate-50 p-3 text-center text-sm">
          <div>
            <div className="text-[10px] uppercase text-slate-500">{t('payments_col_paid')}</div>
            <div className="font-medium tabular-nums">{riel(payment.paid_amount)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-slate-500">{t('payments_col_remaining')}</div>
            <div className="font-medium text-red-700 tabular-nums">{riel(remaining)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-slate-500">{t('payments_col_status')}</div>
            <div className="font-medium">{t(`payments_status_${status}`)}</div>
          </div>
        </div>

        {payment.note && (
          <div>
            <div className="text-xs text-slate-500">{t('payments_entry_note')}</div>
            <div className="mt-1 rounded-md bg-slate-50 p-2 text-sm">{payment.note}</div>
          </div>
        )}

        <div className="text-xs text-slate-500">
          {t('payments_detail_created')}: {fmtDateTime(payment.created_at)}
          {payment.paid_at
            ? ` · ${t('payments_detail_paid_at')}: ${fmtDateTime(payment.paid_at)}`
            : ''}
        </div>
      </div>
    </Modal>
  );
}