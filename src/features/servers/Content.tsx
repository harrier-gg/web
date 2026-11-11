import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { contentInstallMutation, contentListOptions, contentListQueryKey, contentRemoveMutation, contentSearchOptions } from '../../api/@tanstack/react-query.gen';
import type { ContentKindDto, ContentProjectDto, InstalledContentDto } from '../../api/types.gen';
import { localize } from '../../lib/localize';
import { input } from './SettingsFields';

/** Names of the providers templates use (ADR 0017); unknown ones show as they are. */
const SOURCES: Record<string, string> = { modrinth: 'Modrinth', curseforge: 'CurseForge', hangar: 'Hangar' };

/** One block per kind of content the template offers, e.g. "Mods" or "Plugins" (ADR 0017). */
export function Content({ serverId, kinds, running }: { serverId: string; kinds: ContentKindDto[]; running: boolean }) {
  return kinds.map((kind) => <ContentKind key={kind.kind} serverId={serverId} kind={kind} running={running} />);
}

function ContentKind({ serverId, kind, running }: { serverId: string; kind: ContentKindDto; running: boolean }) {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <details className="rounded-xl bg-surface-raised p-4" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="cursor-pointer font-medium">{localize(kind.label, i18n.resolvedLanguage)}</summary>
      {open && <Body serverId={serverId} kind={kind} running={running} />}
    </details>
  );
}

function Side({ side }: { side: ContentProjectDto['side'] }) {
  const { t } = useTranslation();
  if (side !== 'client') return null;
  // A mod only players need does nothing on the server (ADR 0005, 0017).
  return <span className="rounded bg-amber-400/15 px-1.5 py-0.5 text-xs text-amber-200">{t('content.clientOnly')}</span>;
}

function Body({ serverId, kind, running }: { serverId: string; kind: ContentKindDto; running: boolean }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [source, setSource] = useState(kind.sources[0]);
  const [typed, setTyped] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const listOptions = { path: { id: serverId } };
  const installed = useQuery(contentListOptions(listOptions));
  const mine = installed.data?.filter((c) => c.kind === kind.kind) ?? [];
  const search = useQuery({ ...contentSearchOptions({ path: { id: serverId }, query: { kind: kind.kind, source, query } }), staleTime: 60_000 });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: contentListQueryKey(listOptions) });
  const failed = (e: unknown) => setError((e as { detail?: string }).detail ?? t('content.failed'));
  const install = useMutation({
    ...contentInstallMutation(),
    onSuccess: (added: InstalledContentDto[]) => {
      setDone(t('content.installed', { names: added.map((a) => `${a.name} ${a.version}`).join(', ') }));
      refresh();
    },
    onError: failed,
    onSettled: refresh,
  });
  const remove = useMutation({ ...contentRemoveMutation(), onSuccess: refresh, onError: failed });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setQuery(typed.trim());
  };
  const isInstalled = (p: ContentProjectDto) => installed.data?.some((c) => c.provider === source && c.projectId === p.id);
  const count = (n: number) => new Intl.NumberFormat(undefined, { notation: 'compact' }).format(n);

  return (
    <div className="mt-4 space-y-4 text-sm">
      {running && <p className="text-zinc-400">{t('content.restartHint')}</p>}
      {error && (
        <p role="alert" className="text-red-300">
          {error}
        </p>
      )}
      {done && (
        <p role="status" className="text-emerald-300">
          {done}
        </p>
      )}

      {mine.length > 0 && (
        <ul className="divide-y divide-white/5">
          {mine.map((c) => (
            <li key={c.id} className="flex items-center gap-3 py-1.5">
              <span className="min-w-0 flex-1 truncate">
                {c.name} <span className="text-zinc-500">{c.version}</span>
              </span>
              {c.dependency && <span className="rounded bg-white/5 px-1.5 py-0.5 text-xs text-zinc-400">{t('content.dependency')}</span>}
              <Side side={c.side} />
              <button
                type="button"
                title={t('files.delete')}
                aria-label={`${t('files.delete')}: ${c.name}`}
                className="inline-block w-7 rounded-md py-1 text-center text-red-300 hover:bg-white/10"
                onClick={() => {
                  if (!window.confirm(t('content.removeConfirm', { name: c.name }))) return;
                  setError(null);
                  remove.mutate({ path: { id: serverId, contentId: c.id } });
                }}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={submit} className="flex flex-wrap gap-2">
        {kind.sources.length > 1 && (
          <select value={source} onChange={(e) => setSource(e.target.value)} aria-label={t('content.source')} className={`${input} w-auto`}>
            {kind.sources.map((s) => (
              <option key={s} value={s}>
                {SOURCES[s] ?? s}
              </option>
            ))}
          </select>
        )}
        <input
          type="search"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={t('content.searchPlaceholder', { source: SOURCES[source] ?? source })}
          className={`${input} min-w-0 flex-1`}
        />
        <button type="submit" className="rounded-lg bg-white/10 px-3 py-2 hover:bg-white/15">
          {t('content.search')}
        </button>
      </form>

      {search.isPending ? (
        <p className="text-zinc-400">{t('files.loading')}</p>
      ) : search.isError ? (
        <p role="alert" className="text-red-300">
          {(search.error as { detail?: string }).detail ?? t('content.failed')}
        </p>
      ) : search.data.length === 0 ? (
        <p className="text-zinc-400">{t('content.nothing')}</p>
      ) : (
        <ul className="divide-y divide-white/5">
          {search.data.map((p) => (
            <li key={p.id} className="flex items-start gap-3 py-2">
              {p.iconUrl ? <img src={p.iconUrl} alt="" className="size-10 shrink-0 rounded-md" loading="lazy" /> : <span className="size-10 shrink-0 rounded-md bg-white/5" />}
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2">
                  <a href={p.pageUrl} target="_blank" rel="noreferrer" className="font-medium hover:underline">
                    {p.name}
                  </a>
                  <Side side={p.side} />
                </p>
                <p className="truncate text-zinc-400">{p.summary}</p>
                <p className="text-xs text-zinc-500">
                  {p.author && `${p.author} · `}
                  {t('content.downloads', { count: count(p.downloads) })}
                </p>
              </div>
              <button
                type="button"
                disabled={isInstalled(p) || install.isPending}
                onClick={() => {
                  setError(null);
                  setDone(null);
                  install.mutate({ path: { id: serverId }, body: { kind: kind.kind, source, projectId: p.id } });
                }}
                className="shrink-0 rounded-lg bg-accent px-3 py-1.5 font-medium text-zinc-900 disabled:opacity-50"
              >
                {isInstalled(p) ? t('content.isInstalled') : install.isPending && install.variables?.body.projectId === p.id ? t('content.installing') : t('content.install')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
