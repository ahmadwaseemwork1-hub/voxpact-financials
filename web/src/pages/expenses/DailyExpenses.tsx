import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Download,
  Filter,
  Paperclip,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { api, apiError, downloadFile } from '../../lib/api';
import { formatCurrency, formatDate, toInputDate } from '../../lib/format';
import { useAuth } from '../../store/AuthProvider';
import { useToast } from '../../store/ToastProvider';
import { useDebounce } from '../../hooks/useDebounce';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Card, CardBody } from '../../components/ui/Card';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Input, Select, Field } from '../../components/ui/Input';
import { ProgressBar } from '../../components/ui/Progress';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { ExpenseFormModal } from '../../components/forms/ExpenseFormModal';
import type { BudgetSnapshot, Expense, Paged } from '../../types';

const EMPTY_FILTERS = {
  search: '',
  category: 'ALL',
  status: 'ALL',
  from: '',
  to: '',
  minAmount: '',
  maxAmount: '',
};

export default function DailyExpenses() {
  useDocumentTitle('Daily expenses');
  const toast = useToast();
  const queryClient = useQueryClient();
  const { can, user } = useAuth();
  const { confirm, dialog } = useConfirm();

  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const debouncedSearch = useDebounce(filters.search, 350);

  const params = useMemo(
    () => ({
      type: 'DAILY',
      page,
      pageSize: 50,
      search: debouncedSearch || undefined,
      category: filters.category !== 'ALL' ? filters.category : undefined,
      status: filters.status !== 'ALL' ? filters.status : undefined,
      from: filters.from || undefined,
      to: filters.to || undefined,
      minAmount: filters.minAmount || undefined,
      maxAmount: filters.maxAmount || undefined,
    }),
    [page, debouncedSearch, filters],
  );

  const { data, isLoading } = useQuery({
    queryKey: ['expenses', 'daily', params],
    queryFn: async () =>
      (await api.get<Paged<Expense> & { totals: { amount: number } }>('/expenses', { params })).data,
  });

  const { data: categories } = useQuery({
    queryKey: ['expense-categories'],
    queryFn: async () => (await api.get<{ categories: string[] }>('/expenses/categories')).data.categories,
    staleTime: 300_000,
  });

  const { data: budget } = useQuery({
    queryKey: ['budget', 'today'],
    queryFn: async () => (await api.get<BudgetSnapshot>('/budget/today')).data,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/expenses/${id}`),
    onSuccess: () => {
      toast.success('Expense deleted');
      void queryClient.invalidateQueries({ queryKey: ['expenses'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['budget'] });
    },
    onError: (error) => toast.error('Could not delete', apiError(error)),
  });

  const togglePaid = useMutation({
    mutationFn: async (id: string) => api.post(`/expenses/${id}/toggle-paid`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['expenses'] }),
    onError: (error) => toast.error('Could not update', apiError(error)),
  });

  const canEdit = (expense: Expense) =>
    user?.role !== 'USER' || (expense.addedBy?.id === user.id && !expense.sourceType);

  const todayKey = toInputDate(new Date());
  const overBudget = budget && budget.budgetAmount > 0 && budget.spentAmount > budget.budgetAmount;

  const columns: Column<Expense>[] = [
    {
      key: 'date',
      header: 'Date',
      width: '110px',
      sortValue: (row) => row.date,
      render: (row) => <span className="whitespace-nowrap text-xs text-ink-muted">{formatDate(row.date)}</span>,
    },
    {
      key: 'name',
      header: 'Description',
      sortValue: (row) => row.name.toLowerCase(),
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{row.name}</p>
          {row.description && <p className="truncate text-[0.7rem] text-ink-muted">{row.description}</p>}
          {row.sourceType && (
            <Badge tone="info" className="mt-1">
              auto · {row.sourceType.replace('_', ' ').toLowerCase()}
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      width: '130px',
      sortValue: (row) => row.category,
      render: (row) => <Badge tone="gold">{row.category}</Badge>,
    },
    {
      key: 'paymentMethod',
      header: 'Method',
      width: '130px',
      render: (row) => <span className="text-xs text-ink-muted">{row.paymentMethod || '—'}</span>,
    },
    {
      key: 'receipt',
      header: 'Receipt',
      width: '80px',
      align: 'center',
      render: (row) =>
        row.receiptUrl ? (
          <a
            href={row.receiptUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
            aria-label={`View receipt for ${row.name}`}
          >
            <Paperclip className="h-3.5 w-3.5" />
          </a>
        ) : (
          <span className="text-xs text-ink-subtle">—</span>
        ),
    },
    {
      key: 'addedBy',
      header: 'Added by',
      width: '120px',
      render: (row) => <span className="text-xs text-ink-muted">{row.addedBy?.username ?? 'system'}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      width: '100px',
      render: (row) => (
        <button
          type="button"
          onClick={() => togglePaid.mutate(row.id)}
          disabled={!canEdit(row)}
          className="disabled:cursor-not-allowed disabled:opacity-60"
          aria-label={`Mark ${row.name} as ${row.isPaid ? 'pending' : 'paid'}`}
        >
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
      width: '120px',
      sortValue: (row) => row.amount,
      render: (row) => (
        <span className="whitespace-nowrap text-sm font-semibold tabular-nums text-ink">{formatCurrency(row.amount)}</span>
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
            disabled={!canEdit(row)}
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
            aria-label={`Delete ${row.name}`}
            disabled={!canEdit(row)}
            onClick={() =>
              confirm({
                title: 'Delete expense',
                message: (
                  <>
                    Delete <strong className="text-ink">{row.name}</strong> ({formatCurrency(row.amount)})? This is
                    recorded in the audit log and cannot be undone.
                  </>
                ),
                onConfirm: () => deleteMutation.mutateAsync(row.id),
              })
            }
            className="hover:text-danger"
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
        title="Daily expenses"
        subtitle="Every day-to-day cost, with receipts and an audit trail."
        actions={
          <>
            <Button variant="secondary" onClick={() => setShowFilters((s) => !s)}>
              <Filter className="h-4 w-4" /> Filters
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                downloadFile('/expenses/export', { ...params, page: undefined, pageSize: undefined }).catch((e) =>
                  toast.error('Export failed', apiError(e)),
                )
              }
            >
              <Download className="h-4 w-4" /> Export CSV
            </Button>
            {can('manage:expenses') && (
              <Button
                onClick={() => {
                  setEditing(null);
                  setModalOpen(true);
                }}
              >
                <Plus className="h-4 w-4" /> Add expense
              </Button>
            )}
          </>
        }
      />

      {/* Budget strip */}
      {budget && budget.budgetAmount > 0 && (
        <Card className={`mb-4 ${overBudget ? 'border-danger/40' : ''}`}>
          <CardBody className="flex flex-wrap items-center gap-5 py-4">
            <div className="min-w-[180px] flex-1">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-medium text-ink-muted">Today's budget</p>
                <p className="text-xs tabular-nums text-ink-muted">
                  <span className={overBudget ? 'font-semibold text-danger' : 'font-semibold text-ink'}>
                    {formatCurrency(budget.spentAmount)}
                  </span>{' '}
                  / {formatCurrency(budget.budgetAmount)}
                </p>
              </div>
              <ProgressBar value={budget.percentUsed} className="mt-2" />
            </div>
            <div className="text-right">
              <p className="text-[0.68rem] uppercase tracking-wider text-ink-subtle">Remaining</p>
              <p className={`text-lg font-bold tabular-nums ${budget.remaining < 0 ? 'text-danger' : 'text-ink'}`}>
                {formatCurrency(budget.remaining)}
              </p>
            </div>
            {overBudget && (
              <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/[0.08] px-3 py-2">
                <AlertTriangle className="h-4 w-4 text-danger" />
                <p className="text-xs text-danger">Over budget by {formatCurrency(Math.abs(budget.remaining))}</p>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
          <Input
            value={filters.search}
            onChange={(e) => {
              setFilters((f) => ({ ...f, search: e.target.value }));
              setPage(1);
            }}
            placeholder="Search description, notes or category…"
            className="pl-9"
            aria-label="Search expenses"
          />
        </div>
        <Select
          value={filters.category}
          onChange={(e) => {
            setFilters((f) => ({ ...f, category: e.target.value }));
            setPage(1);
          }}
          className="w-[170px]"
          aria-label="Filter by category"
        >
          <option value="ALL">All categories</option>
          {categories?.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <Select
          value={filters.status}
          onChange={(e) => {
            setFilters((f) => ({ ...f, status: e.target.value }));
            setPage(1);
          }}
          className="w-[140px]"
          aria-label="Filter by status"
        >
          <option value="ALL">Any status</option>
          <option value="PAID">Paid</option>
          <option value="PENDING">Pending</option>
        </Select>
      </div>

      {showFilters && (
        <Card className="mb-4">
          <CardBody className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Field label="From">
              <Input type="date" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} />
            </Field>
            <Field label="To">
              <Input type="date" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} />
            </Field>
            <Field label="Min amount">
              <Input
                type="number"
                min="0"
                value={filters.minAmount}
                onChange={(e) => setFilters((f) => ({ ...f, minAmount: e.target.value }))}
                placeholder="0"
              />
            </Field>
            <Field label="Max amount">
              <Input
                type="number"
                min="0"
                value={filters.maxAmount}
                onChange={(e) => setFilters((f) => ({ ...f, maxAmount: e.target.value }))}
                placeholder="Any"
              />
            </Field>
            <div className="flex items-end">
              <Button variant="secondary" fullWidth onClick={() => setFilters(EMPTY_FILTERS)}>
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        rowKey={(row) => row.id}
        loading={isLoading}
        emptyTitle="No expenses match these filters"
        emptyMessage="Adjust the filters above, or record your first expense for this period."
        rowClassName={(row) =>
          toInputDate(row.date) === todayKey && overBudget ? 'bg-danger/[0.06] hover:bg-danger/[0.1]' : undefined
        }
        pagination={
          data
            ? {
                page: data.meta.page,
                totalPages: data.meta.totalPages,
                total: data.meta.total,
                onPageChange: setPage,
              }
            : undefined
        }
        footer={
          data ? (
            <tr className="border-t border-line">
              <td colSpan={columns.length - 2} className="px-4 py-3 text-xs font-medium text-ink-muted">
                Total for current filters
              </td>
              <td className="px-4 py-3 text-right text-sm font-bold tabular-nums text-accent">
                {formatCurrency(data.totals.amount)}
              </td>
              <td />
            </tr>
          ) : undefined
        }
      />

      <ExpenseFormModal open={modalOpen} onClose={() => setModalOpen(false)} mode="DAILY" expense={editing} />
      {dialog}
    </div>
  );
}
