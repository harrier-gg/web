import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { shareSummaryOptions } from '../../api/@tanstack/react-query.gen';

/**
 * The client mods of a server as one pack for the players' launcher (ADR 0018). Shown to every
 * member: friends are who it is for.
 */
export function SharePack({ serverId }: { serverId: string }) {
  const { t } = useTranslation();
  const share = useQuery(shareSummaryOptions({ path: { id: serverId } }));
  if (!share.data || share.data.mods.length === 0) return null;
  const { mods, missing, fileName } = share.data;

  return (
    <div className="space-y-3 rounded-xl bg-surface-raised p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium">{t('share.title')}</p>
          <p className="text-zinc-400">{t('share.count', { count: mods.length })}</p>
        </div>
        <a href={`/api/v1/servers/${serverId}/share/download`} download={fileName} className="rounded-lg bg-accent px-3 py-1.5 font-medium text-zinc-900">
          {t('share.download')}
        </a>
      </div>
      <p className="text-zinc-400">{t('share.howTo')}</p>
      <details>
        <summary className="cursor-pointer text-zinc-400">{t('share.list')}</summary>
        <ul className="mt-2 flex flex-wrap gap-2">
          {mods.map((m) => (
            <li key={m.name} className="rounded-md bg-white/5 px-2 py-0.5">
              {m.name} <span className="text-zinc-500">{m.version}</span>
            </li>
          ))}
        </ul>
      </details>
      {missing.length > 0 && <p className="text-xs text-amber-200">{t('share.missing', { names: missing.join(', ') })}</p>}
    </div>
  );
}
