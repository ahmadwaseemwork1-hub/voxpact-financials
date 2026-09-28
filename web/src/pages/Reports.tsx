import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, FileBarChart, FileText } from 'lucide-react';
import { api, apiError, downloadFile } from '../lib/api';
import { buildReportPdf } from '../lib/pdf';
import { formatCurrency, formatDate, formatPercent } from '../lib/format';
import { cn } from '../lib/utils';
import { useAuth } from '../store/AuthProvider';
import { useToast } from '../store/ToastProvider';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { PageHeader } from '../components/layout/PageHeader';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { CardBody, CardHeader, MotionCard } from '../components/ui/Card';
import { DataTable, type Column } from '../components/ui/DataTable';
import { Field, Input } from '../components/ui/Input';
import { Tabs } from '../components/ui/Tabs';
import { Skeleton } from '../components/ui/Skeleton';
import { CategoryPieChart, RevenueTrendChart, RevenueVsExpensesChart } from '../components/charts/Charts';

type ReportKey = 'pnl' | 'expense-breakdown' | 'revenue-trends' | 'partner-distribution' | 'employee-cost';

interface ReportSummary {
  range: { from: string; to: string };
  summary: {
    revenue: number;
    expenses: number;
    netProfit: number;
    margin: number;
    recurringExpenses: number;
    dailyExpenses: number;
    transactionCount: number;
  };
  expenseByCategory: { category: string; amount: number; share: number }[];
  revenueByClient: { client: string; amount: number }[];
  monthly: { month: string; label: string; revenue: number; expenses: number; profit: number }[];
  revenueTrend: { month: string; label: string; projected: number; received: number }[];
  partnerDistribution: { id: string; name: string; percentage: number; shareAmount: number; paymentStatus: string }[];
  employeeCost: {
    rows: {
      id: string;
      name: string;
      role: string;
      type: string;
      monthlySalary: number;
      bonus: number;
      totalMonthlyCost: number;
      isActive: boolean;
    }[];
    totalMonthly: number;
    specialPayouts: number;
    specialProjects: {
      id: string;
      employee: string;
      projectName: string;
      totalAmount: number;
      percentage: number;
      payoutAmount: number;
      date: string;
      isPaid: boolean;
    }[];
  };
  company: { name: string; legalName?: string; address?: string; email?: string };
  currency: string;
}

const TABS: { key: ReportKey; label: string }[] = [
  { key: 'pnl', label: 'Profit & loss' },
  { key: 'expense-breakdown', label: 'Expense breakdown' },
  { key: 'revenue-trends', label: 'Revenue trends' },
  { key: 'partner-distribution', label: 'Partner distribution' },
  { key: 'employee-cost', label: 'Employee cost' },
];

function defaultRange() {
  const to = new Date();
  const from = new Date(to.getFullYear(), to.getMonth() - 5, 1);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export default function Reports() {
  useDocumentTitle('Reports');
  const toast = useToast();
  const { user } = useAuth();
  const [range, setRange] = useState(defaultRange);
  const [tab, setTab] = useState<ReportKey>('pnl');

  const { data, isLoading } = useQuery({
    queryKey: ['reports', range],
    queryFn: async () => (await api.get<ReportSummary>('/reports/summary', { params: range })).data,
  });

  const pdfSections = useMemo(() => {
    if (!data) return [];
    switch (tab) {
      case 'expense-breakdown':
        return [
          {
            title: 'Expenses by category',
            head: ['Category', 'Amount', 'Share'],
            numericColumns: [1, 2],
            body: data.expenseByCategory.map((r) => [r.category, formatCurrency(r.amount), formatPercent(r.share)]),
          },
        ];
      case 'revenue-trends':
        return [
          {
            title: 'Monthly revenue and expenses',
            head: ['Month', 'Revenue', 'Expenses', 'Profit'],
            numericColumns: [1, 2, 3],
            body: data.monthly.map((r) => [
              r.label,
              formatCurrency(r.revenue),
              formatCurrency(r.expenses),
              formatCurrency(r.profit),
            ]),
          },
          {
            title: 'Revenue by client',
            head: ['Client', 'Received'],
            numericColumns: [1],
            body: data.revenueByClient.map((r) => [r.client, formatCurrency(r.amount)]),
          },
        ];
      case 'partner-distribution':
        return [
          {
            title: 'Partner profit distribution',
            head: ['Partner', 'Percentage', 'Share', 'Status'],
            numericColumns: [1, 2],
            body: data.partnerDistribution.map((r) => [
              r.name,
              formatPercent(r.percentage, 2),
              formatCurrency(r.shareAmount),
              r.paymentStatus,
            ]),
          },
        ];
      case 'employee-cost':
        return [
          {
            title: 'Employee cost',
            head: ['Employee', 'Role', 'Type', 'Salary', 'Bonus', 'Total', 'Status'],
            numericColumns: [3, 4, 5],
            body: data.employeeCost.rows.map((r) => [
              r.name,
              r.role,
              r.type,
              formatCurrency(r.monthlySalary),
              formatCurrency(r.bonus),
              formatCurrency(r.totalMonthlyCost),
              r.isActive ? 'Active' : 'Inactive',
            ]),
          },
          ...(data.employeeCost.specialProjects.length
            ? [
                {
                  title: 'Percentage-based payouts',
                  head: ['Employee', 'Project', 'Value', '%', 'Payout', 'Date'],
                  numericColumns: [2, 3, 4],
                  body: data.employeeCost.specialProjects.map((p) => [
                    p.employee,
                    p.projectName,
                    formatCurrency(p.totalAmount),
                    formatPercent(p.percentage, 2),
                    formatCurrency(p.payoutAmount),
                    formatDate(p.date),
                  ]),
                },
              ]
            : []),
        ];
      default:
        return [
          {
            title: 'Profit & loss statement',
            head: ['Line item', 'Amount'],
            numericColumns: [1],
            body: [
              ['Revenue received', formatCurrency(data.summary.revenue)],
              ['Daily expenses', formatCurrency(data.summary.dailyExpenses)],
              ['Recurring expenses', formatCurrency(data.summary.recurringExpenses)],
              ['Total expenses', formatCurrency(data.summary.expenses)],
              ['Net profit', formatCurrency(data.summary.netProfit)],
              ['Margin', formatPercent(data.summary.margin)],
            ],
          },
          {
            title: 'Month by month',
            head: ['Month', 'Revenue', 'Expenses', 'Profit'],
            numericColumns: [1, 2, 3],
            body: data.monthly.map((r) => [
              r.label,
              formatCurrency(r.revenue),
              formatCurrency(r.expenses),
              formatCurrency(r.profit),
            ]),
          },
        ];
    }
  }, [data, tab]);

  const exportPdf = () => {
    if (!data) return;
    buildReportPdf({
      title: TABS.find((t) => t.key === tab)!.label,
      company: data.company,
      range: { from: range.from, to: range.to },
      generatedBy: user?.fullName || user?.username,
      summary: [
        { label: 'Revenue', value: formatCurrency(data.summary.revenue) },
        { label: 'Expenses', value: formatCurrency(data.summary.expenses) },
        { label: 'Net profit', value: formatCurrency(data.summary.netProfit) },
        { label: 'Margin', value: formatPercent(data.summary.margin) },
      ],
      sections: pdfSections,
      filename: `voxpact-${tab}-${range.from}_${range.to}.pdf`,
    });
    toast.success('PDF generated');
  };

  const categoryColumns: Column<ReportSummary['expenseByCategory'][number]>[] = [
    { key: 'category', header: 'Category', sortValue: (r) => r.category, render: (r) => <Badge tone="gold">{r.category}</Badge> },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      sortValue: (r) => r.amount,
      render: (r) => <span className="text-sm font-semibold tabular-nums text-ink">{formatCurrency(r.amount)}</span>,
    },
    {
      key: 'share',
      header: 'Share',
      align: 'right',
      width: '110px',
      sortValue: (r) => r.share,
      render: (r) => <span className="text-xs tabular-nums text-ink-muted">{formatPercent(r.share)}</span>,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Reports & analytics"
        subtitle="Build a statement for any period, then export it as PDF or CSV."
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() =>
                downloadFile('/reports/export', { ...range, type: tab }).catch((e) =>
                  toast.error('Export failed', apiError(e)),
                )
              }
            >
              <Download className="h-4 w-4" /> CSV
            </Button>
            <Button onClick={exportPdf} disabled={!data}>
              <FileText className="h-4 w-4" /> PDF
            </Button>
          </>
        }
      />

      <MotionCard className="mb-4">
        <CardBody className="grid gap-4 sm:grid-cols-4">
          <Field label="From">
            <Input type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
          </Field>
          <Field label="To">
            <Input type="date" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
          </Field>
          <div className="sm:col-span-2 flex items-end">
            <div className="flex w-full flex-wrap gap-2">
              {[
                { label: 'This month', months: 0 },
                { label: 'Last 3 months', months: 2 },
                { label: 'Last 6 months', months: 5 },
                { label: 'Last 12 months', months: 11 },
              ].map((preset) => (
                <Button
                  key={preset.label}
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    const to = new Date();
                    const from = new Date(to.getFullYear(), to.getMonth() - preset.months, 1);
                    setRange({ from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) });
                  }}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>
        </CardBody>
      </MotionCard>

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Revenue received', value: data?.summary.revenue ?? 0, tone: 'text-positive' },
          { label: 'Total expenses', value: data?.summary.expenses ?? 0, tone: 'text-ink' },
          { label: 'Net profit', value: data?.summary.netProfit ?? 0, tone: (data?.summary.netProfit ?? 0) >= 0 ? 'text-positive' : 'text-danger' },
          { label: 'Margin', value: data?.summary.margin ?? 0, tone: 'text-accent', percent: true },
        ].map((card, i) => (
          <MotionCard key={card.label} delay={i * 0.06} className="p-5">
            <p className="text-[0.68rem] uppercase tracking-wider text-ink-subtle">{card.label}</p>
            {isLoading ? (
              <Skeleton className="mt-2 h-8" />
            ) : (
              <p className={cn('mt-1.5 text-2xl font-bold tabular-nums', card.tone)}>
                {card.percent ? formatPercent(card.value) : formatCurrency(card.value)}
              </p>
            )}
          </MotionCard>
        ))}
      </div>

      <Tabs items={TABS} value={tab} onChange={(key) => setTab(key as ReportKey)} className="mb-4" />

      {isLoading || !data ? (
        <Skeleton className="h-[420px] rounded-2xl" />
      ) : tab === 'pnl' ? (
        <div className="grid gap-4 xl:grid-cols-3">
          <MotionCard className="xl:col-span-2">
            <CardHeader title="Revenue vs expenses" subtitle="Month by month" icon={<FileBarChart className="h-4 w-4" strokeWidth={1.8} />} />
            <CardBody className="pt-2">
              <RevenueVsExpensesChart data={data.monthly} height={280} />
            </CardBody>
          </MotionCard>
          <MotionCard delay={0.08}>
            <CardHeader title="Statement" subtitle={`${formatDate(range.from)} — ${formatDate(range.to)}`} />
            <CardBody className="space-y-2.5">
              {[
                { label: 'Revenue received', value: data.summary.revenue, bold: false },
                { label: 'Daily expenses', value: -data.summary.dailyExpenses, bold: false },
                { label: 'Recurring expenses', value: -data.summary.recurringExpenses, bold: false },
                { label: 'Total expenses', value: -data.summary.expenses, bold: true },
              ].map((line) => (
                <div key={line.label} className="flex items-center justify-between border-b border-line/60 pb-2">
                  <span className={cn('text-xs', line.bold ? 'font-semibold text-ink' : 'text-ink-muted')}>{line.label}</span>
                  <span className={cn('text-sm tabular-nums', line.bold ? 'font-bold text-ink' : 'text-ink-muted')}>
                    {formatCurrency(Math.abs(line.value))}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between rounded-xl bg-accent/[0.08] px-3.5 py-3">
                <span className="text-sm font-semibold text-ink">Net profit</span>
                <span
                  className={cn(
                    'text-lg font-bold tabular-nums',
                    data.summary.netProfit >= 0 ? 'text-positive' : 'text-danger',
                  )}
                >
                  {formatCurrency(data.summary.netProfit)}
                </span>
              </div>
              <p className="pt-1 text-center text-[0.7rem] text-ink-subtle">
                {data.summary.transactionCount} transactions · {formatPercent(data.summary.margin)} margin
              </p>
            </CardBody>
          </MotionCard>
        </div>
      ) : tab === 'expense-breakdown' ? (
        <div className="grid gap-4 xl:grid-cols-3">
          <MotionCard>
            <CardHeader title="By category" subtitle="Share of total spend" />
            <CardBody className="pt-2">
              <CategoryPieChart data={data.expenseByCategory} height={300} />
            </CardBody>
          </MotionCard>
          <div className="xl:col-span-2">
            <DataTable
              columns={categoryColumns}
              rows={data.expenseByCategory}
              rowKey={(row) => row.category}
              emptyTitle="No expenses in this period"
            />
          </div>
        </div>
      ) : tab === 'revenue-trends' ? (
        <div className="grid gap-4 xl:grid-cols-3">
          <MotionCard className="xl:col-span-2">
            <CardHeader title="Projected vs received" subtitle="Across the selected period" />
            <CardBody className="pt-2">
              <RevenueTrendChart data={data.revenueTrend} height={300} />
            </CardBody>
          </MotionCard>
          <MotionCard delay={0.08}>
            <CardHeader title="Top clients" subtitle="By revenue received" />
            <div className="max-h-[320px] overflow-y-auto">
              {data.revenueByClient.length === 0 ? (
                <p className="px-5 py-8 text-center text-xs text-ink-muted">No revenue received in this period.</p>
              ) : (
                data.revenueByClient.map((client, i) => (
                  <div key={client.client} className="flex items-center gap-3 border-b border-line/60 px-5 py-3 last:border-0">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-accent/12 text-[0.65rem] font-bold text-accent">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">{client.client}</span>
                    <span className="text-sm font-semibold tabular-nums text-ink">{formatCurrency(client.amount)}</span>
                  </div>
                ))
              )}
            </div>
          </MotionCard>
        </div>
      ) : tab === 'partner-distribution' ? (
        <DataTable
          columns={[
            { key: 'name', header: 'Partner', render: (r: any) => <span className="text-sm font-medium text-ink">{r.name}</span> },
            {
              key: 'percentage',
              header: 'Percentage',
              align: 'right',
              render: (r: any) => <Badge tone="gold">{formatPercent(r.percentage, 2)}</Badge>,
            },
            {
              key: 'shareAmount',
              header: 'Share of profit',
              align: 'right',
              render: (r: any) => (
                <span className="text-sm font-bold tabular-nums text-accent">{formatCurrency(r.shareAmount)}</span>
              ),
            },
            {
              key: 'paymentStatus',
              header: 'Status',
              width: '120px',
              render: (r: any) => (
                <Badge tone={r.paymentStatus === 'PAID' ? 'positive' : 'warning'} dot>
                  {r.paymentStatus === 'PAID' ? 'Paid' : 'Pending'}
                </Badge>
              ),
            },
          ]}
          rows={data.partnerDistribution}
          rowKey={(row) => row.id}
          emptyTitle="No partners configured"
          emptyMessage="Add partners on the Partners page to see the distribution here."
        />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <MotionCard className="p-5">
              <p className="text-[0.68rem] uppercase tracking-wider text-ink-subtle">Monthly salary bill (active)</p>
              <p className="mt-1.5 text-2xl font-bold tabular-nums text-ink">
                {formatCurrency(data.employeeCost.totalMonthly)}
              </p>
            </MotionCard>
            <MotionCard delay={0.06} className="p-5">
              <p className="text-[0.68rem] uppercase tracking-wider text-ink-subtle">Percentage payouts in period</p>
              <p className="mt-1.5 text-2xl font-bold tabular-nums text-accent">
                {formatCurrency(data.employeeCost.specialPayouts)}
              </p>
            </MotionCard>
          </div>
          <DataTable
            columns={[
              { key: 'name', header: 'Employee', render: (r: any) => <span className="text-sm font-medium text-ink">{r.name}</span> },
              { key: 'role', header: 'Role', render: (r: any) => <Badge tone="info">{r.role}</Badge> },
              { key: 'type', header: 'Type', render: (r: any) => <span className="text-xs text-ink-muted">{r.type}</span> },
              {
                key: 'monthlySalary',
                header: 'Salary',
                align: 'right',
                render: (r: any) => <span className="text-sm tabular-nums text-ink-muted">{formatCurrency(r.monthlySalary)}</span>,
              },
              {
                key: 'bonus',
                header: 'Bonus',
                align: 'right',
                render: (r: any) => <span className="text-sm tabular-nums text-ink-muted">{formatCurrency(r.bonus)}</span>,
              },
              {
                key: 'totalMonthlyCost',
                header: 'Total',
                align: 'right',
                render: (r: any) => (
                  <span className="text-sm font-semibold tabular-nums text-ink">{formatCurrency(r.totalMonthlyCost)}</span>
                ),
              },
              {
                key: 'isActive',
                header: 'Status',
                width: '100px',
                render: (r: any) => (
                  <Badge tone={r.isActive ? 'positive' : 'neutral'} dot>
                    {r.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                ),
              },
            ]}
            rows={data.employeeCost.rows}
            rowKey={(row) => row.id}
            emptyTitle="No employees recorded"
          />
        </div>
      )}
    </div>
  );
}
