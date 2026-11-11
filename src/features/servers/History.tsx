import { useQuery } from '@tanstack/react-query';
import { memo, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { serversMetricsOptions } from '../../api/@tanstack/react-query.gen';
import type { MetricPointDto } from '../../api/types.gen';

type Range = '1h' | '24h' | '7d';
/** Bucket size per range, as the servers service groups them (ADR 0009). */
const STEP_S: Record<Range, number> = { '1h': 60, '24h': 600, '7d': 3600 };
const SPAN_S: Record<Range, number> = { '1h': 3600, '24h': 86_400, '7d': 604_800 };

interface ChartDef {
  key: string;
  title: string;
  value: (p: MetricPointDto) => number | null;
  format: (v: number) => string;
  /** Lowest top of the scale, e.g. 100 % for CPU, so small values look small. */
  floor: number;
  /** Axis steps, so the axis shows round values (whole players, 512 MB, …). */
  incrs?: number[];
}

/**
 * CPU, memory and player graphs of one server. New values arrive once a minute. Memoized, so the
 * charts are not rebuilt when the server page re-renders for every live stats update.
 */
export const History = memo(function History({ serverId }: { serverId: string }) {
  const { t } = useTranslation();
  const [range, setRange] = useState<Range>('1h');
  const metrics = useQuery({ ...serversMetricsOptions({ path: { id: serverId }, query: { range } }), refetchInterval: 60_000 });
  const points = metrics.data ?? [];

  const charts: ChartDef[] = [
    { key: 'cpu', title: t('detail.cpu'), value: (p) => p.cpuPercent, format: (v) => `${v.toFixed(0)} %`, floor: 100 },
    { key: 'memory', title: t('detail.memory'), value: (p) => p.memoryBytes, format: (v) => `${Math.round(v / 1024 / 1024)} MB`, floor: 0, incrs: [64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384].map((mb) => mb * 1024 * 1024) },
  ];
  if (points.some((p) => p.players !== null)) {
    charts.push({ key: 'players', title: t('detail.players'), value: (p) => p.players, format: (v) => String(v), floor: 4, incrs: [1, 2, 5, 10, 20, 50, 100] });
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
        <div className="grid gap-4 lg:grid-cols-3">
          {charts.map((c) => (
            <Chart key={c.key} def={c} points={points} range={range} />
          ))}
        </div>
      )}
    </section>
  );
});

/** One uPlot chart. Times the server was off stay gaps; hovering shows the values below. */
function Chart({ def, points, range }: { def: ChartDef; points: MetricPointDto[]; range: Range }) {
  const { t, i18n } = useTranslation();
  const host = useRef<HTMLDivElement>(null);
  const values = points.map(def.value).filter((v): v is number => v !== null);
  const peak = Math.max(0, ...values);

  useEffect(() => {
    const el = host.current!;
    const step = STEP_S[range];
    // uPlot draws `null` as a gap, so a missing bucket between two points becomes one null.
    const xs: number[] = [];
    const ys: (number | null)[] = [];
    for (const p of points) {
      const x = Date.parse(p.at) / 1000;
      if (xs.length && x - xs.at(-1)! > step * 2) {
        xs.push(xs.at(-1)! + step);
        ys.push(null);
      }
      xs.push(x);
      ys.push(def.value(p));
    }

    const lang = i18n.resolvedLanguage;
    const time = (s: number, options: Intl.DateTimeFormatOptions) => new Date(s * 1000).toLocaleString(lang, options);
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim();
    const axis = { stroke: '#a1a1aa', grid: { stroke: 'rgba(255,255,255,0.06)' }, ticks: { show: false } };
    const now = Date.now() / 1000;

    const plot = new uPlot(
      {
        width: el.clientWidth,
        height: 140,
        scales: {
          x: { time: true, range: () => [now - SPAN_S[range], now] },
          y: { range: (_u, _min, max) => [0, Math.max(def.floor, max * 1.15) || 1] },
        },
        series: [
          {
            label: t('detail.time'),
            value: (_u, v) => (v == null ? '–' : time(v, { weekday: 'short', hour: '2-digit', minute: '2-digit' })),
          },
          {
            label: def.title,
            stroke: accent,
            fill: accent.replace(')', ' / 0.15)'),
            width: 1.5,
            points: { show: false },
            value: (_u, v) => (v == null ? '–' : def.format(v)),
          },
        ],
        axes: [
          {
            ...axis,
            values: (_u, splits) => splits.map((s) => time(s, range === '7d' ? { weekday: 'short' } : { hour: '2-digit', minute: '2-digit' })),
          },
          { ...axis, size: 64, incrs: def.incrs, values: (_u, splits) => splits.map(def.format) },
        ],
      },
      [xs, ys],
      el,
    );
    const resize = new ResizeObserver(() => plot.setSize({ width: el.clientWidth, height: 140 }));
    resize.observe(el);
    return () => {
      resize.disconnect();
      plot.destroy();
    };
  }, [points, range, def, t, i18n.resolvedLanguage]);

  return (
    <figure className="min-w-0 space-y-1">
      <figcaption className="flex justify-between text-sm">
        <span className="text-zinc-400">{def.title}</span>
        <span>max {def.format(peak)}</span>
      </figcaption>
      <div ref={host} className="text-zinc-300 [&_.u-legend]:text-xs" />
    </figure>
  );
}
