import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { serversMetricsOptions } from '../../api/@tanstack/react-query.gen';
import type { MetricPointDto } from '../../api/types.gen';

type Range = '1h' | '24h' | '7d';
/** Bucket size per range, as the servers service groups them (ADR 0009). */
const STEP_MS: Record<Range, number> = { '1h': 60_000, '24h': 600_000, '7d': 3_600_000 };
const SPAN_MS: Record<Range, number> = { '1h': 3_600_000, '24h': 86_400_000, '7d': 604_800_000 };
const W = 300;
const H = 60;

/** CPU, memory and player graphs of one server. New values arrive once a minute. */
export function History({ serverId }: { serverId: string }) {
  const { t, i18n } = useTranslation();
  const [range, setRange] = useState<Range>('1h');
  const metrics = useQuery({ ...serversMetricsOptions({ path: { id: serverId }, query: { range } }), refetchInterval: 60_000 });
  const points = metrics.data ?? [];
  const to = Date.now();
  const from = to - SPAN_MS[range];
  const time = (ms: number) =>
    new Date(ms).toLocaleString(i18n.resolvedLanguage, range === '7d' ? { weekday: 'short', hour: '2-digit' } : { hour: '2-digit', minute: '2-digit' });

  const charts: { key: string; title: string; value: (p: MetricPointDto) => number | null; format: (v: number) => string; floor: number }[] = [
    { key: 'cpu', title: t('detail.cpu'), value: (p) => p.cpuPercent, format: (v) => `${v.toFixed(0)} %`, floor: 100 },
    { key: 'memory', title: t('detail.memory'), value: (p) => p.memoryBytes, format: (v) => `${Math.round(v / 1024 / 1024)} MB`, floor: 0 },
  ];
  if (points.some((p) => p.players !== null)) {
    charts.push({ key: 'players', title: t('detail.players'), value: (p) => p.players, format: (v) => String(v), floor: 4 });
  }

  return (
    <section className="space-y-3 rounded-xl bg-surface-raised p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-medium">{t('detail.history')}</h3>
        <div role="group" className="flex gap-1 text-xs">
          {(['1h', '24h', '7d'] as const).map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={range === r}
              onClick={() => setRange(r)}
              className={`rounded-md px-2 py-1 ${range === r ? 'bg-accent text-zinc-900' : 'bg-white/5 hover:bg-white/10'}`}
            >
              {t(`detail.range.${r}`)}
            </button>
          ))}
        </div>
      </div>
      {points.length === 0 ? (
        <p className="text-sm text-zinc-400">{t('detail.historyEmpty')}</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {charts.map((c) => (
            <Chart key={c.key} title={c.title} points={points} value={c.value} format={c.format} floor={c.floor} from={from} to={to} step={STEP_MS[range]} />
          ))}
        </div>
      )}
      {points.length > 0 && (
        <div className="flex justify-between text-xs text-zinc-500">
          <span>{time(from)}</span>
          <span>{t('detail.now')}</span>
        </div>
      )}
    </section>
  );
}

interface ChartProps {
  title: string;
  points: MetricPointDto[];
  value: (p: MetricPointDto) => number | null;
  format: (v: number) => string;
  /** Lowest top of the scale, e.g. 100 % for CPU, so small values look small. */
  floor: number;
  from: number;
  to: number;
  step: number;
}

/** Line chart as plain SVG. Gaps (server off) stay gaps instead of being bridged by a line. */
function Chart({ title, points, value, format, floor, from, to, step }: ChartProps) {
  const values = points.map((p) => ({ t: Date.parse(p.at), v: value(p) })).filter((p): p is { t: number; v: number } => p.v !== null);
  const peak = Math.max(0, ...values.map((p) => p.v));
  const top = Math.max(floor, peak * 1.15) || 1;
  const x = (t: number) => ((t - from) / (to - from)) * W;
  const y = (v: number) => H - (v / top) * H;

  const segments: { t: number; v: number }[][] = [];
  for (const p of values) {
    const last = segments.at(-1)?.at(-1);
    if (!last || p.t - last.t > step * 2) segments.push([p]);
    else segments.at(-1)!.push(p);
  }

  return (
    <figure className="space-y-1">
      <figcaption className="flex justify-between text-sm">
        <span className="text-zinc-400">{title}</span>
        <span>max {format(peak)}</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-20 w-full rounded-md bg-surface" role="img" aria-label={`${title}: max ${format(peak)}`}>
        {segments.map((s, i) =>
          s.length === 1 ? (
            <circle key={i} cx={x(s[0].t)} cy={y(s[0].v)} r={1.5} className="fill-accent" />
          ) : (
            <g key={i}>
              <polygon
                points={`${x(s[0].t)},${H} ${s.map((p) => `${x(p.t)},${y(p.v)}`).join(' ')} ${x(s.at(-1)!.t)},${H}`}
                className="fill-accent/15"
              />
              <polyline points={s.map((p) => `${x(p.t)},${y(p.v)}`).join(' ')} fill="none" vectorEffect="non-scaling-stroke" strokeWidth={1.5} className="stroke-accent" />
            </g>
          ),
        )}
      </svg>
    </figure>
  );
}
