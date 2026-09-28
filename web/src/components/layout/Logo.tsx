import { cn } from '../../lib/utils';

export function Logo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gold-gradient shadow-[0_4px_14px_rgba(201,169,98,0.32)]">
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
          <path d="M4 5h3.2l4.8 12 4.8-12H20l-6.4 15h-3.2L4 5z" fill="#0a1628" />
        </svg>
      </span>
      {!compact && (
        <div className="min-w-0 leading-tight">
          <p className="truncate font-display text-[0.95rem] font-extrabold tracking-tight text-ink">
            Voxpact <span className="gold-text">Financials</span>
          </p>
          <p className="truncate text-[0.62rem] uppercase tracking-[0.18em] text-ink-subtle">Management Portal</p>
        </div>
      )}
    </div>
  );
}
