import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { CalendarRange, ChevronDown, Download } from 'lucide-react';
import { api, apiError, downloadFile } from '../../lib/api';
import { formatCurrency, formatDate } from '../../lib/format';
import { cn } from '../../lib/utils';
import { useToast } from '../../store/ToastProvider';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Card, CardBody } from '../../components/ui/Card';
import { Field, Input } from '../../components/ui/Input';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import type { Expense } from '../../types';

interface WeekBucket {
  week: string;
  weekStart: string;
  weekEnd: string;
  total: number;
  count: number;
  byCategory: Record<string, number>;
  items: Expense[];
}

function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 56);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export default function WeeklyExpenses() {
  useDocumentTitle('Weekly expenses');
  const toast = useToast();
  const [range, setRange] = useState(defaultRange);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['expenses', 'weekly', range],
    queryFn: async () =>
      (await api.get<{ weeks: WeekBucket[]; total: number }>('/expenses/weekly', { params: range })).data,
  });

  const average = useMemo(
    () => (data?.weeks.length ? data.total / data.weeks.length : 0),
    [data],
  );

  return (
    <div>
      <PageHeader
        title="Weekly expenses"
        subtitle="Daily and recurring spending rolled up into ISO weeks."
        actions={
          <Button
            variant="secondary"
            onClick={() =>
              downloadFile('/expenses/export', { from: range.from, to: range.to }).catch((e) =>
                toast.error('Export failed', apiError(e)),
              )
            }
          >
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        }
      />

      <Card className="mb-4">
        <CardBody className="grid gap-4 sm:grid-cols-4">
          <Field label="From">
            <Input type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
          </Field>
          <Field label="To">
            <Input type="date" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
          </Field>
          <div className="rounded-xl border border-line bg-surface-elevated/50 px-4 py-3">
            <p className="text-[0.68rem] uppercase tracking-wider text-ink-subtle">Period total</p>
            <p className="mt-0.5 text-lg font-bold tabular-nums text-ink">{formatCurrency(data?.total ?? 0)}</p>
          </div>
          <div className="rounded-xl border border-accent/25 bg-accent/[0.07] px-4 py-3">
            <p className="text-[0.68rem] uppercase tracking-wider text-ink-subtle">Weekly average</p>
            <p className="mt-0.5 text-lg font-bold tabular-nums text-accent">{formatCurrency(average)}</p>
          </div>
        </CardBody>
      </Card>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : !data?.weeks.length ? (
        <Card>
          <EmptyState
            icon={<CalendarRange className="h-6 w-6" strokeWidth={1.6} />}
            title="No expenses in this range"
            message="Pick a wider date range, or start recording daily expenses."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {data.weeks.map((week, index) => {
            const isOpen = expanded === week.week;
            const share = data.total > 0 ? (week.total / data.total) * 100 : 0;
            const topCategories = Object.entries(week.byCategory)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 4);

            return (
              <motion.div
                key={week.week}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.3) }}
              >
                <Card hoverable>
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : week.week)}
                    aria-expanded={isOpen}
                    className="flex w-full flex-wrap items-center gap-4 p-5 text-left"
                  >
                    <div className="min-w-[180px] flex-1">
                      <p className="text-sm font-semibold text-ink">{week.week}</p>
                      <p className="mt-0.5 text-xs text-ink-muted">
                        {formatDate(week.weekStart, 'dd MMM')} – {formatDate(week.weekEnd, 'dd MMM yyyy')} ·{' '}
                        {week.count} entr{week.count === 1 ? 'y' : 'ies'}
                      </p>
                    </div>

                    <div className="hidden flex-wrap gap-1.5 md:flex">
                      {topCategories.map(([category, amount]) => (
                        <Badge key={category} tone="neutral">
                          {category} · {formatCurrency(amount, { compact: true })}
                        </Badge>
                      ))}
                    </div>

                    <div className="text-right">
                      <p className="text-lg font-bold tabular-nums text-ink">{formatCurrency(week.total)}</p>
                      <p className="text-[0.68rem] text-ink-subtle">{share.toFixed(1)}% of period</p>
                    </div>

                    <ChevronDown className={cn('h-4 w-4 text-ink-subtle transition-transform', isOpen && 'rotate-180')} />
                  </button>

                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      className="overflow-hidden border-t border-line"
                    >
                      <div className="max-h-[320px] overflow-y-auto">
                        {week.items.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center gap-3 border-b border-line/50 px-5 py-2.5 last:border-0"
                          >
                            <span className="w-20 shrink-0 text-[0.7rem] text-ink-subtle">{formatDate(item.date, 'dd MMM')}</span>
                            <span className="min-w-0 flex-1 truncate text-[0.82rem] text-ink">{item.name}</span>
                            <Badge tone="gold">{item.category}</Badge>
                            <span className="w-24 shrink-0 text-right text-xs font-semibold tabular-nums text-ink">
                              {formatCurrency(item.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
