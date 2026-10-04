import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ui/Toast';
import { datetime as fmtDateTime } from '../lib/format';
import {
  listUsers, setUserActive,
  type UserProfile,
} from '../lib/api/users';
import UserFormModal from '../components/UserFormModal';
import ResetPasswordModal from '../components/ResetPasswordModal';

export default function Users() {
  const { t } = useTranslation();
  const { profile: me } = useAuth();
  const toast = useToast();

  const [rows, setRows] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [reloadKey, setReloadKey] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<UserProfile | null>(null);

  const [resetOpen, setResetOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<UserProfile | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await listUsers({ search, status: statusFilter });
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

  const activeOwnerCount = rows.filter((r) => r.role === 'owner' && r.is_active).length;

  const openAdd = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (u: UserProfile) => { setEditing(u); setFormOpen(true); };
  const openReset = (u: UserProfile) => { setResetTarget(u); setResetOpen(true); };

  const onToggleActive = async (u: UserProfile) => {
    const next = !u.is_active;
    try {
      await setUserActive(u.user_id, next);
      toast.success(next ? t('users_activated') : t('users_deactivated'));
      reload();
    } catch (e) {
      const code = (e as Error).message;
      const map: Record<string, string> = {
        SELF_DEACTIVATE: t('users_error_self_deactivate'),
        LAST_OWNER:      t('users_error_last_owner'),
        FORBIDDEN:       t('common_forbidden'),
      };
      toast.error(map[code] ?? code);
    }
  };

  const isLastOwner = (u: UserProfile) =>
    u.role === 'owner' && u.is_active && activeOwnerCount === 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-heading text-slate-900">{t('users_title')}</h1>
        <button
          onClick={openAdd}
          className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          + {t('users_add')}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('users_search_placeholder')}
          className="w-full max-w-xs rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="all">{t('users_filter_status_all')}</option>
          <option value="active">{t('status_active')}</option>
          <option value="inactive">{t('status_inactive')}</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">{t('users_col_id')}</th>
              <th className="px-3 py-2">{t('users_col_username')}</th>
              <th className="px-3 py-2">{t('users_col_full_name')}</th>
              <th className="px-3 py-2">{t('users_col_role')}</th>
              <th className="px-3 py-2">{t('users_col_email')}</th>
              <th className="px-3 py-2">{t('users_col_status')}</th>
              <th className="px-3 py-2">{t('users_col_last_login')}</th>
              <th className="px-3 py-2 text-right">{t('users_col_actions')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                  {t('loading')}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                  {t('users_empty')}
                </td>
              </tr>
            ) : rows.map((u) => {
              const isMe = me?.user_id === u.user_id;
              const lastOwner = isLastOwner(u);
              return (
                <tr key={u.user_id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-mono text-xs text-slate-500">{u.user_id}</td>
                  <td className="px-3 py-2">
                    {u.username}
                    {isMe && (
                      <span className="ml-1 rounded-full bg-brand-100 px-1.5 py-0.5 text-[10px] text-brand-700">
                        {t('users_you_badge')}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">{u.full_name}</td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        'rounded-full px-2 py-0.5 text-xs ' +
                        (u.role === 'owner'
                          ? 'bg-amber-50 text-amber-800'
                          : 'bg-slate-100 text-slate-600')
                      }
                    >
                      {t(`role_${u.role}`)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-600">{u.email ?? '—'}</td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        'rounded-full px-2 py-0.5 text-xs ' +
                        (u.is_active
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-100 text-slate-500')
                      }
                    >
                      {u.is_active ? t('status_active') : t('status_inactive')}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500">
                    {u.last_login ? fmtDateTime(u.last_login) : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => openEdit(u)}
                        className="rounded-md border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50"
                      >
                        {t('action_edit')}
                      </button>
                      <button
                        onClick={() => openReset(u)}
                        className="rounded-md border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50"
                      >
                        {t('users_action_reset_pw')}
                      </button>
                      <button
                        onClick={() => onToggleActive(u)}
                        disabled={(isMe && u.is_active) || lastOwner}
                        title={
                          isMe && u.is_active ? t('users_error_self_deactivate')
                          : lastOwner ? t('users_error_last_owner')
                          : ''
                        }
                        className={
                          'rounded-md border px-2 py-1 text-xs disabled:opacity-40 ' +
                          (u.is_active
                            ? 'border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100')
                        }
                      >
                        {u.is_active ? t('action_deactivate') : t('action_activate')}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <UserFormModal
        open={formOpen}
        user={editing}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        onSaved={() => { setFormOpen(false); setEditing(null); reload(); }}
      />

      <ResetPasswordModal
        open={resetOpen}
        user_id={resetTarget?.user_id ?? null}
        username={resetTarget?.username ?? ''}
        onClose={() => { setResetOpen(false); setResetTarget(null); }}
      />
    </div>
  );
}