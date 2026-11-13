import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { serversGetQueryKey, serversListQueryKey, serversUpdateSettingsMutation, templatesVersionsOptions } from '../../api/@tanstack/react-query.gen';
import type { ServerDto, TemplateConfigFieldDto } from '../../api/types.gen';
import { localize } from '../../lib/localize';

export const input = 'w-full rounded-md bg-surface px-3 py-2 text-zinc-100 outline-none focus:ring-2 focus:ring-accent';

type Value = string | number;
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
  return Object.fromEntries(fields.map((f) => [f.key, f.type === 'integer' ? Number(draft[f.key]) : draft[f.key]]));
}

/** One input per config field of a template (ADR 0005); the browser checks min, max and patterns. Game settings are files (ADR 0011). */
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
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage;

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {fields.map((f) => (
        <label key={f.key} className="space-y-1 text-sm">
          <span className="text-zinc-400">{localize(f.label, lang)}</span>
          {f.type === 'version' ? (
            <VersionSelect templateId={templateId} value={draft[f.key]} onChange={(v) => onChange({ ...draft, [f.key]: v })} />
          ) : (
            <input
              required
              type={f.type === 'integer' ? 'number' : 'text'}
              min={f.min}
              max={f.max}
              pattern={f.pattern}
              value={draft[f.key]}
              onChange={(e) => onChange({ ...draft, [f.key]: e.target.value })}
              className={input}
            />
          )}
          {/* ponytail: packs are named by link; a search in the panel can come later (ADR 0020) */}
          {f.type === 'modpack' && (
            <a href="https://modrinth.com/modpacks" target="_blank" rel="noreferrer" className="block text-xs text-accent hover:underline">
              {t('modpack.browse')}
            </a>
          )}
        </label>
      ))}
    </div>
  );
}

/**
 * Versions from the template's version provider (ADR 0012): "latest" or a release, snapshots on
 * request. If the list cannot be loaded (e.g. the panel is offline), the version can be typed.
 */
function VersionSelect({ templateId, value, onChange }: { templateId: string; value: string; onChange: (value: string) => void }) {
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
        <option value="LATEST">{t('versions.latest', { version: versions.data?.latest ?? '…' })}</option>
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
