import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { api, apiError, downloadFile } from '../../lib/api';
import { formatCurrency } from '../../lib/format';
import { useToast } from '../../store/ToastProvider';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { CardBody, CardHeader, MotionCard } from '../../components/ui/Card';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Select } from '../../components/ui/Input';
import { Skeleton } from '../../components/ui/Skeleton';
import { CategoryPieChart, RevenueVsExpensesChart } from '../../components/charts/Charts';

interface MonthBucket {
  month: string;
  label: string;
  daily: number;
  recurring: number;
  total: number;
  count: number;
  paid: number;
  pending: number;
  byCategory: Record<string, number>;
}

export default function MonthlyExpenses() {
  useDocumentTitle('Monthly expenses');
  const toast = useToast();
  const [months, setMonths] = useState(12);
  const [selected, setSelected] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['expenses', 'monthly', months],
    queryFn: async () => (await api.get<{ months: MonthBucket[] }>('/expenses/monthly', { params: { months } })).data,
  });

  const rows = data?.months ?? [];
  const active = selected ? rows.find((r) => r.month === selected) : rows[0];
  const total = rows.reduce((sum, r) => sum + r.total, 0);

  const pieData = active
    ? Object.entries(active.byCategory)
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount)
    : [];

  const barData = [...rows]
    .reverse()
    .map((r) => ({ label: r.label.split(' ')[0], revenue: r.recurring, expenses: r.daily }));

  const columns: Column<MonthBucket>[] = [
    { key: 'label', header: 'Month', render: (row) => <span className="text-sm font-medium text-ink">{row.label}</span> },
    {
      key: 'count',
      header: 'Entries',
      align: 'right',
      sortValue: (r) => r.count,
      render: (row) => <span className="text-xs tabular-nums text-ink-muted">{row.count}</span>,
    },
    {
      key: 'daily',
      header: 'Daily',
      align: 'right',
      sortValue: (r) => r.daily,
      render: (row) => <span className="text-sm tabular-nums text-ink-muted">{formatCurrency(row.daily)}</span>,
    },
    {
      key: 'recurring',
      header: 'Recurring',
      align: 'right',
      sortValue: (r) => r.recurring,
      render: (row) => <span className="text-sm tabular-nums text-ink-muted">{formatCurrency(row.recurring)}</span>,
    },
    {
      key: 'pending',
      header: 'Unpaid',
      align: 'right',
      sortValue: (r) => r.pending,
      render: (row) =>
        row.pending > 0 ? (
          <Badge tone="warning">{formatCurrency(row.pending)}</Badge>
        ) : (
          <span className="text-xs text-ink-subtle">—</span>
        ),
    },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      sortValue: (r) => r.total,
      render: (row) => <span className="text-sm font-bold tabular-nums text-ink">{formatCurrency(row.total)}</span>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: '90px',
      render: (row) => (
        <Button size="sm" variant={selected === row.month ? 'primary' : 'ghost'} onClick={() => setSelected(row.month)}>
          Breakdown
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Monthly expenses"
        subtitle="Recurring bills plus daily spending, aggregated month by month."
        actions={
          <>
            <Select value={String(months)} onChange={(e) => setMonths(Number(e.target.value))} className="w-[150px]">
              <option value="6">Last 6 months</option>
              <option value="12">Last 12 months</option>
              <option value="24">Last 24 months</option>
            </Select>
            <Button
              variant="secondary"
              onClick={() => downloadFile('/expenses/export').catch((e) => toast.error('Export failed', apiError(e)))}
            >
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          </>
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <MotionCard className="p-5">
          <p className="text-[0.68rem] uppercase tracking-wider text-ink-subtle">Total ({months} months)</p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums text-ink">{formatCurrency(total)}</p>
        </MotionCard>
        <MotionCard delay={0.06} className="p-5">
          <p className="text-[0.68rem] uppercase tracking-wider text-ink-subtle">Monthly average</p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums text-ink">
            {formatCurrency(rows.length ? total / rows.length : 0)}
          </p>
        </MotionCard>
        <MotionCard delay={0.12} className="p-5">
          <p className="text-[0.68rem] uppercase tracking-wider text-ink-subtle">Unpaid across period</p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums text-warning">
            {formatCurrency(rows.reduce((s, r) => s + r.pending, 0))}
          </p>
        </MotionCard>
      </div>

      <div className="mb-4 grid gap-4 xl:grid-cols-3">
        <MotionCard className="xl:col-span-2">
          <CardHeader title="Daily vs recurring" subtitle="Split of monthly spend" />
          <CardBody className="pt-2">
            {isLoading ? (
              <Skeleton className="h-[240px]" />
            ) : (
              <RevenueVsExpensesChart
                data={barData}
                seriesNames={{ revenue: 'Recurring', expenses: 'Daily' }}
              />
            )}
          </CardBody>
        </MotionCard>
        <MotionCard delay={0.08}>
          <CardHeader title="Category breakdown" subtitle={active?.label ?? 'Select a month'} />
          <CardBody className="pt-2">
            {isLoading ? <Skeleton className="h-[240px]" /> : <CategoryPieChart data={pieData} />}
          </CardBody>
        </MotionCard>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.month}
        loading={isLoading}
        emptyTitle="No monthly data yet"
        emptyMessage="Once expenses are recorded they roll up here automatically."
      />
    </div>
  );
}
