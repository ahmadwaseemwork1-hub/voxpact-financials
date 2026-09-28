import type { ReactNode } from 'react';
import { formatCurrency } from '../../lib/format';

/**
 * One palette for every chart in the app so series colours stay consistent
 * across pages. Gold leads, navy supports, semantic colours carry meaning.
 */
export const CHART_COLORS = {
  gold: '#c9a962',
  goldSoft: '#dfc685',
  navy: '#4c6fa5',
  navyDeep: '#2c4a7c',
  positive: '#2f9e71',
  warning: '#d9a441',
  danger: '#d05353',
  grid: 'rgba(148,163,184,0.16)',
  axis: 'rgb(112,132,160)',
};

export const CATEGORICAL = [
  '#c9a962',
  '#4c6fa5',
  '#2f9e71',
  '#d9a441',
  '#7d9ac4',
  '#b08f45',
  '#d05353',
  '#8e7038',
  '#adc0dc',
  '#586f8d',
];

export const AXIS_PROPS = {
  stroke: CHART_COLORS.axis,
  tick: { fill: CHART_COLORS.axis, fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const;

export function ChartTooltip({
  active,
  payload,
  label,
  currency = true,
  suffix,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string; dataKey?: string }[];
  label?: ReactNode;
  currency?: boolean;
  suffix?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-xl px-3 py-2.5 text-xs shadow-lift">
      {label !== undefined && <p className="mb-1.5 font-semibold text-ink">{label}</p>}
      <div className="space-y-1">
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-ink-muted">
              <span className="h-2 w-2 rounded-full" style={{ background: entry.color }} />
              {entry.name ?? entry.dataKey}
            </span>
            <span className="font-semibold tabular-nums text-ink">
              {currency ? formatCurrency(entry.value ?? 0) : `${entry.value}${suffix ?? ''}`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChartEmpty({ message = 'No data for this period yet' }: { message?: string }) {
  return (
    <div className="flex h-full min-h-[180px] items-center justify-center text-xs text-ink-subtle">{message}</div>
  );
}
