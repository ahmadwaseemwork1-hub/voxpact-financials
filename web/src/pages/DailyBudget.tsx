import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Save, Wallet } from 'lucide-react';
import { api, apiError } from '../lib/api';
import { formatCurrency, formatDate, todayInput } from '../lib/format';
import { cn } from '../lib/utils';
import { useAuth } from '../store/AuthProvider';
import { useToast } from '../store/ToastProvider';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { PageHeader } from '../components/layout/PageHeader';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { CardBody, CardHeader, MotionCard } from '../components/ui/Card';
import { Field, Input, Select, Toggle } from '../components/ui/Input';
import { Gauge, ProgressBar } from '../components/ui/Progress';
import { Skeleton } from '../components/ui/Skeleton';
import { BudgetHistoryChart } from '../components/charts/Charts';
import type { BudgetSnapshot } from '../types';

interface HistoryPoint {
  date: string;
  label: string;
  budget: number;
  spent: number;
  percentUsed: number;
  status: 'HEALTHY' | 'WARNING' | 'DANGER';
}

const STATUS_COPY = {
  HEALTHY: { tone: 'positive' as const, label: 'On track', message: 'Spending is comfortably within today’s limit.' },
  WARNING: { tone: 'warning' as const, label: 'Watch it', message: 'You have used more than 70% of today’s budget.' },
  DANGER: { tone: 'danger' as const, label: 'Critical', message: 'Over 90% of today’s budget is gone.' },
};

export default function DailyBudget() {
  useDocumentTitle('Daily budget');
  const toast = useToast();
  const queryClient = useQueryClient();
  const { can } = useAuth();

  const [date, setDate] = useState(todayInput());
  const [amount, setAmount] = useState('');
  const [applyDefault, setApplyDefault] = useState(false);
  const [days, setDays] = useState(30);

  const { data: snapshot, isLoading } = useQuery({
    queryKey: ['budget', 'day', date],
    queryFn: async () => (await api.get<BudgetSnapshot>('/budget/day', { params: { date } })).data,
  });

  const { data: history } = useQuery({
    queryKey: ['budget', 'history', days],
    queryFn: async () => (await api.get<{ series: HistoryPoint[] }>('/budget/history', { params: { days } })).data.series,
  });

  useEffect(() => {
    if (snapshot) setAmount(String(snapshot.budgetAmount));
  }, [snapshot]);

  const save = useMutation({
    mutationFn: async () =>
      (
        await api.put('/budget/day', {
          date: new Date(date).toISOString(),
          budgetAmount: Number(amount || 0),
          applyAsDefault: applyDefault,
        })
      ).data,
    onSuccess: () => {
      toast.success('Budget updated', applyDefault ? 'Also saved as the default daily budget.' : undefined);
      void queryClient.invalidateQueries({ queryKey: ['budget'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (error) => toast.error('Could not save budget', apiError(error)),
  });

  const status = snapshot ? STATUS_COPY[snapshot.status] : STATUS_COPY.HEALTHY;
  const exceeded = snapshot ? snapshot.remaining < 0 : false;

  const streak = history?.filter((h) => h.percentUsed <= 100).length ?? 0;
  const breaches = history?.filter((h) => h.percentUsed > 100).length ?? 0;

  return (
    <div>
      <PageHeader
        title="Daily budget"
        subtitle="A hard daily spending ceiling, tracked against real expense entries."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <MotionCard className="lg:col-span-2">
          <CardHeader
            title={`Budget for ${formatDate(date)}`}
            subtitle={snapshot?.isDefault ? 'Using the default daily budget' : 'Custom budget set for this day'}
            icon={<Wallet className="h-4 w-4" strokeWidth={1.8} />}
            action={<Badge tone={status.tone} dot>{status.label}</Badge>}
          />
          <CardBody>
            {isLoading || !snapshot ? (
              <Skeleton className="h-[160px]" />
            ) : (
              <>
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="text-[0.68rem] uppercase tracking-wider text-ink-subtle">Spent today</p>
                    <p
                      className={cn(
                        'mt-1 font-display text-3xl font-bold tabular-nums',
                        exceeded ? 'text-danger' : 'text-ink',
                      )}
                    >
                      {formatCurrency(snapshot.spentAmount)}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-muted">of {formatCurrency(snapshot.budgetAmount)} budgeted</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[0.68rem] uppercase tracking-wider text-ink-subtle">
                      {exceeded ? 'Over budget by' : 'Remaining'}
                    </p>
                    <p
                      className={cn(
                        'mt-1 font-display text-3xl font-bold tabular-nums',
                        exceeded ? 'text-danger' : 'text-positive',
                      )}
                    >
                      {formatCurrency(Math.abs(snapshot.remaining))}
                    </p>
                  </div>
                </div>

                <ProgressBar value={snapshot.percentUsed} height={12} className="mt-5" />
                <div className="mt-2 flex justify-between text-[0.7rem] text-ink-subtle">
                  <span>0%</span>
                  <span className="text-positive">70%</span>
                  <span className="text-warning">90%</span>
                  <span className={snapshot.percentUsed > 100 ? 'font-semibold text-danger' : ''}>
                    {snapshot.percentUsed.toFixed(0)}%
                  </span>
                </div>

                <div
                  className={cn(
                    'mt-5 flex items-start gap-2.5 rounded-xl border px-4 py-3',
                    snapshot.status === 'DANGER'
                      ? 'border-danger/30 bg-danger/[0.08]'
                      : snapshot.status === 'WARNING'
                        ? 'border-warning/30 bg-warning/[0.08]'
                        : 'border-positive/30 bg-positive/[0.07]',
                  )}
                >
                  {snapshot.status === 'HEALTHY' ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-positive" />
                  ) : (
                    <AlertTriangle
                      className={cn(
                        'mt-0.5 h-4 w-4 shrink-0',
                        snapshot.status === 'DANGER' ? 'text-danger' : 'text-warning',
                      )}
                    />
                  )}
                  <p
                    className={cn(
                      'text-xs leading-relaxed',
                      snapshot.status === 'DANGER'
                        ? 'text-danger'
                        : snapshot.status === 'WARNING'
                          ? 'text-warning'
                          : 'text-positive',
                    )}
                  >
                    {exceeded
                      ? `Daily budget exceeded by ${formatCurrency(Math.abs(snapshot.remaining))}. Review today's entries.`
                      : status.message}
                  </p>
                </div>
              </>
            )}
          </CardBody>
        </MotionCard>

        <MotionCard delay={0.08}>
          <CardHeader title="Utilisation" subtitle="Live against today's entries" />
          <CardBody className="flex flex-col items-center">
            {snapshot ? (
              <Gauge value={snapshot.percentUsed} size={170} label="of budget used" />
            ) : (
              <Skeleton className="h-[140px]" />
            )}
            <div className="mt-5 grid w-full grid-cols-2 gap-3 border-t border-line pt-4">
              <div>
                <p className="text-[0.66rem] uppercase tracking-wider text-ink-subtle">Days within budget</p>
                <p className="mt-0.5 text-lg font-bold tabular-nums text-positive">{streak}</p>
              </div>
              <div>
                <p className="text-[0.66rem] uppercase tracking-wider text-ink-subtle">Days over</p>
                <p className="mt-0.5 text-lg font-bold tabular-nums text-danger">{breaches}</p>
              </div>
            </div>
          </CardBody>
        </MotionCard>
      </div>

      {can('manage:budget') && (
        <MotionCard delay={0.14} className="mt-4">
          <CardHeader title="Set budget" subtitle="Administrators only" />
          <CardBody className="grid gap-4 sm:grid-cols-4">
            <Field label="Date">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Budget amount">
              <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <div className="flex items-end">
              <div className="flex w-full items-center justify-between rounded-xl border border-line bg-surface-elevated/50 px-4 py-2.5">
                <span className="text-xs text-ink-muted">Set as default</span>
                <Toggle checked={applyDefault} onChange={setApplyDefault} size="sm" label="Set as default budget" />
              </div>
            </div>
            <div className="flex items-end">
              <Button fullWidth onClick={() => save.mutate()} loading={save.isPending}>
                <Save className="h-4 w-4" /> Save budget
              </Button>
            </div>
          </CardBody>
        </MotionCard>
      )}

      <MotionCard delay={0.2} className="mt-4">
        <CardHeader
          title="Budget history"
          subtitle="Spending against budget, day by day"
          action={
            <Select value={String(days)} onChange={(e) => setDays(Number(e.target.value))} className="h-8 w-[130px] text-xs">
              <option value="14">Last 14 days</option>
              <option value="30">Last 30 days</option>
              <option value="60">Last 60 days</option>
              <option value="90">Last 90 days</option>
            </Select>
          }
        />
        <CardBody className="pt-2">
          {!history ? <Skeleton className="h-[240px]" /> : <BudgetHistoryChart data={history} />}
        </CardBody>
      </MotionCard>
    </div>
  );
}
