import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Download, Pencil, Plus, RotateCcw, Trash2, Users2 } from 'lucide-react';
import { api, apiError, downloadFile } from '../lib/api';
import { formatCurrency, formatPercent } from '../lib/format';
import { cn } from '../lib/utils';
import { useToast } from '../store/ToastProvider';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { PageHeader } from '../components/layout/PageHeader';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { CardBody, CardHeader, MotionCard } from '../components/ui/Card';
import { DataTable, type Column } from '../components/ui/DataTable';
import { Field, Input } from '../components/ui/Input';
import { ProgressBar } from '../components/ui/Progress';
import { useConfirm } from '../components/ui/ConfirmDialog';
import { PartnerFormModal } from '../components/forms/PartnerFormModal';
import type { Distribution, Partner } from '../types';

export default function Partners() {
  useDocumentTitle('Partner distribution');
  const toast = useToast();
  const queryClient = useQueryClient();
  const { confirm, dialog } = useConfirm();

  const [profitInput, setProfitInput] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Partner | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['partners'],
    queryFn: async () => (await api.get<Distribution>('/partners')).data,
  });

  useEffect(() => {
    if (data && profitInput === '') setProfitInput(String(data.profit || ''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const liveProfit = Number(profitInput || 0);

  const saveProfit = useMutation({
    mutationFn: async (profit: number) => (await api.put('/partners/profit', { profit })).data,
    onSuccess: () => {
      toast.success('Distributable profit saved');
      void queryClient.invalidateQueries({ queryKey: ['partners'] });
    },
    onError: (error) => toast.error('Could not save', apiError(error)),
  });

  const togglePaid = useMutation({
    mutationFn: async (id: string) => api.post(`/partners/${id}/toggle-paid`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['partners'] }),
    onError: (error) => toast.error('Could not update', apiError(error)),
  });

  const resetPayments = useMutation({
    mutationFn: async () => api.post('/partners/reset-payments'),
    onSuccess: () => {
      toast.success('Payment statuses reset');
      void queryClient.invalidateQueries({ queryKey: ['partners'] });
    },
    onError: (error) => toast.error('Could not reset', apiError(error)),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/partners/${id}`),
    onSuccess: () => {
      toast.success('Partner removed');
      void queryClient.invalidateQueries({ queryKey: ['partners'] });
    },
    onError: (error) => toast.error('Could not remove', apiError(error)),
  });

  const partners = data?.partners ?? [];
  const totalPct = data?.totalPercentage ?? 0;
  const valid = data?.isValid ?? false;

  const columns: Column<Partner>[] = [
    {
      key: 'name',
      header: 'Partner',
      sortValue: (r) => r.name.toLowerCase(),
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{row.name}</p>
          {row.email && <p className="truncate text-[0.7rem] text-ink-muted">{row.email}</p>}
        </div>
      ),
    },
    {
      key: 'percentage',
      header: 'Ownership',
      align: 'right',
      width: '160px',
      sortValue: (r) => r.percentage,
      render: (row) => (
        <div className="flex items-center justify-end gap-2.5">
          <ProgressBar value={row.percentage} tone="gold" height={6} className="w-16" />
          <span className="w-14 text-right text-sm font-semibold tabular-nums text-ink">
            {formatPercent(row.percentage, 2)}
          </span>
        </div>
      ),
    },
    {
      key: 'share',
      header: 'Share amount',
      align: 'right',
      width: '150px',
      sortValue: (r) => r.percentage,
      render: (row) => (
        <span className="text-sm font-bold tabular-nums text-accent">
          {formatCurrency((liveProfit * row.percentage) / 100)}
        </span>
      ),
    },
    {
      key: 'paymentStatus',
      header: 'Payment',
      width: '120px',
      render: (row) => (
        <button type="button" onClick={() => togglePaid.mutate(row.id)} aria-label={`Mark ${row.name} as ${row.paymentStatus === 'PAID' ? 'pending' : 'paid'}`}>
          <Badge tone={row.paymentStatus === 'PAID' ? 'positive' : 'warning'} dot>
            {row.paymentStatus === 'PAID' ? 'Paid' : 'Pending'}
          </Badge>
        </button>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: '90px',
      render: (row) => (
        <div className="flex justify-end gap-1">
          <Button
            size="icon"
            variant="ghost"
            aria-label={`Edit ${row.name}`}
            onClick={() => {
              setEditing(row);
              setModalOpen(true);
            }}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="hover:text-danger"
            aria-label={`Remove ${row.name}`}
            onClick={() =>
              confirm({
                title: 'Remove partner',
                message: (
                  <>
                    Remove <strong className="text-ink">{row.name}</strong> and free up{' '}
                    {formatPercent(row.percentage, 2)} of ownership?
                  </>
                ),
                onConfirm: () => remove.mutateAsync(row.id),
              })
            }
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Partner profit distribution"
        subtitle="Split net profit across partners and track who has been paid."
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => downloadFile('/partners/export').catch((e) => toast.error('Export failed', apiError(e)))}
            >
              <Download className="h-4 w-4" /> Export report
            </Button>
            <Button
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> Add partner
            </Button>
          </>
        }
      />

      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <MotionCard className="lg:col-span-2">
          <CardHeader
            title="Distributable profit"
            subtitle="Net profit after all expenses — this is what gets split."
            icon={<Users2 className="h-4 w-4" strokeWidth={1.8} />}
          />
          <CardBody className="flex flex-wrap items-end gap-4">
            <Field label="Profit amount" className="min-w-[220px] flex-1">
              <Input
                type="number"
                step="0.01"
                min="0"
                value={profitInput}
                onChange={(e) => setProfitInput(e.target.value)}
                placeholder="0.00"
              />
            </Field>
            <Button onClick={() => saveProfit.mutate(liveProfit)} loading={saveProfit.isPending}>
              Save profit
            </Button>
            <Button variant="secondary" onClick={() => resetPayments.mutate()} loading={resetPayments.isPending}>
              <RotateCcw className="h-3.5 w-3.5" /> New payout cycle
            </Button>
          </CardBody>
        </MotionCard>

        <MotionCard delay={0.08}>
          <CardHeader title="Allocation" subtitle="Total must equal 100%" />
          <CardBody>
            <div className="flex items-end justify-between">
              <p
                className={cn(
                  'font-display text-3xl font-bold tabular-nums',
                  valid ? 'text-positive' : totalPct > 100 ? 'text-danger' : 'text-warning',
                )}
              >
                {formatPercent(totalPct, 2)}
              </p>
              {valid ? (
                <Badge tone="positive" dot>
                  Balanced
                </Badge>
              ) : (
                <Badge tone={totalPct > 100 ? 'danger' : 'warning'} dot>
                  {totalPct > 100 ? 'Over-allocated' : `${formatPercent(100 - totalPct, 2)} free`}
                </Badge>
              )}
            </div>
            <ProgressBar value={totalPct} tone={valid ? 'positive' : totalPct > 100 ? 'danger' : 'warning'} className="mt-3" />
            {!valid && (
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/[0.08] px-3 py-2.5">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                <p className="text-[0.72rem] leading-relaxed text-warning">
                  Shares are still calculated, but the split does not add up to 100% — adjust the percentages before
                  paying out.
                </p>
              </div>
            )}
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4">
              <div>
                <p className="text-[0.66rem] uppercase tracking-wider text-ink-subtle">Distributed</p>
                <p className="mt-0.5 text-sm font-bold tabular-nums text-ink">
                  {formatCurrency((liveProfit * totalPct) / 100)}
                </p>
              </div>
              <div>
                <p className="text-[0.66rem] uppercase tracking-wider text-ink-subtle">Already paid</p>
                <p className="mt-0.5 text-sm font-bold tabular-nums text-positive">
                  {formatCurrency(
                    partners
                      .filter((p) => p.paymentStatus === 'PAID')
                      .reduce((s, p) => s + (liveProfit * p.percentage) / 100, 0),
                  )}
                </p>
              </div>
            </div>
          </CardBody>
        </MotionCard>
      </div>

      <DataTable
        columns={columns}
        rows={partners}
        rowKey={(row) => row.id}
        loading={isLoading}
        emptyTitle="No partners defined"
        emptyMessage="Add each partner and their ownership percentage to calculate payouts automatically."
        emptyAction={
          <Button
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Add first partner
          </Button>
        }
        footer={
          partners.length ? (
            <tr className="border-t border-line">
              <td className="px-4 py-3 text-xs font-medium text-ink-muted">Total</td>
              <td className="px-4 py-3 text-right text-sm font-bold tabular-nums text-ink">
                {formatPercent(totalPct, 2)}
              </td>
              <td className="px-4 py-3 text-right text-sm font-bold tabular-nums text-accent">
                {formatCurrency((liveProfit * totalPct) / 100)}
              </td>
              <td colSpan={2} className="px-4 py-3">
                {partners.every((p) => p.paymentStatus === 'PAID') && partners.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-positive">
                    <CheckCircle2 className="h-3.5 w-3.5" /> All partners paid
                  </span>
                )}
              </td>
            </tr>
          ) : undefined
        }
      />

      <PartnerFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        partner={editing}
        availablePercentage={Math.max(0, 100 - totalPct)}
      />
      {dialog}
    </div>
  );
}
