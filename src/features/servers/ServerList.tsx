import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { serversListOptions, templatesListOptions } from '../../api/@tanstack/react-query.gen';
import { CreateServerForm } from './CreateServerForm';
import { StatusBadge } from './StatusBadge';

export function ServerList({ onOpen }: { onOpen: (id: string) => void }) {
  const { t } = useTranslation();
  // ponytail: polling every 3 s; a panel-wide event stream replaces it later
  const servers = useQuery({ ...serversListOptions(), refetchInterval: 3000 });
  const templates = useQuery(templatesListOptions());
  const [creating, setCreating] = useState(false);

  const variantName = (templateId: string) => {
    const tpl = templates.data?.find((t) => t.id === templateId);
    return tpl ? `${tpl.game.name} · ${tpl.variant.name}` : templateId;
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">{t('servers.title')}</h2>
        {!creating && (
          <button type="button" onClick={() => setCreating(true)} className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-zinc-900">
            {t('servers.new')}
          </button>
        )}
      </div>

      {creating && (
        <CreateServerForm
          onCancel={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            onOpen(id);
          }}
        />
      )}

      {servers.data?.length ? (
        <ul className="divide-y divide-white/5 rounded-xl bg-surface-raised">
          {servers.data.map((s) => (
            <li key={s.id}>
              <button type="button" onClick={() => onOpen(s.id)} className="flex w-full items-center justify-between gap-4 p-4 text-left hover:bg-white/5">
                <span>
                  <span className="block font-medium">{s.name}</span>
                  <span className="text-sm text-zinc-400">
                    {variantName(s.templateId)} · {t('servers.port', { port: s.hostPort })}
                  </span>
                </span>
                <StatusBadge status={s.status} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        !creating && <p className="rounded-xl bg-surface-raised p-4 text-sm text-zinc-400">{t('servers.empty')}</p>
      )}
    </section>
  );
}
