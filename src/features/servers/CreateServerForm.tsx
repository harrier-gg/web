import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  nodesListOptions,
  serversCreateMutation,
  serversListQueryKey,
  templatesListOptions,
} from '../../api/@tanstack/react-query.gen';
import { localize } from '../../lib/localize';

const input = 'w-full rounded-md bg-surface px-3 py-2 text-zinc-100 outline-none focus:ring-2 focus:ring-accent';

/** Game → variant → settings (ADR 0005). The settings form is generated from the template. */
export function CreateServerForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: (id: string) => void }) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const templates = useQuery(templatesListOptions());
  const nodes = useQuery(nodesListOptions());

  const games = useMemo(() => {
    const byGame = new Map<string, { name: string; variants: NonNullable<typeof templates.data> }>();
    for (const tpl of templates.data ?? []) {
      const game = byGame.get(tpl.game.id) ?? { name: tpl.game.name, variants: [] };
      game.variants.push(tpl);
      byGame.set(tpl.game.id, game);
    }
    return [...byGame.entries()];
  }, [templates.data]);

  const [gameId, setGameId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [nodeId, setNodeId] = useState('');
  const [name, setName] = useState('');
  const [settings, setSettings] = useState<Record<string, string>>({});

  const game = games.find(([id]) => id === (gameId || games[0]?.[0]))?.[1];
  const template = game?.variants.find((v) => v.id === templateId) ?? game?.variants[0];
  const node = nodeId || nodes.data?.[0]?.id || '';

  const create = useMutation({
    ...serversCreateMutation(),
    onSuccess: (server) => {
      void queryClient.invalidateQueries({ queryKey: serversListQueryKey() });
      onCreated(server.id);
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!template) return;
    const values = Object.fromEntries(
      template.config.map((f) => {
        const raw = settings[f.key] ?? String(f.default);
        return [f.key, f.type === 'integer' ? Number(raw) : raw];
      }),
    );
    create.mutate({ body: { nodeId: node, name, templateId: template.id, settings: values } });
  };

  const error = create.error as { detail?: string } | null;

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl bg-surface-raised p-4">
      <h3 className="font-medium">{t('create.title')}</h3>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="text-zinc-400">{t('create.name')}</span>
          <input required pattern="[A-Za-z0-9 ._\-]{1,64}" value={name} onChange={(e) => setName(e.target.value)} className={input} placeholder="Survival" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-zinc-400">{t('create.node')}</span>
          <select required value={node} onChange={(e) => setNodeId(e.target.value)} className={input}>
            {nodes.data?.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name} {n.online ? '' : `(${t('create.offline')})`}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-zinc-400">{t('create.game')}</span>
          <select value={gameId || games[0]?.[0] || ''} onChange={(e) => { setGameId(e.target.value); setTemplateId(''); }} className={input}>
            {games.map(([id, g]) => (
              <option key={id} value={id}>{g.name}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-zinc-400">{t('create.variant')}</span>
          <select value={template?.id ?? ''} onChange={(e) => setTemplateId(e.target.value)} className={input}>
            {game?.variants.map((v) => (
              <option key={v.id} value={v.id}>{v.variant.name}</option>
            ))}
          </select>
        </label>
      </div>
      {template?.variant.description && <p className="text-sm text-zinc-400">{localize(template.variant.description, i18n.resolvedLanguage)}</p>}

      {template && (
        <fieldset className="grid gap-4 sm:grid-cols-3">
          <legend className="mb-2 text-sm text-zinc-400">{t('create.settings')}</legend>
          {template.config.map((f) => (
            <label key={f.key} className="space-y-1 text-sm">
              <span className="text-zinc-400">{localize(f.label, i18n.resolvedLanguage)}</span>
              <input
                type={f.type === 'integer' ? 'number' : 'text'}
                min={f.min}
                max={f.max}
                pattern={f.pattern}
                placeholder={String(f.default)}
                value={settings[f.key] ?? ''}
                onChange={(e) => setSettings({ ...settings, [f.key]: e.target.value })}
                className={input}
              />
            </label>
          ))}
        </fieldset>
      )}

      {error && <p role="alert" className="text-sm text-red-300">{error.detail ?? t('create.failed')}</p>}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-lg px-3 py-1.5 text-sm text-zinc-300 hover:bg-white/5">
          {t('create.cancel')}
        </button>
        <button type="submit" disabled={create.isPending || !template || !node} className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-zinc-900 disabled:opacity-50">
          {t('create.submit')}
        </button>
      </div>
    </form>
  );
}
