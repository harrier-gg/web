import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  serversGetQueryKey,
  serversListQueryKey,
  serversUpdateSettingsMutation,
  templatesModpacksOptions,
  templatesVersionsOptions,
} from '../../api/@tanstack/react-query.gen';
import type { ServerDto, TemplateConfigFieldDto } from '../../api/types.gen';
import { localize } from '../../lib/localize';

export const input = 'w-full rounded-md bg-surface px-3 py-2 text-zinc-100 outline-none focus:ring-2 focus:ring-accent';

type Value = string | number | boolean;
/** Form state: values as typed. */
export type Draft = Record<string, string>;

/** Form state for the given fields, filled with stored values or the template's defaults. */
export function draftOf(fields: TemplateConfigFieldDto[], settings: Record<string, Value> = {}): Draft {
  return Object.fromEntries(
    fields.map((f) => {
      return [f.key, String(settings[f.key] ?? f.default)];
    }),
  );
}

/** Turns form state into settings for the API; only keys of the given fields. */
export function toSettings(fields: TemplateConfigFieldDto[], draft: Draft): Record<string, Value> {
  const value = (f: TemplateConfigFieldDto) => (f.type === 'integer' ? Number(draft[f.key]) : f.type === 'boolean' ? draft[f.key] === 'true' : draft[f.key]);
  return Object.fromEntries(fields.map((f) => [f.key, value(f)]));
}

/**
 * One input per config field of a template (ADR 0005); the browser checks min, max and patterns.
 * Game settings are files (ADR 0011). An empty secret gets a random value from the panel (ADR 0022).
 */
export function SettingsFields({
  templateId,
  fields,
  draft,
  onChange,
}: {
  templateId: string;
  fields: TemplateConfigFieldDto[];
  draft: Draft;
  onChange: (draft: Draft) => void;
}) {
  const { i18n } = useTranslation();
  const lang = i18n.resolvedLanguage;

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {fields.map((f) =>
        f.type === 'boolean' ? (
          <label key={f.key} className="flex items-center gap-2 self-end py-2 text-sm">
            <input
              type="checkbox"
              checked={draft[f.key] === 'true'}
              onChange={(e) => onChange({ ...draft, [f.key]: String(e.target.checked) })}
              className="size-4 accent-accent"
            />
            <span className="text-zinc-300">{localize(f.label, lang)}</span>
          </label>
        ) : (
        <label key={f.key} className="space-y-1 text-sm">
          <span className="text-zinc-400">{localize(f.label, lang)}</span>
          {f.type === 'version' ? (
            <VersionSelect
              templateId={templateId}
              pack={fields.some((p) => p.type === 'modpack')}
              value={draft[f.key]}
              onChange={(v) => onChange({ ...draft, [f.key]: v })}
            />
          ) : f.type === 'secret' ? (
            <SecretInput field={f} value={draft[f.key]} onChange={(v) => onChange({ ...draft, [f.key]: v })} />
          ) : (
            <input
              // Text may be empty unless the template asks for a minimum length (the panel checks the same).
              required={f.type !== 'string' || (f.min ?? 0) > 0}
              minLength={f.type === 'string' ? f.min : undefined}
              maxLength={f.type === 'string' ? f.max : undefined}
              type={f.type === 'integer' ? 'number' : 'text'}
              min={f.min}
              max={f.max}
              pattern={f.pattern}
              value={draft[f.key]}
              onChange={(e) => onChange({ ...draft, [f.key]: e.target.value })}
              className={input}
            />
          )}
        </label>
        ),
      )}
      {fields
        .filter((f) => f.type === 'modpack')
        .map((f) => (
          <ModpackSearch
            key={f.key}
            templateId={templateId}
            version={draft[fields.find((v) => v.type === 'version')?.key ?? ''] ?? ''}
            onPick={(link) => onChange({ ...draft, [f.key]: link })}
          />
        ))}
    </div>
  );
}

/** A password or token, hidden until shown; empty lets the panel pick a random one. */
function SecretInput({ field, value, onChange }: { field: TemplateConfigFieldDto; value: string; onChange: (value: string) => void }) {
  const { t } = useTranslation();
  const [shown, setShown] = useState(false);
  return (
    <span className="flex gap-2">
      <input
        type={shown ? 'text' : 'password'}
        // Checks only what is typed; empty means "pick one".
        minLength={field.min}
        maxLength={field.max}
        pattern={field.pattern}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('create.secretRandom')}
        autoComplete="new-password"
        className={`${input} min-w-0 flex-1`}
      />
      <button type="button" onClick={() => setShown(!shown)} className="shrink-0 rounded-lg bg-white/10 px-3 hover:bg-white/15">
        {shown ? t('create.hide') : t('create.show')}
      </button>
    </span>
  );
}

/**
 * Finds Modrinth modpacks for the chosen Minecraft version; picking one fills in its link, which
 * can also be typed or pasted (ADR 0020). Packs only for players are not offered.
 */
function ModpackSearch({ templateId, version, onPick }: { templateId: string; version: string; onPick: (link: string) => void }) {
  const { t } = useTranslation();
  const [typed, setTyped] = useState('');
  const [query, setQuery] = useState<string | null>(null);
  const packs = useQuery({
    ...templatesModpacksOptions({ query: { template: templateId, version, query: query ?? '' } }),
    enabled: query !== null,
    staleTime: 60_000,
  });
  const count = (n: number) => new Intl.NumberFormat(undefined, { notation: 'compact' }).format(n);

  return (
    <div className="min-w-0 space-y-2 text-sm sm:col-span-3">
      <div className="flex gap-2">
        <input
          type="search"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          // Enter searches instead of submitting the surrounding form.
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              setQuery(typed);
            }
          }}
          placeholder={t('modpack.search')}
          aria-label={t('modpack.search')}
          className={`${input} min-w-0 flex-1`}
        />
        <button type="button" onClick={() => setQuery(typed)} className="rounded-lg bg-white/10 px-3 py-2 hover:bg-white/15">
          {t('content.search')}
        </button>
      </div>
      {query !== null &&
        (packs.isPending ? (
          <p className="text-zinc-400">{t('files.loading')}</p>
        ) : packs.isError ? (
          <p role="alert" className="text-red-300">
            {(packs.error as { detail?: string }).detail ?? t('content.failed')}
          </p>
        ) : packs.data.length === 0 ? (
          <p className="text-zinc-400">{t('content.nothing')}</p>
        ) : (
          <ul className="max-h-80 divide-y divide-white/5 overflow-y-auto rounded-md bg-surface px-3">
            {packs.data.map((p) => (
              <li key={p.id} className="flex items-start gap-3 py-2">
                {p.iconUrl ? <img src={p.iconUrl} alt="" className="size-10 shrink-0 rounded-md" loading="lazy" /> : <span className="size-10 shrink-0 rounded-md bg-white/5" />}
                <div className="min-w-0 flex-1">
                  <a href={p.pageUrl} target="_blank" rel="noreferrer" className="font-medium hover:underline">
                    {p.name}
                  </a>
                  <p className="truncate text-zinc-400">{p.summary}</p>
                  <p className="text-xs text-zinc-500">
                    {p.author && `${p.author} · `}
                    {t('content.downloads', { count: count(p.downloads) })}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onPick(p.pageUrl);
                    setQuery(null);
                  }}
                  className="shrink-0 rounded-lg bg-accent px-3 py-1.5 font-medium text-zinc-900"
                >
                  {t('modpack.pick')}
                </button>
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}

/**
 * Versions from the template's version provider (ADR 0012): "latest" or a release, snapshots on
 * request. If the list cannot be loaded (e.g. the panel is offline), the version can be typed.
 * With a modpack, "latest" is the pack's newest version, not the game's (ADR 0020).
 */
function VersionSelect({ templateId, pack, value, onChange }: { templateId: string; pack: boolean; value: string; onChange: (value: string) => void }) {
  const { t } = useTranslation();
  const versions = useQuery({ ...templatesVersionsOptions({ query: { template: templateId } }), staleTime: 10 * 60_000, retry: false });
  const [snapshots, setSnapshots] = useState(false);

  if (versions.isError) {
    return (
      <>
        <input required pattern="[A-Za-z0-9._\-]{1,64}" value={value} onChange={(e) => onChange(e.target.value)} className={input} />
        <span className="block text-xs text-zinc-500">{t('versions.offline')}</span>
      </>
    );
  }
  const shown = versions.data?.versions.filter((v) => snapshots || v.type === 'release' || v.id === value) ?? [];
  return (
    <>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={input}>
        <option value="LATEST">{pack ? t('versions.latestPack') : t('versions.latest', { version: versions.data?.latest ?? '…' })}</option>
        {shown.map((v) => (
          <option key={v.id} value={v.id}>
            {v.type === 'snapshot' ? `${v.id} (${t('versions.snapshot')})` : v.id}
          </option>
        ))}
      </select>
      <span className="flex items-center gap-2 text-xs text-zinc-500">
        <input type="checkbox" checked={snapshots} onChange={(e) => setSnapshots(e.target.checked)} className="accent-accent" />
        {t('versions.showSnapshots')}
      </span>
    </>
  );
}

/** Settings of an existing server. They apply on the next start. */
export function ServerSettings({ server, fields, running }: { server: ServerDto; fields: TemplateConfigFieldDto[]; running: boolean }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(() => draftOf(fields, server.settings));
  const [saved, setSaved] = useState<string | null>(null);
  const save = useMutation({
    ...serversUpdateSettingsMutation(),
    onSuccess: (updated) => {
      queryClient.setQueryData(serversGetQueryKey({ path: { id: server.id } }), updated);
      void queryClient.invalidateQueries({ queryKey: serversListQueryKey() });
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    // The hint depends on whether the server ran when saving, not on what it does later.
    const hint = running ? t('detail.settingsSavedRestart') : t('detail.settingsSaved');
    save.mutate({ path: { id: server.id }, body: { settings: toSettings(fields, draft) } }, { onSuccess: () => setSaved(hint) });
  };
  const error = save.error as { detail?: string } | null;

  return (
    <details className="rounded-xl bg-surface-raised p-4">
      <summary className="cursor-pointer font-medium">{t('detail.settings')}</summary>
      <form onSubmit={submit} className="mt-4 space-y-4">
        <SettingsFields
          templateId={server.templateId}
          fields={fields}
          draft={draft}
          onChange={(d) => {
            setDraft(d);
            setSaved(null);
            save.reset();
          }}
        />
        <div className="flex flex-wrap items-center justify-end gap-3 text-sm">
          {error && <p role="alert" className="text-red-300">{error.detail ?? t('detail.settingsFailed')}</p>}
          {saved && <p role="status" className="text-zinc-400">{saved}</p>}
          <button type="submit" disabled={save.isPending} className="rounded-lg bg-accent px-3 py-1.5 font-medium text-zinc-900 disabled:opacity-50">
            {t('detail.save')}
          </button>
        </div>
      </form>
    </details>
  );
}
