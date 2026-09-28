import { useEffect, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, apiError } from '../../lib/api';
import { formatCurrency } from '../../lib/format';
import { useToast } from '../../store/ToastProvider';
import { useFormState, nonNegativeNumber, required, validEmail } from '../../hooks/useFormState';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Field, Input, Toggle } from '../ui/Input';
import type { Employee } from '../../types';

interface Values {
  name: string;
  role: string;
  email: string;
  monthlySalary: string;
  bonus: string;
  isActive: boolean;
}

export function EmployeeFormModal({
  open,
  onClose,
  employee,
  isSpecial = false,
}: {
  open: boolean;
  onClose: () => void;
  employee?: Employee | null;
  isSpecial?: boolean;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();

  const initial = useMemo<Values>(
    () => ({
      name: employee?.name ?? '',
      role: employee?.role ?? '',
      email: employee?.email ?? '',
      monthlySalary: employee ? String(employee.monthlySalary) : '0',
      bonus: employee ? String(employee.bonus) : '0',
      isActive: employee ? employee.isActive : true,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [employee, open],
  );

  const form = useFormState<Values>(initial, (values) => ({
    name: required(values.name, 'Employee name is required'),
    role: required(values.role, 'Give this person a role'),
    email: validEmail(values.email),
    monthlySalary: nonNegativeNumber(values.monthlySalary),
    bonus: nonNegativeNumber(values.bonus),
  }));

  useEffect(() => {
    if (open) form.reset(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial]);

  const total = Number(form.values.monthlySalary || 0) + Number(form.values.bonus || 0);

  const mutation = useMutation({
    mutationFn: async (values: Values) => {
      const payload = {
        name: values.name,
        role: values.role,
        email: values.email,
        monthlySalary: Number(values.monthlySalary || 0),
        bonus: Number(values.bonus || 0),
        isSpecial: employee ? employee.isSpecial : isSpecial,
        isActive: values.isActive,
      };
      if (employee) return (await api.patch(`/employees/${employee.id}`, payload)).data;
      return (await api.post('/employees', payload)).data;
    },
    onSuccess: () => {
      toast.success(employee ? 'Employee updated' : 'Employee added');
      void queryClient.invalidateQueries({ queryKey: ['employees'] });
      onClose();
    },
    onError: (error) => toast.error('Could not save employee', apiError(error)),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={employee ? 'Edit employee' : isSpecial ? 'Add percentage-based employee' : 'Add employee'}
      description={
        isSpecial
          ? 'Paid a percentage of project value rather than a fixed monthly salary.'
          : 'Salaried staff. Their monthly cost feeds the expense ledger.'
      }
      size="md"
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
            {employee ? 'Save changes' : 'Add employee'}
          </Button>
        </>
      }
    >
      <form className="space-y-4" onSubmit={form.handleSubmit((values) => mutation.mutateAsync(values))}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" required error={form.errorFor('name')} htmlFor="e-name">
            <Input
              id="e-name"
              value={form.values.name}
              onChange={(e) => form.setField('name', e.target.value)}
              onBlur={() => form.blur('name')}
              invalid={Boolean(form.errorFor('name'))}
              autoFocus
            />
          </Field>
          <Field label="Role" required error={form.errorFor('role')} htmlFor="e-role">
            <Input
              id="e-role"
              value={form.values.role}
              onChange={(e) => form.setField('role', e.target.value)}
              onBlur={() => form.blur('role')}
              invalid={Boolean(form.errorFor('role'))}
              placeholder="Sales Representative"
            />
          </Field>
        </div>

        <Field label="Email" error={form.errorFor('email')} htmlFor="e-email">
          <Input
            id="e-email"
            type="email"
            value={form.values.email}
            onChange={(e) => form.setField('email', e.target.value)}
            onBlur={() => form.blur('email')}
            invalid={Boolean(form.errorFor('email'))}
          />
        </Field>

        {!(employee?.isSpecial ?? isSpecial) && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Monthly salary" required error={form.errorFor('monthlySalary')} htmlFor="e-salary">
                <Input
                  id="e-salary"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.values.monthlySalary}
                  onChange={(e) => form.setField('monthlySalary', e.target.value)}
                  onBlur={() => form.blur('monthlySalary')}
                  invalid={Boolean(form.errorFor('monthlySalary'))}
                />
              </Field>
              <Field label="Bonus" error={form.errorFor('bonus')} htmlFor="e-bonus">
                <Input
                  id="e-bonus"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.values.bonus}
                  onChange={(e) => form.setField('bonus', e.target.value)}
                  onBlur={() => form.blur('bonus')}
                  invalid={Boolean(form.errorFor('bonus'))}
                />
              </Field>
            </div>
            <div className="rounded-xl border border-accent/25 bg-accent/[0.07] px-4 py-3">
              <p className="text-xs text-ink-muted">Total monthly cost</p>
              <p className="mt-0.5 text-lg font-bold tabular-nums text-accent">{formatCurrency(total)}</p>
            </div>
          </>
        )}

        <div className="flex items-center justify-between rounded-xl border border-line bg-surface-elevated/50 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-ink">Active</p>
            <p className="text-xs text-ink-muted">Inactive staff are excluded from the monthly salary bill.</p>
          </div>
          <Toggle checked={form.values.isActive} onChange={(next) => form.setField('isActive', next)} label="Active" />
        </div>
      </form>
    </Modal>
  );
}
