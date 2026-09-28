import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Download, Pencil, Plus, Search, Trash2, TrendingUp } from 'lucide-react';
import { api, apiError, downloadFile } from '../lib/api';
import { formatCurrency, formatDate, formatPercent } from '../lib/format';
import { useAuth } from '../store/AuthProvider';
import { useToast } from '../store/ToastProvider';
import { useDebounce } from '../hooks/useDebounce';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { PageHeader } from '../components/layout/PageHeader';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { CardBody, CardHeader, MotionCard } from '../components/ui/Card';
import { DataTable, type Column } from '../components/ui/DataTable';
import { Input, Select } from '../components/ui/Input';
import { ProgressBar } from '../components/ui/Progress';
import { Skeleton } from '../components/ui/Skeleton';
import { useConfirm } from '../components/ui/ConfirmDialog';
import { RevenueFormModal } from '../components/forms/RevenueFormModal';
import { RevenueTrendChart } from '../components/charts/Charts';
import type { Paged, Revenue } from '../types';

export default function RevenuePage() {
  useDocumentTitle('Revenue');
  const toast = useToast();
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const { confirm, dialog } = useConfirm();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Revenue | null>(null);
  const debounced = useDebounce(search, 350);

  const params = useMemo(
    () => ({
      page,
      pageSize: 50,
      search: debounced || undefined,
      status: status !== 'ALL' ? status : undefined,
    }),
    [page, debounced, status],
  );

  const { data, isLoading } = useQuery({
    queryKey: ['revenue', params],
    queryFn: async () =>
      (
        await api.get<
          Paged<Revenue> & { totals: { projected: number; received: number; outstanding: number; accuracy: number } }
        >('/revenue', { params })
      ).data,
  });

  const { data: trends } = useQuery({
    queryKey: ['revenue-trends'],
    queryFn: async () =>
      (await api.get<{ months: { label: string; projected: number; received: number }[] }>('/revenue/trends')).data.months,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['revenue'] });
    void queryClient.invalidateQueries({ queryKey: ['revenue-trends'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    void queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  const receive = useMutation({
    mutationFn: async (id: string) => api.post(`/revenue/${id}/receive`, {}),
    onSuccess: () => {
      toast.success('Marked as received');
      invalidate();
    },
    onError: (error) => toast.error('Could not update', apiError(error)),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/revenue/${id}`),
    onSuccess: () => {
      toast.success('Revenue entry deleted');
      invalidate();
    },
    onError: (error) => toast.error('Could not delete', apiError(error)),
  });

  const totals = data?.totals;

  const columns: Column<Revenue>[] = [
    {
      key: 'clientName',
      header: 'Client / source',
      sortValue: (r) => r.clientName.toLowerCase(),
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{row.clientName}</p>
          {row.source && <p className="truncate text-[0.7rem] text-ink-muted">{row.source}</p>}
        </div>
      ),
    },
    {
      key: 'projectedDate',
      header: 'Projected',
      width: '120px',
      sortValue: (r) => r.projectedDate,
      render: (row) => <span className="whitespace-nowrap text-xs text-ink-muted">{formatDate(row.projectedDate)}</span>,
    },
    {
      key: 'receivedDate',
      header: 'Received',
      width: '120px',
      sortValue: (r) => r.receivedDate ?? '',
      render: (row) => (
        <span className="whitespace-nowrap text-xs text-ink-muted">
          {row.receivedDate ? formatDate(row.receivedDate) : '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '130px',
      render: (row) => (
        <Badge
          tone={row.displayStatus === 'RECEIVED' ? 'positive' : row.displayStatus === 'OVERDUE' ? 'danger' : 'info'}
          dot
        >
          {row.displayStatus === 'OVERDUE' ? `Overdue ${row.daysLate}d` : row.displayStatus === 'RECEIVED' ? 'Received' : 'Projected'}
        </Badge>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      width: '130px',
      sortValue: (r) => r.amount,
      render: (row) => (
        <div className="whitespace-nowrap">
          <p className="text-sm font-semibold tabular-nums text-ink">
            {formatCurrency(row.receivedAmount ?? row.amount)}
          </p>
          {row.receivedAmount != null && row.receivedAmount !== row.amount && (
            <p className="text-[0.65rem] text-ink-subtle line-through">{formatCurrency(row.amount)}</p>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: '130px',
      render: (row) =>
        can('manage:revenue') ? (
          <div className="flex justify-end gap-1">
            {row.status === 'PROJECTED' && (
              <Button
                size="icon"
                variant="ghost"
                className="hover:text-positive"
                aria-label={`Mark ${row.clientName} as received`}
                title="Mark as received"
                onClick={() =>
                  confirm({
                    title: 'Mark as received',
                    destructive: false,
                    confirmLabel: 'Mark received',
                    message: (
                      <>
                        Record <strong className="text-ink">{formatCurrency(row.amount)}</strong> from{' '}
                        <strong className="text-ink">{row.clientName}</strong> as received today?
                      </>
                    ),
                    onConfirm: () => receive.mutateAsync(row.id),
                  })
                }
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              aria-label={`Edit ${row.clientName}`}
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
              aria-label={`Delete ${row.clientName}`}
              onClick={() =>
                confirm({
                  title: 'Delete revenue entry',
                  message: (
                    <>
                      Delete the entry for <strong className="text-ink">{row.clientName}</strong>? This cannot be undone.
                    </>
                  ),
                  onConfirm: () => remove.mutateAsync(row.id),
                })
              }
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <span className="text-[0.68rem] text-ink-subtle">Read only</span>
        ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Revenue"
        subtitle="What you expect to collect, and what has actually landed."
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => downloadFile('/revenue/export', params).catch((e) => toast.error('Export failed', apiError(e)))}
            >
              <Download className="h-4 w-4" /> Export CSV
            </Button>
            {can('manage:revenue') && (
              <Button
                onClick={() => {
                  setEditing(null);
                  setModalOpen(true);
                }}
              >
                <Plus className="h-4 w-4" /> Add revenue
              </Button>
            )}
          </>
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MotionCard className="p-5">
          <p className="text-[0.68rem] uppercase tracking-wider text-ink-subtle">Projected</p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums text-ink">{formatCurrency(totals?.projected ?? 0)}</p>
        </MotionCard>
        <MotionCard delay={0.06} className="p-5">
          <p className="text-[0.68rem] uppercase tracking-wider text-ink-subtle">Received</p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums text-positive">{formatCurrency(totals?.received ?? 0)}</p>
        </MotionCard>
        <MotionCard delay={0.12} className="p-5">
          <p className="text-[0.68rem] uppercase tracking-wider text-ink-subtle">Outstanding</p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums text-warning">{formatCurrency(totals?.outstanding ?? 0)}</p>
        </MotionCard>
        <MotionCard delay={0.18} className="p-5">
          <p className="text-[0.68rem] uppercase tracking-wider text-ink-subtle">Projection accuracy</p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums text-accent">{formatPercent(totals?.accuracy ?? 0)}</p>
          <ProgressBar value={totals?.accuracy ?? 0} tone="gold" height={6} className="mt-2.5" />
        </MotionCard>
      </div>

      <MotionCard delay={0.2} className="mb-4">
        <CardHeader
          title="Projected vs received"
          subtitle="Last 12 months"
          icon={<TrendingUp className="h-4 w-4" strokeWidth={1.8} />}
        />
        <CardBody className="pt-2">
          {!trends ? <Skeleton className="h-[260px]" /> : <RevenueTrendChart data={trends} />}
        </CardBody>
      </MotionCard>

      <div className="mb-4 flex flex-wrap gap-2.5">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search clients or channels…"
            className="pl-9"
            aria-label="Search revenue"
          />
        </div>
        <Select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="w-[170px]"
          aria-label="Filter by status"
        >
          <option value="ALL">All statuses</option>
          <option value="PROJECTED">Projected</option>
          <option value="RECEIVED">Received</option>
          <option value="OVERDUE">Overdue only</option>
        </Select>
      </div>

      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        rowKey={(row) => row.id}
        loading={isLoading}
        emptyTitle="No revenue recorded"
        emptyMessage="Add projected invoices so you can track collection against them."
        rowClassName={(row) => (row.isOverdue ? 'bg-danger/[0.06] hover:bg-danger/[0.1]' : undefined)}
        pagination={
          data
            ? { page: data.meta.page, totalPages: data.meta.totalPages, total: data.meta.total, onPageChange: setPage }
            : undefined
        }
      />

      <RevenueFormModal open={modalOpen} onClose={() => setModalOpen(false)} revenue={editing} />
      {dialog}
    </div>
  );
}
