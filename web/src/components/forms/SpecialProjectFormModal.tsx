import { useEffect, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Calculator } from 'lucide-react';
import { api, apiError } from '../../lib/api';
import { formatCurrency, todayInput, toInputDate } from '../../lib/format';
import { useToast } from '../../store/ToastProvider';
import { useFormState, positiveNumber, required } from '../../hooks/useFormState';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Field, Input, Select, Toggle } from '../ui/Input';
import type { Employee, SpecialProject } from '../../types';

interface Values {
  employeeId: string;
  projectName: string;
  totalAmount: string;
  percentage: string;
  date: string;
  isPaid: boolean;
  addToExpenses: boolean;
}

export function SpecialProjectFormModal({
  open,
  onClose,
  employees,
  project,
}: {
  open: boolean;
  onClose: () => void;
  employees: Employee[];
  project?: SpecialProject | null;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();

  const initial = useMemo<Values>(
    () => ({
      employeeId: project?.employeeId ?? employees[0]?.id ?? '',
      projectName: project?.projectName ?? '',
      totalAmount: project ? String(project.totalAmount) : '',
      percentage: project ? String(project.percentage) : '10',
      date: project ? toInputDate(project.date) : todayInput(),
      isPaid: project?.isPaid ?? false,
      addToExpenses: true,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [project, open, employees],
  );

  const form = useFormState<Values>(initial, (values) => ({
    employeeId: required(values.employeeId, 'Select an employee'),
    projectName: required(values.projectName, 'Name the project'),
    totalAmount: positiveNumber(values.totalAmount, 'Enter the total project amount'),
    percentage:
      !Number.isFinite(Number(values.percentage)) || Number(values.percentage) <= 0 || Number(values.percentage) > 100
        ? 'Percentage must be between 0 and 100'
        : undefined,
    date: required(values.date, 'Pick a date'),
  }));

  useEffect(() => {
    if (open) form.reset(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial]);

  const payout = (Number(form.values.totalAmount || 0) * Number(form.values.percentage || 0)) / 100;

  const mutation = useMutation({
    mutationFn: async (values: Values) => {
      const payload = {
        employeeId: values.employeeId,
        projectName: values.projectName,
        totalAmount: Number(values.totalAmount),
        percentage: Number(values.percentage),
        date: new Date(values.date).toISOString(),
        isPaid: values.isPaid,
        addToExpenses: values.addToExpenses,
      };
      if (project) return (await api.patch(`/employees/special/projects/${project.id}`, payload)).data;
      return (await api.post('/employees/special/projects', payload)).data;
    },
    onSuccess: () => {
      toast.success(project ? 'Payout updated' : 'Payout recorded');
      void queryClient.invalidateQueries({ queryKey: ['special-projects'] });
      void queryClient.invalidateQueries({ queryKey: ['expenses'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      onClose();
    },
    onError: (error) => toast.error('Could not save payout', apiError(error)),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={project ? 'Edit payout' : 'New project payout'}
      description="Enter the project value and the agreed percentage — the payout is calculated for you."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={form.handleSubmit((values) => mutation.mutateAsync(values))}
            loading={mutation.isPending}
            disabled={!form.isValid}
          >
            {project ? 'Save changes' : 'Record payout'}
          </Button>
        </>
      }
    >
      <form className="space-y-4" onSubmit={form.handleSubmit((values) => mutation.mutateAsync(values))}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Employee" required error={form.errorFor('employeeId')} htmlFor="sp-emp">
            <Select
              id="sp-emp"
              value={form.values.employeeId}
              onChange={(e) => form.setField('employeeId', e.target.value)}
              onBlur={() => form.blur('employeeId')}
              invalid={Boolean(form.errorFor('employeeId'))}
            >
              <option value="">Select…</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} — {e.role}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Project" required error={form.errorFor('projectName')} htmlFor="sp-name">
            <Input
              id="sp-name"
              value={form.values.projectName}
              onChange={(e) => form.setField('projectName', e.target.value)}
              onBlur={() => form.blur('projectName')}
              invalid={Boolean(form.errorFor('projectName'))}
              placeholder="Q3 campaign — Apex"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Total project amount" required error={form.errorFor('totalAmount')} htmlFor="sp-total">
            <Input
              id="sp-total"
              type="number"
              step="0.01"
              min="0"
              value={form.values.totalAmount}
              onChange={(e) => form.setField('totalAmount', e.target.value)}
              onBlur={() => form.blur('totalAmount')}
              invalid={Boolean(form.errorFor('totalAmount'))}
            />
          </Field>
          <Field label="Percentage" required error={form.errorFor('percentage')} htmlFor="sp-pct">
            <Input
              id="sp-pct"
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={form.values.percentage}
              onChange={(e) => form.setField('percentage', e.target.value)}
              onBlur={() => form.blur('percentage')}
              invalid={Boolean(form.errorFor('percentage'))}
            />
          </Field>
          <Field label="Date" required error={form.errorFor('date')} htmlFor="sp-date">
            <Input
              id="sp-date"
              type="date"
              value={form.values.date}
              onChange={(e) => form.setField('date', e.target.value)}
              onBlur={() => form.blur('date')}
              invalid={Boolean(form.errorFor('date'))}
            />
          </Field>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-accent/25 bg-accent/[0.07] px-4 py-3.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15 text-accent">
            <Calculator className="h-4.5 w-4.5" strokeWidth={1.8} />
          </span>
          <div>
            <p className="text-xs text-ink-muted">Calculated payout</p>
            <p className="text-xl font-bold tabular-nums text-accent">{formatCurrency(payout)}</p>
          </div>
        </div>

        <div className="space-y-2.5">
          <div className="flex items-center justify-between rounded-xl border border-line bg-surface-elevated/50 px-4 py-3">
            <p className="text-sm text-ink">Already paid out</p>
            <Toggle checked={form.values.isPaid} onChange={(n) => form.setField('isPaid', n)} label="Paid" />
          </div>
          {!project && (
            <div className="flex items-center justify-between rounded-xl border border-line bg-surface-elevated/50 px-4 py-3">
              <div>
                <p className="text-sm text-ink">Add to expenses</p>
                <p className="text-xs text-ink-muted">Creates a matching Salary-category expense entry.</p>
              </div>
              <Toggle
                checked={form.values.addToExpenses}
                onChange={(n) => form.setField('addToExpenses', n)}
                label="Add to expenses"
              />
            </div>
          )}
        </div>
      </form>
    </Modal>
  );
}
