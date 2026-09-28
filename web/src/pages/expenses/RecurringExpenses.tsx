import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, CopyPlus, Download, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { api, apiError, downloadFile } from '../../lib/api';
import { formatCurrency, formatDate } from '../../lib/format';
import { useToast } from '../../store/ToastProvider';
import { useDebounce } from '../../hooks/useDebounce';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { MotionCard } from '../../components/ui/Card';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Input, Select } from '../../components/ui/Input';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { ExpenseFormModal } from '../../components/forms/ExpenseFormModal';
import type { Expense, Paged } from '../../types';

export default function RecurringExpenses() {
  useDocumentTitle('Recurring expenses');
  const toast = useToast();
  const queryClient = useQueryClient();
  const { confirm, dialog } = useConfirm();

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const debounced = useDebounce(search, 350);

  const params = useMemo(
    () => ({
      type: 'RECURRING',
      page,
      pageSize: 50,
      search: debounced || undefined,
      category: category !== 'ALL' ? category : undefined,
      status: status !== 'ALL' ? status : undefined,
    }),
    [page, debounced, category, status],
  );

  const { data, isLoading } = useQuery({
    queryKey: ['expenses', 'recurring', params],
    queryFn: async () => (await api.get<Paged<Expense> & { totals: { amount: number } }>('/expenses', { params })).data,
  });

  const { data: categories } = useQuery({
    queryKey: ['expense-categories'],
    queryFn: async () => (await api.get<{ categories: string[] }>('/expenses/categories')).data.categories,
    staleTime: 300_000,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['expenses'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    void queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  const togglePaid = useMutation({
    mutationFn: async (id: string) => api.post(`/expenses/${id}/toggle-paid`),
    onSuccess: invalidate,
    onError: (error) => toast.error('Could not update', apiError(error)),
  });

  const rollover = useMutation({
    mutationFn: async (id: string) => api.post(`/expenses/${id}/rollover`),
    onSuccess: () => {
      toast.success('Rolled over to next month');
      invalidate();
    },
    onError: (error) => toast.error('Could not roll over', apiError(error)),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/expenses/${id}`),
    onSuccess: () => {
      toast.success('Recurring expense deleted');
      invalidate();
    },
    onError: (error) => toast.error('Could not delete', apiError(error)),
  });

  const rows = data?.data ?? [];
  const monthlyTotal = data?.totals.amount ?? 0;
  const unpaid = rows.filter((r) => !r.isPaid).reduce((s, r) => s + r.amount, 0);

  const columns: Column<Expense>[] = [
    {
      key: 'name',
      header: 'Name',
      sortValue: (r) => r.name.toLowerCase(),
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{row.name}</p>
          {row.description && <p className="truncate text-[0.7rem] text-ink-muted">{row.description}</p>}
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      width: '140px',
      sortValue: (r) => r.category,
      render: (row) => <Badge tone="gold">{row.category}</Badge>,
    },
    {
      key: 'dueDate',
      header: 'Due date',
      width: '120px',
      sortValue: (r) => r.dueDate ?? r.date,
      render: (row) => {
        const due = row.dueDate ? new Date(row.dueDate) : null;
        const overdue = due && !row.isPaid && due < new Date();
        return (
          <span className={`whitespace-nowrap text-xs ${overdue ? 'font-semibold text-danger' : 'text-ink-muted'}`}>
            {formatDate(row.dueDate ?? row.date)}
          </span>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      width: '110px',
      render: (row) => (
        <button type="button" onClick={() => togglePaid.mutate(row.id)} aria-label={`Mark ${row.name} as ${row.isPaid ? 'pending' : 'paid'}`}>
          <Badge tone={row.isPaid ? 'positive' : 'warning'} dot>
            {row.isPaid ? 'Paid' : 'Pending'}
          </Badge>
        </button>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      width: '130px',
      sortValue: (r) => r.amount,
      render: (row) => <span className="text-sm font-semibold tabular-nums text-ink">{formatCurrency(row.amount)}</span>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: '130px',
      render: (row) => (
        <div className="flex justify-end gap-1">
          <Button
            size="icon"
            variant="ghost"
            aria-label={`Roll ${row.name} into next month`}
            title="Create next month's copy"
            onClick={() => rollover.mutate(row.id)}
          >
            <CopyPlus className="h-3.5 w-3.5" />
          </Button>
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
            aria-label={`Delete ${row.name}`}
            onClick={() =>
              confirm({
                title: 'Delete recurring expense',
                message: (
                  <>
                    Delete <strong className="text-ink">{row.name}</strong>? Past months already recorded stay in the
                    ledger.
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
        title="Recurring expenses"
        subtitle="Monthly bills — rent, subscriptions, utilities, retainers."
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() =>
                downloadFile('/expenses/export', { type: 'RECURRING' }).catch((e) => toast.error('Export failed', apiError(e)))
              }
            >
              <Download className="h-4 w-4" /> Export CSV
            </Button>
            <Button
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> Add recurring
            </Button>
          </>
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <MotionCard className="p-5">
          <p className="text-[0.68rem] uppercase tracking-wider text-ink-subtle">Total recurring</p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums text-ink">{formatCurrency(monthlyTotal)}</p>
        </MotionCard>
        <MotionCard delay={0.06} className="p-5">
          <p className="text-[0.68rem] uppercase tracking-wider text-ink-subtle">Outstanding</p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums text-warning">{formatCurrency(unpaid)}</p>
        </MotionCard>
        <MotionCard delay={0.12} className="p-5">
          <p className="text-[0.68rem] uppercase tracking-wider text-ink-subtle">Active bills</p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums text-ink">{data?.meta.total ?? 0}</p>
        </MotionCard>
      </div>

      <div className="mb-4 flex flex-wrap gap-2.5">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search recurring bills…"
            className="pl-9"
            aria-label="Search recurring expenses"
          />
        </div>
        <Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-[170px]" aria-label="Filter by category">
          <option value="ALL">All categories</option>
          {categories?.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-[140px]" aria-label="Filter by status">
          <option value="ALL">Any status</option>
          <option value="PAID">Paid</option>
          <option value="PENDING">Pending</option>
        </Select>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        loading={isLoading}
        emptyTitle="No recurring expenses yet"
        emptyMessage="Add your fixed monthly bills so they're never missed."
        emptyAction={
          <Button
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Add recurring expense
          </Button>
        }
        rowClassName={(row) =>
          !row.isPaid && row.dueDate && new Date(row.dueDate) < new Date() ? 'bg-danger/[0.05]' : undefined
        }
        pagination={
          data
            ? { page: data.meta.page, totalPages: data.meta.totalPages, total: data.meta.total, onPageChange: setPage }
            : undefined
        }
      />

      <ExpenseFormModal open={modalOpen} onClose={() => setModalOpen(false)} mode="RECURRING" expense={editing} />
      {dialog}
    </div>
  );
}
