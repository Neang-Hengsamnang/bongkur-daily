import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from './ui/Modal';
import { useToast } from './ui/Toast';
import { createUser, updateUser, type UserProfile, type Role } from '../lib/api/users';

interface Props {
  open: boolean;
  user: UserProfile | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function UserFormModal({ open, user, onClose, onSaved }: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const isEdit = Boolean(user);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('staff');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (user) {
      setUsername(user.username);
      setFullName(user.full_name);
      setEmail(user.email ?? '');
      setRole(user.role);
      setPassword('');
    } else {
      setUsername('');
      setFullName('');
      setEmail('');
      setRole('staff');
      setPassword('');
    }
    setErr(null);
  }, [open, user]);

  const msgFor = (code: string): string => {
    switch (code) {
      case 'INVALID_USERNAME':  return t('users_error_username_format');
      case 'USERNAME_TAKEN':    return t('users_error_username_taken');
      case 'INVALID_PASSWORD':  return t('users_error_password_short');
      case 'INVALID_NAME':      return t('users_error_name_required');
      case 'EMAIL_TAKEN':       return t('users_error_email_taken');
      case 'LAST_OWNER':        return t('users_error_last_owner');
      case 'FORBIDDEN':         return t('common_forbidden');
      default:                  return code;
    }
  };

  const onSave = async () => {
    setErr(null);
    setSaving(true);
    try {
      if (isEdit && user) {
        await updateUser({
          user_id: user.user_id,
          full_name: fullName,
          email: email || null,
          role,
        });
        toast.success(t('users_updated'));
      } else {
        await createUser({
          username: username.trim().toLowerCase(),
          password,
          full_name: fullName,
          email: email || null,
          role,
        });
        toast.success(t('users_created'));
      }
      onSaved();
    } catch (e) {
      setErr(msgFor((e as Error).message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => { if (!saving) onClose(); }}
      title={isEdit ? t('users_edit') : t('users_add')}
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
        {!isEdit && (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              {t('users_field_username')} *
            </label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              autoComplete="off"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="lowercase_letters_3_to_30"
              autoFocus
            />
            <p className="mt-1 text-[11px] text-slate-500">{t('users_username_hint')}</p>
          </div>
        )}

        {!isEdit && (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              {t('users_field_password')} *
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            {t('users_field_full_name')} *
          </label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              {t('users_field_email')}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder={t('users_email_placeholder')}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              {t('users_field_role')}
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="staff">{t('role_staff')}</option>
              <option value="owner">{t('role_owner')}</option>
            </select>
          </div>
        </div>

        {err && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{err}</div>
        )}
      </div>
    </Modal>
  );
}