import type { ReactNode } from 'react';

export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon?: ReactNode;
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon && (
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 text-accent">{icon}</span>
      )}
      <h3 className="mt-4 text-sm font-semibold text-ink">{title}</h3>
      {message && <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-ink-muted">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
