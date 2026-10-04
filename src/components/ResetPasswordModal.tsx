import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from './ui/Modal';
import { useToast } from './ui/Toast';
import { resetUserPassword } from '../lib/api/users';

interface Props {
  open: boolean;
  user_id: string | null;
  username: string;
  onClose: () => void;
}

export default function ResetPasswordModal({ open, user_id, username, onClose }: Props) {
  const { t } = useTranslation();
  const toast = useToast();

  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPw1('');
    setPw2('');
    setErr(null);
  }, [open]);

  const onSave = async () => {
    setErr(null);
    if (!user_id) return;
    if (pw1.length < 6) { setErr(t('users_error_password_short')); return; }
    if (pw1 !== pw2)   { setErr(t('users_error_password_mismatch')); return; }

    setSaving(true);
    try {
      await resetUserPassword(user_id, pw1);
      toast.success(t('users_password_reset'));
      onClose();
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
      title={t('users_reset_password')}
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
            {saving ? t('saving') : t('users_reset_password')}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-xs text-slate-500">
          {t('users_reset_for', { username })}
        </p>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            {t('users_field_new_password')}
          </label>
          <input
            type="password"
            value={pw1}
            onChange={(e) => setPw1(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            autoFocus
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            {t('users_field_confirm_password')}
          </label>
          <input
            type="password"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        {err && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{err}</div>
        )}
      </div>
    </Modal>
  );
}