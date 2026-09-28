import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  Receipt,
  TrendingUp,
  Wallet,
  AlertTriangle,
  Activity,
} from 'lucide-react';
import { api } from '../lib/api';
import { formatCurrency, formatDateTime, formatPercent } from '../lib/format';
import { cn } from '../lib/utils';
import { useAuth } from '../store/AuthProvider';
import { useCountUp } from '../hooks/useCountUp';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { PageHeader } from '../components/layout/PageHeader';
import { Card, CardBody, CardHeader, MotionCard } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Gauge } from '../components/ui/Progress';
import { StatSkeleton, Skeleton } from '../components/ui/Skeleton';
import { ExpenseTrendChart, RevenueVsExpensesChart } from '../components/charts/Charts';
import type { DashboardData } from '../types';

function StatCard({
  label,
  value,
  sublabel,
  change,
  icon: Icon,
  tone = 'gold',
  delay = 0,
  invertChange,
}: {
  label: string;
  value: number;
  sublabel?: string;
  change?: number;
  icon: typeof Wallet;
  tone?: 'gold' | 'positive' | 'danger' | 'navy';
  delay?: number;
  invertChange?: boolean;
}) {
  const animated = useCountUp(value);
  const positiveChange = change !== undefined && (invertChange ? change < 0 : change > 0);

  const tones = {
    gold: 'bg-accent/12 text-accent',
    positive: 'bg-positive/12 text-positive',
    danger: 'bg-danger/12 text-danger',
    navy: 'bg-navy-400/15 text-navy-300',
  };

  return (
    <MotionCard delay={delay} className="group relative overflow-hidden p-5 transition-all duration-300 ease-premium hover:-translate-y-1 hover:border-accent/35 hover:shadow-lift">
      <div className="pointer-events-none absolute inset-0 -translate-x-full bg-sheen opacity-0 transition-all duration-700 group-hover:translate-x-full group-hover:opacity-100" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.7rem] font-medium uppercase tracking-wider text-ink-subtle">{label}</p>
          <p className="mt-2.5 truncate font-display text-[1.6rem] font-bold tabular-nums tracking-tight text-ink">
            {formatCurrency(animated)}
          </p>
        </div>
        <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', tones[tone])}>
          <Icon className="h-5 w-5" strokeWidth={1.7} />
        </span>
      </div>
      <div className="mt-3 flex items-center gap-2">
        {change !== undefined && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-xs font-semibold',
              positiveChange ? 'text-positive' : change === 0 ? 'text-ink-subtle' : 'text-danger',
            )}
          >
            {change >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
            {Math.abs(change).toFixed(1)}%
          </span>
        )}
        {sublabel && <span className="truncate text-xs text-ink-muted">{sublabel}</span>}
      </div>
    </MotionCard>
  );
}

export default function Dashboard() {
  useDocumentTitle('Dashboard');
  const { user, isManager } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => (await api.get<DashboardData>('/dashboard')).data,
    refetchInterval: 120_000,
  });

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <div>
      <PageHeader
        title={`${greeting}, ${user?.fullName?.split(' ')[0] || user?.username}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            Here's where Voxpact stands today.
            {data && data.stats.overdueCount > 0 && isManager && (
              <Link to="/revenue">
                <Badge tone="danger" dot>
                  {data.stats.overdueCount} overdue invoice{data.stats.overdueCount === 1 ? '' : 's'}
                </Badge>
              </Link>
            )}
          </span>
        }
      />

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {isLoading || !data ? (
          Array.from({ length: 4 }).map((_, i) => <StatSkeleton key={i} />)
        ) : (
          <>
            <StatCard
              label="Revenue received"
              value={data.stats.revenueThisMonth}
              change={data.stats.revenueChangePct}
              sublabel="this month vs last"
              icon={TrendingUp}
              tone="positive"
              delay={0}
            />
            <StatCard
              label="Expenses"
              value={data.stats.monthlyExpenses}
              change={data.stats.expenseChangePct}
              invertChange
              sublabel={`${data.stats.expenseCount} entries this month`}
              icon={Receipt}
              tone="gold"
              delay={0.06}
            />
            <StatCard
              label="Net profit"
              value={data.stats.netProfit}
              sublabel="month to date"
              icon={Banknote}
              tone={data.stats.netProfit >= 0 ? 'positive' : 'danger'}
              delay={0.12}
            />
            {isManager ? (
              <StatCard
                label="Cash on hand"
                value={data.stats.cashOnHand ?? 0}
                sublabel="all received minus all spent"
                icon={Wallet}
                tone="navy"
                delay={0.18}
              />
            ) : (
              <StatCard
                label="Projected revenue"
                value={data.stats.totalRevenueProjected}
                sublabel={`${formatPercent(data.stats.projectionAccuracy)} collected`}
                icon={Wallet}
                tone="navy"
                delay={0.18}
              />
            )}
          </>
        )}
      </div>

      {/* Charts */}
      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        <MotionCard delay={0.2} className="xl:col-span-2">
          <CardHeader
            title="Revenue vs expenses"
            subtitle="Last 6 months"
            icon={<Activity className="h-4 w-4" strokeWidth={1.8} />}
          />
          <CardBody className="pt-2">
            {isLoading || !data ? <Skeleton className="h-[240px]" /> : <RevenueVsExpensesChart data={data.charts.revenueVsExpenses} />}
          </CardBody>
        </MotionCard>

        <MotionCard delay={0.26}>
          <CardHeader title="Today's budget" subtitle="Daily spending limit" />
          <CardBody className="flex flex-col items-center pt-1">
            {isLoading || !data ? (
              <Skeleton className="h-[200px]" />
            ) : (
              <>
                <Gauge
                  value={data.budget.percentUsed}
                  label="of daily budget used"
                  sublabel={`${formatCurrency(data.budget.spentAmount)} of ${formatCurrency(data.budget.budgetAmount)}`}
                />
                <div className="mt-4 w-full rounded-xl border border-line bg-surface-elevated/50 px-4 py-3 text-center">
                  <p className="text-xs text-ink-muted">Remaining today</p>
                  <p
                    className={cn(
                      'mt-0.5 text-lg font-bold tabular-nums',
                      data.budget.remaining < 0 ? 'text-danger' : 'text-ink',
                    )}
                  >
                    {formatCurrency(data.budget.remaining)}
                  </p>
                </div>
                {data.budget.percentUsed > 90 && (
                  <div className="mt-3 flex w-full items-center gap-2 rounded-xl border border-danger/30 bg-danger/[0.08] px-3 py-2.5">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-danger" />
                    <p className="text-[0.72rem] leading-snug text-danger">
                      {data.budget.percentUsed > 100 ? 'Daily budget exceeded.' : 'Daily budget nearly spent.'}
                    </p>
                  </div>
                )}
              </>
            )}
          </CardBody>
        </MotionCard>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <MotionCard delay={0.3} className="xl:col-span-2">
          <CardHeader title="Expense trend" subtitle="Last 7 days" />
          <CardBody className="pt-2">
            {isLoading || !data ? <Skeleton className="h-[220px]" /> : <ExpenseTrendChart data={data.charts.expenseTrend} />}
          </CardBody>
        </MotionCard>

        <MotionCard delay={0.34}>
          <CardHeader
            title="Recent activity"
            subtitle="Last 10 transactions"
            action={
              <Link to="/expenses/daily" className="text-[0.7rem] text-accent hover:underline">
                View all
              </Link>
            }
          />
          <div className="max-h-[360px] overflow-y-auto">
            {isLoading || !data ? (
              <div className="space-y-3 p-5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10" />
                ))}
              </div>
            ) : data.activity.length === 0 ? (
              <p className="px-5 py-10 text-center text-xs text-ink-muted">No transactions recorded yet.</p>
            ) : (
              data.activity.map((item) => (
                <motion.div
                  key={`${item.kind}-${item.id}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-3 border-b border-line/60 px-5 py-3 last:border-0"
                >
                  <span
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                      item.kind === 'REVENUE' ? 'bg-positive/12 text-positive' : 'bg-accent/12 text-accent',
                    )}
                  >
                    {item.kind === 'REVENUE' ? (
                      <TrendingUp className="h-4 w-4" strokeWidth={1.8} />
                    ) : (
                      <Receipt className="h-4 w-4" strokeWidth={1.8} />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.82rem] font-medium text-ink">{item.title}</p>
                    <p className="truncate text-[0.68rem] text-ink-muted">
                      {item.subtitle} · {formatDateTime(item.at)}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 text-xs font-semibold tabular-nums',
                      item.amount >= 0 ? 'text-positive' : 'text-ink-muted',
                    )}
                  >
                    {item.amount >= 0 ? '+' : '−'}
                    {formatCurrency(Math.abs(item.amount))}
                  </span>
                </motion.div>
              ))
            )}
          </div>
        </MotionCard>
      </div>
    </div>
  );
}
