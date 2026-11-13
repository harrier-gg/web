import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { nodesCreateMutation, nodesListOptions, nodesListQueryKey, nodesRemoveMutation } from '../../api/@tanstack/react-query.gen';
import type { NodeCreatedDto } from '../../api/types.gen';

/**
 * The command that starts the agent on a machine. Agents connect to the panel's own address;
 * a panel without HTTPS outside localhost needs `--insecure` (the agent refuses otherwise, ADR 0004).
 */
export function agentCommand(token: string): string {
  const secure = location.protocol === 'https:';
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  const url = `${secure ? 'wss' : 'ws'}://${location.host}/agent/ws`;
  return `HARRIER_AGENT_TOKEN=${token} harrier agent run --panel ${url}${!secure && !local ? ' --insecure' : ''}`;
}

export function NodesPage() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  // ponytail: polling every 2 s, so a freshly started agent shows up without reloading
  const nodes = useQuery({ ...nodesListOptions(), refetchInterval: 2000 });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: nodesListQueryKey() });

  const [name, setName] = useState('');
  const [created, setCreated] = useState<NodeCreatedDto | null>(null);
  const [copied, setCopied] = useState(false);
  const create = useMutation({
    ...nodesCreateMutation(),
    onSuccess: (result) => {
      setCreated(result);
      setCopied(false);
      setName('');
      refresh();
    },
  });
  const remove = useMutation({ ...nodesRemoveMutation(), onSuccess: refresh });
  const status = (create.error ?? remove.error) as { status?: number } | null;
  const error = status ? (status.status === 409 ? t('nodes.conflict') : t('nodes.invalid')) : null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate({ body: { name } });
  };

  const createdOnline = created && nodes.data?.find((n) => n.id === created.node.id)?.online;
  const command = created ? agentCommand(created.token) : '';

  return (
    <section className="space-y-6">
      <div className="space-y-3 rounded-xl bg-surface-raised p-4">
        <h2 className="font-medium">{t('nodes.addTitle')}</h2>
        <p className="text-sm text-zinc-400">{t('nodes.addHint')}</p>
        <form onSubmit={submit} className="flex flex-wrap gap-2">
          <input
            required
            pattern="[A-Za-z0-9._\-]{1,64}"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="gaming-pc"
            aria-label={t('nodes.name')}
            className="rounded-md bg-surface px-3 py-1.5 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-accent"
          />
          <button type="submit" disabled={create.isPending} className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-zinc-900 disabled:opacity-50">
            {t('nodes.add')}
          </button>
        </form>
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}

        {created && (
          <div className="space-y-2 rounded-lg bg-surface p-3">
            <p className="text-sm">{t('nodes.runCommand', { name: created.node.name })}</p>
            <div className="flex gap-2">
              <input readOnly value={command} onFocus={(e) => e.target.select()} aria-label={t('nodes.command')} className="flex-1 rounded-md bg-surface-raised px-2 py-1 font-mono text-xs" />
              <button type="button" onClick={() => void navigator.clipboard.writeText(command).then(() => setCopied(true))} className="rounded-md bg-white/10 px-3 py-1 text-sm hover:bg-white/15">
                {copied ? t('users.copied') : t('users.copy')}
              </button>
            </div>
            <p className="text-xs text-zinc-400">{t('nodes.tokenOnce')}</p>
            <p className={`text-sm font-medium ${createdOnline ? 'text-emerald-300' : 'text-zinc-400'}`}>
              {createdOnline ? t('nodes.connected') : t('nodes.waiting')}
            </p>
          </div>
        )}
      </div>

      <div className="rounded-xl bg-surface-raised p-4">
        <h2 className="mb-3 font-medium">{t('nodes.title', { count: nodes.data?.length ?? 0 })}</h2>
        {nodes.data?.length ? (
          <ul className="divide-y divide-white/5 text-sm">
            {nodes.data.map((n) => (
              <li key={n.id} className="flex items-center justify-between gap-3 py-2">
                <span className="flex items-center gap-2">
                  <span aria-hidden className={`size-2.5 rounded-full ${n.online ? 'bg-emerald-400' : 'bg-zinc-500'}`} />
                  <span className="font-medium">{n.name}</span>
                  <span className="text-zinc-400">
                    {n.online
                      ? t('nodes.online')
                      : n.lastSeenAt
                        ? t('nodes.lastSeen', { date: new Date(n.lastSeenAt).toLocaleString(i18n.resolvedLanguage) })
                        : t('nodes.neverConnected')}
                  </span>
                </span>
                <button
                  type="button"
                  // An offline node may be gone for good: its servers are then only forgotten, their files stay.
                  onClick={() =>
                    window.confirm(t(n.online ? 'nodes.removeConfirm' : 'nodes.removeOfflineConfirm', { name: n.name })) &&
                    remove.mutate({ path: { id: n.id }, query: { force: !n.online } })
                  }
                  className="rounded-md px-2 py-1 text-red-300 hover:bg-white/5"
                >
                  {t('users.remove')}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-zinc-400">{t('nodes.empty')}</p>
        )}
      </div>
    </section>
  );
}
