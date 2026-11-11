import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  usersCreateInviteMutation,
  usersInvitesOptions,
  usersInvitesQueryKey,
  usersListOptions,
  usersListQueryKey,
  usersRemoveMutation,
  usersRevokeInviteMutation,
  usersUpdateRoleMutation,
} from '../../api/@tanstack/react-query.gen';
import type { MeDto } from '../../api/types.gen';

const select = 'rounded-md bg-surface px-2 py-1 text-sm text-zinc-100';

/** Users, roles and invitation links (ADR 0007). The backend enforces every rule; the UI only hides what fails anyway. */
export function UsersPage({ me }: { me: MeDto }) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const users = useQuery(usersListOptions());
  const invites = useQuery(usersInvitesOptions());
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: usersListQueryKey() });
    void queryClient.invalidateQueries({ queryKey: usersInvitesQueryKey() });
  };
  const managesAdmins = me.permissions.includes('manageAdmins');
  const mayManage = (role: string) => role !== 'owner' && (role === 'member' || managesAdmins);

  const [inviteRole, setInviteRole] = useState<'member' | 'admin'>('member');
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const create = useMutation({
    ...usersCreateInviteMutation(),
    onSuccess: (created) => {
      setLink(created.url);
      setCopied(false);
      refresh();
    },
  });
  const revoke = useMutation({ ...usersRevokeInviteMutation(), onSuccess: refresh });
  const updateRole = useMutation({ ...usersUpdateRoleMutation(), onSuccess: refresh });
  const remove = useMutation({ ...usersRemoveMutation(), onSuccess: refresh });

  const date = (iso: string) => new Date(iso).toLocaleDateString(i18n.resolvedLanguage);

  return (
    <section className="space-y-6">
      <div className="space-y-3 rounded-xl bg-surface-raised p-4">
        <h2 className="font-medium">{t('users.inviteTitle')}</h2>
        <p className="text-sm text-zinc-400">{t('users.inviteHint')}</p>
        <div className="flex flex-wrap items-center gap-2">
          <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as 'member' | 'admin')} className={select} aria-label={t('users.role')}>
            <option value="member">{t('roles.member')}</option>
            {managesAdmins && <option value="admin">{t('roles.admin')}</option>}
          </select>
          <button type="button" disabled={create.isPending} onClick={() => create.mutate({ body: { role: inviteRole } })} className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-zinc-900 disabled:opacity-50">
            {t('users.createLink')}
          </button>
        </div>
        {link && (
          <div className="space-y-2 rounded-lg bg-surface p-3">
            <p className="text-sm text-zinc-400">{t('users.linkOnce')}</p>
            <div className="flex gap-2">
              <input readOnly value={link} onFocus={(e) => e.target.select()} className="flex-1 rounded-md bg-surface-raised px-2 py-1 font-mono text-xs" aria-label={t('users.link')} />
              <button
                type="button"
                onClick={() => void navigator.clipboard.writeText(link).then(() => setCopied(true))}
                className="rounded-md bg-white/10 px-3 py-1 text-sm hover:bg-white/15"
              >
                {copied ? t('users.copied') : t('users.copy')}
              </button>
            </div>
          </div>
        )}
      </div>

      {!!invites.data?.length && (
        <div className="rounded-xl bg-surface-raised p-4">
          <h2 className="mb-3 font-medium">{t('users.openInvites')}</h2>
          <ul className="divide-y divide-white/5 text-sm">
            {invites.data.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between gap-4 py-2">
                <span>
                  {t(`roles.${inv.role}`)} · {t('users.invitedBy', { name: inv.createdBy })} · {t('users.validUntil', { date: date(inv.expiresAt) })}
                </span>
                {mayManage(inv.role) && (
                  <button type="button" onClick={() => revoke.mutate({ path: { id: inv.id } })} className="rounded-md px-2 py-1 text-red-300 hover:bg-white/5">
                    {t('users.revoke')}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-xl bg-surface-raised p-4">
        <h2 className="mb-3 font-medium">{t('users.title', { count: users.data?.length ?? 0 })}</h2>
        <ul className="divide-y divide-white/5 text-sm">
          {users.data?.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
              <span>
                <span className="font-medium">{u.name}</span> <span className="text-zinc-400">{u.email}</span>
              </span>
              <span className="flex items-center gap-2">
                {u.id !== me.id && mayManage(u.role) && managesAdmins ? (
                  <select value={u.role} onChange={(e) => updateRole.mutate({ path: { id: u.id }, body: { role: e.target.value as 'member' | 'admin' } })} className={select} aria-label={t('users.role')}>
                    <option value="member">{t('roles.member')}</option>
                    <option value="admin">{t('roles.admin')}</option>
                  </select>
                ) : (
                  <span className="text-zinc-400">{t(`roles.${u.role}`)}</span>
                )}
                {u.id !== me.id && mayManage(u.role) && (
                  <button
                    type="button"
                    onClick={() => window.confirm(t('users.removeConfirm', { name: u.name })) && remove.mutate({ path: { id: u.id } })}
                    className="rounded-md px-2 py-1 text-red-300 hover:bg-white/5"
                  >
                    {t('users.remove')}
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
