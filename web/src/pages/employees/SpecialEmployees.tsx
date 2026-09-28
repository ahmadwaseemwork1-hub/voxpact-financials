import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Calculator, Pencil, Percent, Plus, Trash2, UserPlus } from 'lucide-react';
import { api, apiError } from '../../lib/api';
import { formatCurrency, formatDate, formatPercent } from '../../lib/format';
import { useToast } from '../../store/ToastProvider';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { CardBody, CardHeader, MotionCard } from '../../components/ui/Card';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Field, Input } from '../../components/ui/Input';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { EmployeeFormModal } from '../../components/forms/EmployeeFormModal';
import { SpecialProjectFormModal } from '../../components/forms/SpecialProjectFormModal';
import type { Employee, SpecialProject } from '../../types';

export default function SpecialEmployees() {
  useDocumentTitle('Percentage-based employees');
  const toast = useToast();
  const queryClient = useQueryClient();
  const { confirm, dialog } = useConfirm();

  const [employeeModal, setEmployeeModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [projectModal, setProjectModal] = useState(false);
  const [editingProject, setEditingProject] = useState<SpecialProject | null>(null);

  // Standalone calculator
  const [calcAmount, setCalcAmount] = useState('');
  const [calcPercent, setCalcPercent] = useState('10');

  const { data: employeeData, isLoading: loadingEmployees } = useQuery({
    queryKey: ['employees', 'special'],
    queryFn: async () =>
      (await api.get<{ employees: Employee[] }>('/employees', { params: { special: 'true' } })).data,
  });

  const { data: projectData, isLoading: loadingProjects } = useQuery({
    queryKey: ['special-projects'],
    queryFn: async () =>
      (
        await api.get<{
          projects: SpecialProject[];
          totals: { count: number; totalProjectValue: number; totalPayout: number; pendingPayout: number };
        }>('/employees/special/projects')
      ).data,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['special-projects'] });
    void queryClient.invalidateQueries({ queryKey: ['employees'] });
    void queryClient.invalidateQueries({ queryKey: ['expenses'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const togglePaid = useMutation({
    mutationFn: async (project: SpecialProject) =>
      api.patch(`/employees/special/projects/${project.id}`, { isPaid: !project.isPaid }),
    onSuccess: invalidate,
    onError: (error) => toast.error('Could not update', apiError(error)),
  });

  const removeProject = useMutation({
    mutationFn: async (id: string) => api.delete(`/employees/special/projects/${id}`),
    onSuccess: () => {
      toast.success('Payout removed');
      invalidate();
    },
    onError: (error) => toast.error('Could not remove', apiError(error)),
  });

  const removeEmployee = useMutation({
    mutationFn: async (id: string) => api.delete(`/employees/${id}`),
    onSuccess: () => {
      toast.success('Employee removed');
      invalidate();
    },
    onError: (error) => toast.error('Could not remove', apiError(error)),
  });

  const employees = employeeData?.employees ?? [];
  const projects = projectData?.projects ?? [];
  const totals = projectData?.totals;
  const calcResult = (Number(calcAmount || 0) * Number(calcPercent || 0)) / 100;

  const projectColumns: Column<SpecialProject>[] = [
    {
      key: 'employee',
      header: 'Employee',
      sortValue: (r) => r.employee.name.toLowerCase(),
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{row.employee.name}</p>
          <p className="truncate text-[0.7rem] text-ink-muted">{row.employee.role}</p>
        </div>
      ),
    },
    {
      key: 'projectName',
      header: 'Project',
      sortValue: (r) => r.projectName.toLowerCase(),
      render: (row) => <span className="text-sm text-ink">{row.projectName}</span>,
    },
    {
      key: 'date',
      header: 'Date',
      width: '110px',
      sortValue: (r) => r.date,
      render: (row) => <span className="whitespace-nowrap text-xs text-ink-muted">{formatDate(row.date)}</span>,
    },
    {
      key: 'totalAmount',
      header: 'Project value',
      align: 'right',
      width: '130px',
      sortValue: (r) => r.totalAmount,
      render: (row) => <span className="text-sm tabular-nums text-ink-muted">{formatCurrency(row.totalAmount)}</span>,
    },
    {
      key: 'percentage',
      header: '%',
      align: 'right',
      width: '80px',
      sortValue: (r) => r.percentage,
      render: (row) => <Badge tone="gold">{formatPercent(row.percentage, 2)}</Badge>,
    },
    {
      key: 'payoutAmount',
      header: 'Payout',
      align: 'right',
      width: '130px',
      sortValue: (r) => r.payoutAmount,
      render: (row) => <span className="text-sm font-bold tabular-nums text-accent">{formatCurrency(row.payoutAmount)}</span>,
    },
    {
      key: 'isPaid',
      header: 'Status',
      width: '110px',
      render: (row) => (
        <button type="button" onClick={() => togglePaid.mutate(row)} aria-label={`Mark payout for ${row.employee.name} as ${row.isPaid ? 'pending' : 'paid'}`}>
          <Badge tone={row.isPaid ? 'positive' : 'warning'} dot>
            {row.isPaid ? 'Paid' : 'Pending'}
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
            aria-label={`Edit payout for ${row.employee.name}`}
            onClick={() => {
              setEditingProject(row);
              setProjectModal(true);
            }}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="hover:text-danger"
            aria-label={`Delete payout for ${row.employee.name}`}
            onClick={() =>
              confirm({
                title: 'Delete payout',
                message: (
                  <>
                    Delete the {formatCurrency(row.payoutAmount)} payout for{' '}
                    <strong className="text-ink">{row.employee.name}</strong>? The linked expense entry is removed too.
                  </>
                ),
                onConfirm: () => removeProject.mutateAsync(row.id),
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
        title="Percentage-based employees"
        subtitle="Closers and contractors paid a share of each project instead of a fixed salary."
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setEditingEmployee(null);
                setEmployeeModal(true);
              }}
            >
              <UserPlus className="h-4 w-4" /> Add person
            </Button>
            <Button
              disabled={!employees.length}
              onClick={() => {
                setEditingProject(null);
                setProjectModal(true);
              }}
            >
              <Plus className="h-4 w-4" /> Record payout
            </Button>
          </>
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MotionCard className="p-5">
          <p className="text-[0.68rem] uppercase tracking-wider text-ink-subtle">People</p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums text-ink">{employees.length}</p>
        </MotionCard>
        <MotionCard delay={0.06} className="p-5">
          <p className="text-[0.68rem] uppercase tracking-wider text-ink-subtle">Projects</p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums text-ink">{totals?.count ?? 0}</p>
        </MotionCard>
        <MotionCard delay={0.12} className="p-5">
          <p className="text-[0.68rem] uppercase tracking-wider text-ink-subtle">Total payouts</p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums text-accent">{formatCurrency(totals?.totalPayout ?? 0)}</p>
        </MotionCard>
        <MotionCard delay={0.18} className="p-5">
          <p className="text-[0.68rem] uppercase tracking-wider text-ink-subtle">Pending payouts</p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums text-warning">{formatCurrency(totals?.pendingPayout ?? 0)}</p>
        </MotionCard>
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        {/* Quick calculator */}
        <MotionCard delay={0.2}>
          <CardHeader
            title="Payout calculator"
            subtitle="Scratch pad — nothing is saved"
            icon={<Calculator className="h-4 w-4" strokeWidth={1.8} />}
          />
          <CardBody className="space-y-3">
            <Field label="Project amount">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={calcAmount}
                onChange={(e) => setCalcAmount(e.target.value)}
                placeholder="0.00"
              />
            </Field>
            <Field label="Percentage">
              <Input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={calcPercent}
                onChange={(e) => setCalcPercent(e.target.value)}
              />
            </Field>
            <div className="rounded-xl border border-accent/25 bg-accent/[0.07] px-4 py-3">
              <p className="text-[0.68rem] uppercase tracking-wider text-ink-subtle">Payout</p>
              <p className="mt-0.5 text-2xl font-bold tabular-nums text-accent">{formatCurrency(calcResult)}</p>
            </div>
          </CardBody>
        </MotionCard>

        {/* People */}
        <MotionCard delay={0.26} className="lg:col-span-2">
          <CardHeader
            title="People on percentage"
            subtitle="Manage who can receive project payouts"
            icon={<Percent className="h-4 w-4" strokeWidth={1.8} />}
          />
          <div className="max-h-[320px] overflow-y-auto">
            {loadingEmployees ? (
              <p className="px-5 py-8 text-center text-xs text-ink-muted">Loading…</p>
            ) : !employees.length ? (
              <p className="px-5 py-8 text-center text-xs text-ink-muted">
                No percentage-based people yet — add one to start recording payouts.
              </p>
            ) : (
              employees.map((employee) => (
                <div
                  key={employee.id}
                  className="flex items-center gap-3 border-b border-line/60 px-5 py-3 last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{employee.name}</p>
                    <p className="truncate text-[0.7rem] text-ink-muted">{employee.role}</p>
                  </div>
                  <Badge tone={employee.isActive ? 'positive' : 'neutral'} dot>
                    {employee.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Edit ${employee.name}`}
                    onClick={() => {
                      setEditingEmployee(employee);
                      setEmployeeModal(true);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="hover:text-danger"
                    aria-label={`Remove ${employee.name}`}
                    onClick={() =>
                      confirm({
                        title: 'Remove person',
                        message: (
                          <>
                            Remove <strong className="text-ink">{employee.name}</strong>? Their recorded payouts are
                            deleted with them.
                          </>
                        ),
                        onConfirm: () => removeEmployee.mutateAsync(employee.id),
                      })
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </MotionCard>
      </div>

      <DataTable
        columns={projectColumns}
        rows={projects}
        rowKey={(row) => row.id}
        loading={loadingProjects}
        emptyTitle="No project payouts recorded"
        emptyMessage="Record a project value and percentage — the payout is calculated and posted to expenses."
        pageSize={25}
        footer={
          projects.length ? (
            <tr className="border-t border-line">
              <td colSpan={3} className="px-4 py-3 text-xs font-medium text-ink-muted">
                Totals
              </td>
              <td className="px-4 py-3 text-right text-sm tabular-nums text-ink-muted">
                {formatCurrency(totals?.totalProjectValue ?? 0)}
              </td>
              <td />
              <td className="px-4 py-3 text-right text-sm font-bold tabular-nums text-accent">
                {formatCurrency(totals?.totalPayout ?? 0)}
              </td>
              <td colSpan={2} />
            </tr>
          ) : undefined
        }
      />

      <EmployeeFormModal
        open={employeeModal}
        onClose={() => setEmployeeModal(false)}
        employee={editingEmployee}
        isSpecial
      />
      <SpecialProjectFormModal
        open={projectModal}
        onClose={() => setProjectModal(false)}
        employees={employees}
        project={editingProject}
      />
      {dialog}
    </div>
  );
}
