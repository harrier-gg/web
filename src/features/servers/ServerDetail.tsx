import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  serversGetOptions,
  serversListQueryKey,
  serversStartMutation,
  serversStopMutation,
  templatesListOptions,
} from '../../api/@tanstack/react-query.gen';
import type { MeDto } from '../../api/types.gen';
import { History } from './History';
import { ConfigFiles } from './ConfigFiles';
import { Backups } from './Backups';
import { Content } from './Content';
import { FileManager } from './FileManager';
import { ServerSettings } from './SettingsFields';
import { StatusBadge } from './StatusBadge';
import { useServerConsole } from './useServerConsole';

const mb = (bytes: number) => Math.round(bytes / 1024 / 1024);

export function ServerDetail({ id, me, onBack }: { id: string; me: MeDto; onBack: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const server = useQuery(serversGetOptions({ path: { id } }));
  const templates = useQuery(templatesListOptions());

  // Terminal (read-only). Commands go through the input below, so the terminal stays simple.
  const host = useRef<HTMLDivElement>(null);
  const terminal = useRef<Terminal | null>(null);
  useEffect(() => {
    const term = new Terminal({ disableStdin: true, convertEol: true, fontSize: 13, theme: { background: '#16181d' } });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host.current!);
    fit.fit();
    terminal.current = term;
    const resize = () => fit.fit();
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      term.dispose();
    };
  }, []);

  const live = useServerConsole(id, (data, reset) => {
    if (reset) terminal.current?.reset();
    terminal.current?.write(data);
  });

  const refresh = () => void queryClient.invalidateQueries({ queryKey: serversListQueryKey() });
  const start = useMutation({ ...serversStartMutation(), onSettled: refresh });
  const stop = useMutation({ ...serversStopMutation(), onSettled: refresh });
  const actionError = (start.error ?? stop.error) as { detail?: string } | null;

  const [command, setCommand] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!command.trim()) return;
    live.send(command);
    setCommand('');
  };

  const status = live.status?.status ?? server.data?.status ?? 'stopped';
  const restart = live.status?.restart;
  const message = [restart && t('detail.restarting', { attempt: restart.attempt, max: restart.maxAttempts }), live.status?.message ?? server.data?.statusMessage]
    .filter(Boolean)
    .join(' · ');
  const busy = status === 'installing' || status === 'starting' || status === 'stopping';
  const tpl = templates.data?.find((x) => x.id === server.data?.templateId);
  // Settings and files apply on the next start; a pending crash restart reuses the old ones.
  const running = status !== 'stopped' && (status !== 'crashed' || !!restart);

  return (
    <section className="space-y-4">
      <button type="button" onClick={onBack} className="text-sm text-zinc-400 hover:text-zinc-200">
        ← {t('detail.back')}
      </button>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-surface-raised p-4">
        <div>
          <h2 className="text-lg font-medium">{server.data?.name}</h2>
          <p className="text-sm text-zinc-400">
            {tpl ? `${tpl.game.name} · ${tpl.variant.name}` : server.data?.templateId} · {t('servers.port', { port: server.data?.hostPort })}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <StatusBadge status={status} />
          {status === 'running' || status === 'starting' || restart ? (
            <button type="button" disabled={stop.isPending} onClick={() => stop.mutate({ path: { id } })} className="rounded-lg bg-white/10 px-3 py-1.5 text-sm hover:bg-white/15 disabled:opacity-50">
              {t('detail.stop')}
            </button>
          ) : (
            <button type="button" disabled={busy || start.isPending} onClick={() => start.mutate({ path: { id } })} className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-zinc-900 disabled:opacity-50">
              {status === 'sleeping' ? t('detail.wake') : t('detail.start')}
            </button>
          )}
        </div>
      </div>

      {(message || actionError) && (
        <p role="alert" className={`rounded-lg p-3 text-sm ${status === 'crashed' || actionError ? 'bg-red-500/10 text-red-200' : 'bg-white/5 text-zinc-300'}`}>
          {actionError?.detail ?? message}
        </p>
      )}

      {live.players && (
        <div className="rounded-xl bg-surface-raised p-4">
          <p className="text-sm text-zinc-400">{t('detail.players')}</p>
          <p className="text-xl font-medium">{t('detail.playersOnline', { online: live.players.online, max: live.players.max })}</p>
          {live.players.online > 0 && (
            <ul className="mt-2 flex flex-wrap gap-2 text-sm">
              {live.players.names.map((name) => (
                <li key={name} className="rounded-md bg-white/5 px-2 py-0.5">
                  {name}
                </li>
              ))}
              {live.players.online > live.players.names.length && (
                <li className="px-1 py-0.5 text-zinc-400">{t('detail.playersMore', { count: live.players.online - live.players.names.length })}</li>
              )}
            </ul>
          )}
        </div>
      )}

      {live.stats && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl bg-surface-raised p-4">
            <p className="text-sm text-zinc-400">{t('detail.cpu')}</p>
            <p className="text-xl font-medium">{live.stats.cpuPercent.toFixed(1)} %</p>
          </div>
          <div className="rounded-xl bg-surface-raised p-4">
            <p className="text-sm text-zinc-400">{t('detail.memory')}</p>
            <p className="text-xl font-medium">
              {mb(live.stats.memoryBytes)} / {mb(live.stats.memoryLimitBytes)} MB
            </p>
            <div className="mt-2 h-1.5 rounded-full bg-white/10">
              <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (live.stats.memoryBytes / live.stats.memoryLimitBytes) * 100)}%` }} />
            </div>
          </div>
        </div>
      )}

      <History serverId={id} />

      <div className="overflow-hidden rounded-xl bg-[#16181d]">
        <div className="flex items-center justify-between px-4 py-2 text-xs text-zinc-400">
          <span>{t('detail.console')}</span>
          <span>{live.connected ? t('detail.live') : t('detail.connecting')}</span>
        </div>
        <div ref={host} className="h-96 px-2" />
        {me.permissions.includes('sendCommands') && (
        <form onSubmit={submit} className="flex border-t border-white/5">
          <span className="px-3 py-2 text-zinc-500">&gt;</span>
          <input
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            disabled={status !== 'running'}
            placeholder={status === 'running' ? t('detail.commandPlaceholder') : t('detail.commandOffline')}
            aria-label={t('detail.commandPlaceholder')}
            className="flex-1 bg-transparent py-2 pr-3 font-mono text-sm outline-none disabled:opacity-50"
          />
        </form>
        )}
      </div>

      {server.data && tpl && me.permissions.includes('manageServers') && (
        <>
          <ServerSettings key={server.data.id} server={server.data} fields={tpl.config} running={running} />
          <Content key={`content-${server.data.id}`} serverId={server.data.id} kinds={tpl.content} running={running} />
          <ConfigFiles key={`files-${server.data.id}`} serverId={server.data.id} files={tpl.files} running={running} />
          <FileManager key={`manager-${server.data.id}`} serverId={server.data.id} running={running} />
          <Backups key={`backups-${server.data.id}`} serverId={server.data.id} stopped={status === 'stopped' || (status === 'crashed' && !restart)} />
        </>
      )}
    </section>
  );
}
