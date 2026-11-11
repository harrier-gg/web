import { useTranslation } from 'react-i18next';
import type { ServerDto } from '../../api/types.gen';

const COLORS: Record<ServerDto['status'], string> = {
  installing: 'bg-sky-400 animate-pulse',
  starting: 'bg-amber-400 animate-pulse',
  running: 'bg-emerald-400',
  stopping: 'bg-amber-400 animate-pulse',
  stopped: 'bg-zinc-500',
  crashed: 'bg-red-400',
  sleeping: 'bg-indigo-400',
};

export function StatusBadge({ status }: { status: ServerDto['status'] }) {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center gap-2 text-sm font-medium">
      <span aria-hidden className={`size-2.5 rounded-full ${COLORS[status]}`} />
      {t(`serverStatus.${status}`)}
    </span>
  );
}
