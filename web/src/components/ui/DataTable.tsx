import { useMemo, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, ArrowUpDown, Inbox } from 'lucide-react';
import { cn } from '../../lib/utils';
import { TableSkeleton } from './Skeleton';
import { Button } from './Button';

export interface Column<T> {
  key: string;
  header: ReactNode;
  /** Value used for client-side sorting. Omit to disable sorting on this column. */
  sortValue?: (row: T) => string | number;
  render: (row: T, index: number) => ReactNode;
  className?: string;
  headerClassName?: string;
  align?: 'left' | 'right' | 'center';
  width?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  emptyTitle?: string;
  emptyMessage?: string;
  emptyAction?: ReactNode;
  /** Adds a highlight class to a row, e.g. budget breaches. */
  rowClassName?: (row: T) => string | undefined;
  /** Client-side pagination; server-paginated tables pass `pagination` instead. */
  pageSize?: number;
  pagination?: {
    page: number;
    totalPages: number;
    total: number;
    onPageChange: (page: number) => void;
  };
  footer?: ReactNode;
  dense?: boolean;
}

const ALIGN = { left: 'text-left', right: 'text-right', center: 'text-center' } as const;

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  emptyTitle = 'Nothing here yet',
  emptyMessage = 'Records you add will appear in this table.',
  emptyAction,
  rowClassName,
  pageSize = 0,
  pagination,
  footer,
  dense,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);
  const [localPage, setLocalPage] = useState(1);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find((c) => c.key === sort.key);
    if (!column?.sortValue) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = column.sortValue!(a);
      const bv = column.sortValue!(b);
      if (av === bv) return 0;
      const result = av > bv ? 1 : -1;
      return sort.dir === 'asc' ? result : -result;
    });
    return copy;
  }, [rows, sort, columns]);

  const usesLocalPaging = pageSize > 0 && !pagination;
  const totalLocalPages = usesLocalPaging ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
  const page = Math.min(localPage, totalLocalPages);
  const visible = usesLocalPaging ? sorted.slice((page - 1) * pageSize, page * pageSize) : sorted;

  if (loading) {
    return (
      <div className="overflow-hidden rounded-2xl border border-line bg-surface-elevated/40">
        <TableSkeleton cols={Math.min(columns.length, 6)} />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface-elevated/40">
      <div className="max-h-[68vh] overflow-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-surface-elevated/95 backdrop-blur-md">
            <tr className="border-b border-line">
              {columns.map((col) => {
                const sortable = Boolean(col.sortValue);
                const active = sort?.key === col.key;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    style={col.width ? { width: col.width } : undefined}
                    className={cn(
                      'px-4 py-3 text-[0.7rem] font-semibold uppercase tracking-wider text-ink-subtle',
                      ALIGN[col.align ?? 'left'],
                      col.headerClassName,
                    )}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() =>
                          setSort((s) =>
                            s?.key === col.key ? { key: col.key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: col.key, dir: 'asc' },
                          )
                        }
                        className={cn(
                          'inline-flex items-center gap-1 transition-colors hover:text-ink',
                          active && 'text-accent',
                          col.align === 'right' && 'flex-row-reverse',
                        )}
                      >
                        {col.header}
                        <ArrowUpDown className="h-3 w-3 opacity-60" />
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-16">
                  <div className="flex flex-col items-center text-center">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.05] text-ink-subtle">
                      <Inbox className="h-5 w-5" strokeWidth={1.6} />
                    </span>
                    <p className="mt-3 text-sm font-medium text-ink">{emptyTitle}</p>
                    <p className="mt-1 max-w-sm text-xs text-ink-muted">{emptyMessage}</p>
                    {emptyAction && <div className="mt-4">{emptyAction}</div>}
                  </div>
                </td>
              </tr>
            ) : (
              visible.map((row, index) => (
                <motion.tr
                  key={rowKey(row)}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2, delay: Math.min(index * 0.015, 0.2) }}
                  className={cn(
                    'table-row-hover border-b border-line/60 last:border-0 hover:bg-white/[0.035]',
                    index % 2 === 1 && 'bg-white/[0.012]',
                    rowClassName?.(row),
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        dense ? 'px-4 py-2' : 'px-4 py-3',
                        'align-middle text-ink',
                        ALIGN[col.align ?? 'left'],
                        col.className,
                      )}
                    >
                      {col.render(row, index)}
                    </td>
                  ))}
                </motion.tr>
              ))
            )}
          </tbody>
          {footer && <tfoot className="sticky bottom-0 bg-surface-elevated/95 backdrop-blur-md">{footer}</tfoot>}
        </table>
      </div>

      {(pagination || (usesLocalPaging && totalLocalPages > 1)) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
          <p className="text-xs text-ink-muted">
            {pagination
              ? `Page ${pagination.page} of ${pagination.totalPages} · ${pagination.total} record${pagination.total === 1 ? '' : 's'}`
              : `Page ${page} of ${totalLocalPages} · ${sorted.length} record${sorted.length === 1 ? '' : 's'}`}
          </p>
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant="secondary"
              disabled={(pagination?.page ?? page) <= 1}
              onClick={() => (pagination ? pagination.onPageChange(pagination.page - 1) : setLocalPage((p) => p - 1))}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Prev
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={(pagination?.page ?? page) >= (pagination?.totalPages ?? totalLocalPages)}
              onClick={() => (pagination ? pagination.onPageChange(pagination.page + 1) : setLocalPage((p) => p + 1))}
              aria-label="Next page"
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
