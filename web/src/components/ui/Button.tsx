import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'subtle';
type Size = 'sm' | 'md' | 'lg' | 'icon';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-gold-gradient text-navy-950 font-semibold shadow-[0_4px_16px_rgba(201,169,98,0.28)] hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(201,169,98,0.4)] active:translate-y-0',
  secondary:
    'bg-surface-muted text-ink border border-line hover:border-accent/50 hover:bg-surface-muted/70 hover:-translate-y-0.5',
  outline: 'border border-accent/45 text-accent hover:bg-accent/10 hover:border-accent',
  ghost: 'text-ink-muted hover:text-ink hover:bg-white/[0.06]',
  subtle: 'bg-white/[0.05] text-ink-muted hover:text-ink hover:bg-white/[0.09]',
  danger: 'bg-danger/90 text-white hover:bg-danger hover:-translate-y-0.5 shadow-[0_4px_16px_rgba(208,83,83,0.28)]',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-6 text-[0.95rem] gap-2.5 rounded-xl',
  icon: 'h-9 w-9 rounded-lg',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', loading, fullWidth, disabled, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex select-none items-center justify-center whitespace-nowrap transition-all duration-200 ease-premium',
        'disabled:pointer-events-none disabled:opacity-45',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});
