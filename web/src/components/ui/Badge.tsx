import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

type Tone = 'neutral' | 'gold' | 'positive' | 'warning' | 'danger' | 'info';

const TONES: Record<Tone, string> = {
  neutral: 'bg-white/[0.07] text-ink-muted border-line',
  gold: 'bg-accent/14 text-accent border-accent/30',
  positive: 'bg-positive/14 text-positive border-positive/30',
  warning: 'bg-warning/14 text-warning border-warning/30',
  danger: 'bg-danger/14 text-danger border-danger/30',
  info: 'bg-navy-400/15 text-navy-300 border-navy-400/30',
};

export function Badge({
  children,
  tone = 'neutral',
  className,
  dot,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[0.7rem] font-medium tracking-wide',
        TONES[tone],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
