import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { settingsGetOptions, settingsGetQueryKey, settingsSetMutation } from '../../api/@tanstack/react-query.gen';
import type { IntegrationSettingsDto, SettingEntryDto } from '../../api/types.gen';

const input = 'w-full rounded-md bg-surface px-3 py-2 text-zinc-100 outline-none focus:ring-2 focus:ring-accent disabled:opacity-60';
type Key = SettingEntryDto['key'];

/**
 * Credentials for Discord and CurseForge, for the owner (ADR 0019). Secrets are only written:
 * the page shows whether they are set, never their value.
 */
export function IntegrationsPage() {
  const { t } = useTranslation();
  const settings = useQuery({
    ...settingsGetOptions(),
    // While the bot connects, ask again until it is online or failed.
    refetchInterval: (q) => (q.state.data?.bot.state === 'connecting' ? 2000 : false),
  });
  if (settings.isPending) return <p className="text-sm text-zinc-400">{t('files.loading')}</p>;
  if (settings.isError) return <p className="text-sm text-red-300">{t('integrations.loadFailed')}</p>;
  const data = settings.data;

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-medium">{t('integrations.title')}</h2>
      <p className="text-sm text-zinc-400">{t('integrations.intro')}</p>
      {!data.canStoreSecrets && <p className="rounded-lg bg-amber-400/10 p-3 text-sm text-amber-200">{t('integrations.noAppKey')}</p>}

      <Section
        data={data}
        title={t('integrations.discordLogin')}
        keys={['discord.clientId', 'discord.clientSecret']}
        help={
          <>
            {t('integrations.discordLoginHelp')}
            <Copy value={data.discordRedirectUrl} />
          </>
        }
      />
      <Section
        data={data}
        title={t('integrations.discordBot')}
        keys={['discord.botToken', 'discord.channelId']}
        help={t('integrations.discordBotHelp')}
        status={<BotStatus bot={data.bot} />}
      />
      <Section data={data} title="CurseForge" keys={['curseforge.apiKey']} help={t('integrations.curseforgeHelp')} />
    </section>
  );
}

function Copy({ value }: { value: string }) {
  const { t } = useTranslation();
  return (
    <span className="mt-2 flex items-center gap-2">
      <code className="min-w-0 flex-1 truncate rounded bg-surface px-2 py-1 font-mono text-xs">{value}</code>
      <button type="button" onClick={() => void navigator.clipboard?.writeText(value)} className="rounded-md px-2 py-1 text-xs hover:bg-white/10">
        {t('integrations.copy')}
      </button>
    </span>
  );
}

function BotStatus({ bot }: { bot: IntegrationSettingsDto['bot'] }) {
  const { t } = useTranslation();
  const color = { off: 'bg-zinc-500', connecting: 'bg-amber-400 animate-pulse', online: 'bg-emerald-400', error: 'bg-red-400' }[bot.state];
  return (
    <div className="space-y-1 text-sm">
      <p className="flex items-center gap-2">
        <span aria-hidden className={`size-2.5 rounded-full ${color}`} />
        {bot.state === 'online' ? t('integrations.botOnline', { name: bot.user }) : t(`integrations.bot.${bot.state}`)}
      </p>
      {bot.error && <p className="text-red-300">{bot.error}</p>}
      {bot.inviteUrl && (
        <a href={bot.inviteUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">
          {t('integrations.invite')}
        </a>
      )}
    </div>
  );
}

/** A group of settings with one save button. Empty secret fields keep the stored secret. */
function Section({ data, title, keys, help, status }: { data: IntegrationSettingsDto; title: string; keys: Key[]; help: ReactNode; status?: ReactNode }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const entries = keys.map((key) => data.settings.find((s) => s.key === key)!);
  const [draft, setDraft] = useState<Partial<Record<Key, string>>>({});
  const [saved, setSaved] = useState(false);
  const save = useMutation({
    ...settingsSetMutation(),
    onSuccess: (updated) => {
      queryClient.setQueryData(settingsGetQueryKey(), updated);
      setDraft({});
      setSaved(true);
    },
  });
  const change = (values: Partial<Record<Key, string | null>>) => {
    setSaved(false);
    save.mutate({ body: { values } });
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    // Only what was typed; an empty secret field means "keep".
    change(Object.fromEntries(Object.entries(draft).filter(([, v]) => v !== '')));
  };
  const error = save.error as { detail?: string } | null;

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl bg-surface-raised p-4 text-sm">
      <div className="space-y-1">
        <h3 className="font-medium">{title}</h3>
        <div className="text-zinc-400">{help}</div>
      </div>
      {status}
      <div className="grid gap-4 sm:grid-cols-2">
        {entries.map((entry) => (
          <label key={entry.key} className="space-y-1">
            <span className="text-zinc-400">{t(`integrations.keys.${entry.key}`)}</span>
            <input
              type={entry.secret ? 'password' : 'text'}
              autoComplete="off"
              disabled={entry.fromEnv}
              value={draft[entry.key] ?? (entry.secret ? '' : (entry.value ?? ''))}
              placeholder={entry.secret && entry.set ? t('integrations.secretSet') : ''}
              onChange={(e) => setDraft({ ...draft, [entry.key]: e.target.value })}
              className={input}
            />
            {entry.fromEnv && <span className="block text-xs text-zinc-500">{t('integrations.fromEnv')}</span>}
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-3">
        {error && <p className="text-red-300">{error.detail ?? t('integrations.saveFailed')}</p>}
        {saved && <p className="text-zinc-400">{t('detail.settingsSaved')}</p>}
        {entries.some((e) => e.set && !e.fromEnv) && (
          <button
            type="button"
            onClick={() => window.confirm(t('integrations.removeConfirm', { name: title })) && change(Object.fromEntries(keys.map((k) => [k, null])))}
            className="rounded-lg px-3 py-1.5 text-red-300 hover:bg-white/5"
          >
            {t('integrations.remove')}
          </button>
        )}
        <button type="submit" disabled={save.isPending || Object.keys(draft).length === 0} className="rounded-lg bg-accent px-3 py-1.5 font-medium text-zinc-900 disabled:opacity-50">
          {t('detail.save')}
        </button>
      </div>
    </form>
  );
}
