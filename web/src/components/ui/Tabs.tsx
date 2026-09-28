import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

export interface TabItem {
  key: string;
  label: string;
  count?: number;
}

export function Tabs({
  items,
  value,
  onChange,
  className,
}: {
  items: TabItem[];
  value: string;
  onChange: (key: string) => void;
  className?: string;
}) {
  return (
    <div className={cn('no-scrollbar flex gap-1 overflow-x-auto rounded-xl border border-line bg-surface-elevated/50 p-1', className)} role="tablist">
      {items.map((item) => {
        const active = item.key === value;
        return (
          <button
            key={item.key}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.key)}
            className={cn(
              'relative shrink-0 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors duration-200',
              active ? 'text-navy-950' : 'text-ink-muted hover:text-ink',
            )}
          >
            {active && (
              <motion.span
                layoutId="tab-pill"
                className="absolute inset-0 rounded-lg bg-gold-gradient"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative flex items-center gap-1.5">
              {item.label}
              {item.count !== undefined && (
                <span className={cn('rounded-full px-1.5 text-[0.65rem]', active ? 'bg-navy-950/15' : 'bg-white/8')}>
                  {item.count}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
