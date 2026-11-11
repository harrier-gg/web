import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { serversGetQueryKey, serversListQueryKey, serversUpdateSettingsMutation } from '../../api/@tanstack/react-query.gen';
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
export function SettingsFields({ fields, draft, onChange }: { fields: TemplateConfigFieldDto[]; draft: Draft; onChange: (draft: Draft) => void }) {
  const { i18n } = useTranslation();
  const lang = i18n.resolvedLanguage;

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {fields.map((f) => (
        <label key={f.key} className="space-y-1 text-sm">
          <span className="text-zinc-400">{localize(f.label, lang)}</span>
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
        </label>
      ))}
    </div>
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
