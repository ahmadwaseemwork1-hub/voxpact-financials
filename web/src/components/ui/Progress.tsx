import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

export function ProgressBar({
  value,
  tone = 'auto',
  height = 8,
  showLabel,
  className,
}: {
  value: number;
  tone?: 'auto' | 'gold' | 'positive' | 'warning' | 'danger';
  height?: number;
  showLabel?: boolean;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const resolved =
    tone === 'auto' ? (value > 90 ? 'danger' : value >= 70 ? 'warning' : 'positive') : tone;

  const fill: Record<string, string> = {
    gold: 'bg-gold-gradient',
    positive: 'bg-gradient-to-r from-positive/70 to-positive',
    warning: 'bg-gradient-to-r from-warning/70 to-warning',
    danger: 'bg-gradient-to-r from-danger/70 to-danger',
  };

  return (
    <div className={cn('w-full', className)}>
      <div
        className="w-full overflow-hidden rounded-full bg-white/[0.07]"
        style={{ height }}
        role="progressbar"
        aria-valuenow={Math.round(clamped)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <motion.div
          className={cn('h-full rounded-full', fill[resolved])}
          initial={{ width: 0 }}
          animate={{ width: `${clamped}%` }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
      {showLabel && <p className="mt-1.5 text-right text-xs text-ink-muted">{clamped.toFixed(0)}%</p>}
    </div>
  );
}

export function Gauge({
  value,
  size = 150,
  label,
  sublabel,
}: {
  value: number;
  size?: number;
  label?: string;
  sublabel?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const stroke = 11;
  const radius = (size - stroke) / 2;
  const circumference = Math.PI * radius; // half circle
  const offset = circumference - (clamped / 100) * circumference;
  const color = clamped > 90 ? '#d05353' : clamped >= 70 ? '#d9a441' : '#2f9e71';

  return (
    <div className="flex flex-col items-center" style={{ width: size }}>
      <svg width={size} height={size / 2 + 12} viewBox={`0 0 ${size} ${size / 2 + 12}`} role="img" aria-label={`${clamped.toFixed(0)}% used`}>
        <path
          d={`M ${stroke / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - stroke / 2} ${size / 2}`}
          fill="none"
          stroke="rgb(var(--line))"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        <motion.path
          d={`M ${stroke / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - stroke / 2} ${size / 2}`}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="-mt-6 text-center">
        <p className="text-2xl font-bold tracking-tight text-ink">{clamped.toFixed(0)}%</p>
        {label && <p className="mt-0.5 text-xs font-medium text-ink-muted">{label}</p>}
        {sublabel && <p className="text-[0.7rem] text-ink-subtle">{sublabel}</p>}
      </div>
    </div>
  );
}
