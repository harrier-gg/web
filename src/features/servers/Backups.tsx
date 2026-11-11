import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  backupsCreateMutation,
  backupsRemoveMutation,
  backupsRestoreMutation,
  backupsScheduleMutation,
  backupsSummaryOptions,
  backupsSummaryQueryKey,
} from '../../api/@tanstack/react-query.gen';
import type { BackupsSummaryDto } from '../../api/types.gen';
import { size } from './FileManager';
import { input } from './SettingsFields';

/** Backups of one server (ADR 0016): schedule, back up now, download, restore, delete. */
export function Backups({ serverId, stopped }: { serverId: string; stopped: boolean }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <details className="rounded-xl bg-surface-raised p-4" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="cursor-pointer font-medium">{t('backups.title')}</summary>
      {open && <Content serverId={serverId} stopped={stopped} />}
    </details>
  );
}

function Content({ serverId, stopped }: { serverId: string; stopped: boolean }) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const options = { path: { id: serverId } };
  // While the agent works, ask every few seconds whether it is done.
  const summary = useQuery({ ...backupsSummaryOptions(options), refetchInterval: (q) => (q.state.data?.inProgress ? 3000 : false) });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: backupsSummaryQueryKey(options) });
  const [error, setError] = useState<string | null>(null);
  const done = { onSuccess: refresh, onError: (e: unknown) => setError((e as { detail?: string }).detail ?? t('backups.failed')) };
  const create = useMutation({ ...backupsCreateMutation(), ...done });
  const restore = useMutation({ ...backupsRestoreMutation(), ...done });
  const remove = useMutation({ ...backupsRemoveMutation(), ...done });

  if (summary.isPending) return <p className="mt-3 text-sm text-zinc-400">{t('files.loading')}</p>;
  if (summary.isError) {
    return (
      <p role="alert" className="mt-3 text-sm text-red-300">
        {(summary.error as { detail?: string }).detail ?? t('backups.failed')}
      </p>
    );
  }
  const data = summary.data;
  const date = (seconds: number | null) => (seconds === null ? '' : new Date(seconds * 1000).toLocaleString(i18n.resolvedLanguage, { dateStyle: 'medium', timeStyle: 'short' }));
  const icon = 'inline-block w-7 rounded-md py-1 text-center text-zinc-300 hover:bg-white/10 disabled:opacity-40';

  return (
    <div className="mt-4 space-y-4 text-sm">
      <Schedule serverId={serverId} data={data} onSaved={refresh} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-zinc-400">
          {data.inProgress
            ? t(data.inProgress === 'restore' ? 'backups.restoring' : 'backups.creating')
            : data.lastBackupAt
              ? t('backups.last', { date: new Date(data.lastBackupAt).toLocaleString(i18n.resolvedLanguage, { dateStyle: 'medium', timeStyle: 'short' }) })
              : t('backups.none')}
        </p>
        <button
          type="button"
          disabled={!!data.inProgress || create.isPending}
          onClick={() => {
            setError(null);
            create.mutate({ path: { id: serverId } });
          }}
          className="rounded-lg bg-accent px-3 py-1.5 font-medium text-zinc-900 disabled:opacity-50"
        >
          {t('backups.now')}
        </button>
      </div>

      {(error ?? data.lastError) && (
        <p role="alert" className="text-red-300">
          {error ?? data.lastError}
        </p>
      )}
      {data.backups === null ? (
        <p className="text-zinc-400">{t('backups.offline')}</p>
      ) : data.backups.length === 0 ? null : (
        <ul className="divide-y divide-white/5">
          {data.backups.map((b) => (
            <li key={b.name} className="flex items-center gap-3 py-1.5">
              <span className="min-w-0 flex-1 truncate">
                {date(b.modified)}
                {b.name.includes('before-restore') && <span className="text-zinc-500"> · {t('backups.beforeRestore')}</span>}
              </span>
              <span className="whitespace-nowrap text-zinc-400">{size(b.size)}</span>
              <span className="whitespace-nowrap">
                <a
                  href={`/api/v1/servers/${serverId}/backups/download?name=${encodeURIComponent(b.name)}`}
                  download={b.name}
                  title={t('files.download')}
                  aria-label={`${t('files.download')}: ${date(b.modified)}`}
                  className={icon}
                >
                  ⬇
                </a>
                <button
                  type="button"
                  disabled={!stopped || !!data.inProgress}
                  title={stopped ? t('backups.restore') : t('backups.stopFirst')}
                  aria-label={`${t('backups.restore')}: ${date(b.modified)}`}
                  className={icon}
                  onClick={() => {
                    if (!window.confirm(t('backups.restoreConfirm', { date: date(b.modified) }))) return;
                    setError(null);
                    restore.mutate({ path: { id: serverId }, body: { name: b.name } });
                  }}
                >
                  ↺
                </button>
                <button
                  type="button"
                  title={t('files.delete')}
                  aria-label={`${t('files.delete')}: ${date(b.modified)}`}
                  className={`${icon} text-red-300`}
                  onClick={() => {
                    if (window.confirm(t('backups.deleteConfirm', { date: date(b.modified) }))) remove.mutate({ path: { id: serverId }, query: { name: b.name } });
                  }}
                >
                  ✕
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {!stopped && data.backups?.length ? <p className="text-xs text-zinc-500">{t('backups.stopFirst')}</p> : null}
    </div>
  );
}

function Schedule({ serverId, data, onSaved }: { serverId: string; data: BackupsSummaryDto; onSaved: () => void }) {
  const { t } = useTranslation();
  const [everyHours, setEveryHours] = useState(String(data.everyHours));
  const [keep, setKeep] = useState(String(data.keep));
  const save = useMutation({ ...backupsScheduleMutation(), onSuccess: onSaved });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate({ path: { id: serverId }, body: { everyHours: Number(everyHours), keep: Number(keep) } });
  };
  const changed = everyHours !== String(data.everyHours) || keep !== String(data.keep);
  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
      <label className="space-y-1">
        <span className="block text-zinc-400">{t('backups.every')}</span>
        <input type="number" required min={0} max={168} value={everyHours} onChange={(e) => setEveryHours(e.target.value)} className={`${input} w-28`} />
      </label>
      <label className="space-y-1">
        <span className="block text-zinc-400">{t('backups.keep')}</span>
        <input type="number" required min={1} max={100} value={keep} onChange={(e) => setKeep(e.target.value)} className={`${input} w-28`} />
      </label>
      <button type="submit" disabled={!changed || save.isPending} className="rounded-lg bg-white/10 px-3 py-2 hover:bg-white/15 disabled:opacity-50">
        {t('detail.save')}
      </button>
      <p className="basis-full text-xs text-zinc-500">{t('backups.scheduleHint')}</p>
    </form>
  );
}
