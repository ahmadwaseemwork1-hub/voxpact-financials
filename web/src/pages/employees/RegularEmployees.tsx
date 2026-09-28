import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Pencil, Plus, Search, Trash2, Upload, Users } from 'lucide-react';
import { api, apiError, downloadFile } from '../../lib/api';
import { formatCurrency } from '../../lib/format';
import { useToast } from '../../store/ToastProvider';
import { useDebounce } from '../../hooks/useDebounce';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { MotionCard } from '../../components/ui/Card';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Input, Select, Toggle } from '../../components/ui/Input';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { EmployeeFormModal } from '../../components/forms/EmployeeFormModal';
import type { Employee } from '../../types';

interface EmployeeResponse {
  employees: Employee[];
  totals: {
    headcount: number;
    activeHeadcount: number;
    monthlySalary: number;
    monthlyBonus: number;
    monthlyCost: number;
  };
}

export default function RegularEmployees() {
  useDocumentTitle('Employees');
  const toast = useToast();
  const queryClient = useQueryClient();
  const { confirm, dialog } = useConfirm();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [selected, setSelected] = useState<string[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const debounced = useDebounce(search, 300);

  const params = useMemo(
    () => ({ special: 'false', status: status !== 'ALL' ? status : undefined, search: debounced || undefined }),
    [status, debounced],
  );

  const { data, isLoading } = useQuery({
    queryKey: ['employees', 'regular', params],
    queryFn: async () => (await api.get<EmployeeResponse>('/employees', { params })).data,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['employees'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const toggleActive = useMutation({
    mutationFn: async (employee: Employee) =>
      api.patch(`/employees/${employee.id}`, { isActive: !employee.isActive }),
    onSuccess: invalidate,
    onError: (error) => toast.error('Could not update', apiError(error)),
  });

  const bulkStatus = useMutation({
    mutationFn: async (isActive: boolean) => api.post('/employees/bulk-status', { ids: selected, isActive }),
    onSuccess: (_, isActive) => {
      toast.success(`${selected.length} employee${selected.length === 1 ? '' : 's'} ${isActive ? 'activated' : 'deactivated'}`);
      setSelected([]);
      invalidate();
    },
    onError: (error) => toast.error('Bulk update failed', apiError(error)),
  });

  const postSalaries = useMutation({
    mutationFn: async () => (await api.post('/employees/post-salaries')).data,
    onSuccess: (result: { total: number; headcount: number; updated: boolean }) => {
      toast.success(
        result.updated ? 'Salary run updated' : 'Salary run posted to expenses',
        `${formatCurrency(result.total)} across ${result.headcount} employees`,
      );
      void queryClient.invalidateQueries({ queryKey: ['expenses'] });
      invalidate();
    },
    onError: (error) => toast.error('Could not post salaries', apiError(error)),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/employees/${id}`),
    onSuccess: () => {
      toast.success('Employee removed');
      invalidate();
    },
    onError: (error) => toast.error('Could not remove', apiError(error)),
  });

  const rows = data?.employees ?? [];
  const totals = data?.totals;
  const allSelected = rows.length > 0 && selected.length === rows.length;

  const columns: Column<Employee>[] = [
    {
      key: 'select',
      header: (
        <input
          type="checkbox"
          checked={allSelected}
          onChange={(e) => setSelected(e.target.checked ? rows.map((r) => r.id) : [])}
          aria-label="Select all employees"
          className="h-3.5 w-3.5 cursor-pointer accent-[#c9a962]"
        />
      ),
      width: '44px',
      render: (row) => (
        <input
          type="checkbox"
          checked={selected.includes(row.id)}
          onChange={(e) =>
            setSelected((list) => (e.target.checked ? [...list, row.id] : list.filter((id) => id !== row.id)))
          }
          aria-label={`Select ${row.name}`}
          className="h-3.5 w-3.5 cursor-pointer accent-[#c9a962]"
        />
      ),
    },
    {
      key: 'name',
      header: 'Name',
      sortValue: (r) => r.name.toLowerCase(),
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{row.name}</p>
          {row.email && <p className="truncate text-[0.7rem] text-ink-muted">{row.email}</p>}
        </div>
      ),
    },
    { key: 'role', header: 'Role', sortValue: (r) => r.role, render: (row) => <Badge tone="info">{row.role}</Badge> },
    {
      key: 'monthlySalary',
      header: 'Salary',
      align: 'right',
      width: '120px',
      sortValue: (r) => r.monthlySalary,
      render: (row) => <span className="text-sm tabular-nums text-ink-muted">{formatCurrency(row.monthlySalary)}</span>,
    },
    {
      key: 'bonus',
      header: 'Bonus',
      align: 'right',
      width: '110px',
      sortValue: (r) => r.bonus,
      render: (row) =>
        row.bonus > 0 ? (
          <span className="text-sm tabular-nums text-positive">{formatCurrency(row.bonus)}</span>
        ) : (
          <span className="text-xs text-ink-subtle">—</span>
        ),
    },
    {
      key: 'total',
      header: 'Monthly cost',
      align: 'right',
      width: '140px',
      sortValue: (r) => r.totalMonthlyCost,
      render: (row) => (
        <span className="text-sm font-semibold tabular-nums text-ink">{formatCurrency(row.totalMonthlyCost)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '110px',
      render: (row) => (
        <div className="flex items-center gap-2">
          <Toggle checked={row.isActive} onChange={() => toggleActive.mutate(row)} size="sm" label={`${row.name} active`} />
          <span className={`text-[0.7rem] ${row.isActive ? 'text-positive' : 'text-ink-subtle'}`}>
            {row.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
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
                title: 'Remove employee',
                message: (
                  <>
                    Remove <strong className="text-ink">{row.name}</strong> from the payroll? Past salary runs already
                    posted stay in the ledger.
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
        title="Employees"
        subtitle="Salaried staff. Active headcount drives the monthly salary bill."
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => downloadFile('/employees/export').catch((e) => toast.error('Export failed', apiError(e)))}
            >
              <Download className="h-4 w-4" /> Export CSV
            </Button>
            <Button variant="outline" onClick={() => postSalaries.mutate()} loading={postSalaries.isPending}>
              <Upload className="h-4 w-4" /> Post salary run
            </Button>
            <Button
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> Add employee
            </Button>
          </>
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MotionCard className="p-5">
          <p className="text-[0.68rem] uppercase tracking-wider text-ink-subtle">Headcount</p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums text-ink">{totals?.headcount ?? 0}</p>
        </MotionCard>
        <MotionCard delay={0.06} className="p-5">
          <p className="text-[0.68rem] uppercase tracking-wider text-ink-subtle">Active</p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums text-positive">{totals?.activeHeadcount ?? 0}</p>
        </MotionCard>
        <MotionCard delay={0.12} className="p-5">
          <p className="text-[0.68rem] uppercase tracking-wider text-ink-subtle">Base salaries</p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums text-ink">{formatCurrency(totals?.monthlySalary ?? 0)}</p>
        </MotionCard>
        <MotionCard delay={0.18} className="p-5">
          <p className="text-[0.68rem] uppercase tracking-wider text-ink-subtle">Total monthly cost</p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums text-accent">{formatCurrency(totals?.monthlyCost ?? 0)}</p>
        </MotionCard>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or role…"
            className="pl-9"
            aria-label="Search employees"
          />
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-[150px]" aria-label="Filter by status">
          <option value="ALL">All staff</option>
          <option value="ACTIVE">Active only</option>
          <option value="INACTIVE">Inactive only</option>
        </Select>

        {selected.length > 0 && (
          <div className="flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/[0.07] px-3 py-1.5">
            <Users className="h-3.5 w-3.5 text-accent" />
            <span className="text-xs text-ink-muted">{selected.length} selected</span>
            <Button size="sm" variant="ghost" onClick={() => bulkStatus.mutate(true)}>
              Activate
            </Button>
            <Button size="sm" variant="ghost" onClick={() => bulkStatus.mutate(false)}>
              Deactivate
            </Button>
          </div>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        loading={isLoading}
        emptyTitle="No employees yet"
        emptyMessage="Add your team so payroll flows into the expense ledger automatically."
        rowClassName={(row) => (row.isActive ? undefined : 'opacity-55')}
        pageSize={25}
      />

      <EmployeeFormModal open={modalOpen} onClose={() => setModalOpen(false)} employee={editing} />
      {dialog}
    </div>
  );
}
