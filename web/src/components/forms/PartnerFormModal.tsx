import { useEffect, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, apiError } from '../../lib/api';
import { useToast } from '../../store/ToastProvider';
import { useFormState, required, validEmail } from '../../hooks/useFormState';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Field, Input, Textarea } from '../ui/Input';
import type { Partner } from '../../types';

interface Values {
  name: string;
  email: string;
  percentage: string;
  notes: string;
}

export function PartnerFormModal({
  open,
  onClose,
  partner,
  availablePercentage,
}: {
  open: boolean;
  onClose: () => void;
  partner?: Partner | null;
  availablePercentage: number;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();

  const initial = useMemo<Values>(
    () => ({
      name: partner?.name ?? '',
      email: partner?.email ?? '',
      percentage: partner ? String(partner.percentage) : '',
      notes: partner?.notes ?? '',
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [partner, open],
  );

  const cap = availablePercentage + (partner?.percentage ?? 0);

  const form = useFormState<Values>(initial, (values) => ({
    name: required(values.name, 'Partner name is required'),
    email: validEmail(values.email),
    percentage:
      !Number.isFinite(Number(values.percentage)) || Number(values.percentage) <= 0
        ? 'Enter a percentage greater than zero'
        : Number(values.percentage) > cap + 0.001
          ? `Only ${cap.toFixed(2)}% is unallocated`
          : undefined,
  }));

  useEffect(() => {
    if (open) form.reset(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial]);

  const mutation = useMutation({
    mutationFn: async (values: Values) => {
      const payload = {
        name: values.name,
        email: values.email,
        percentage: Number(values.percentage),
        notes: values.notes,
      };
      if (partner) return (await api.patch(`/partners/${partner.id}`, payload)).data;
      return (await api.post('/partners', payload)).data;
    },
    onSuccess: () => {
      toast.success(partner ? 'Partner updated' : 'Partner added');
      void queryClient.invalidateQueries({ queryKey: ['partners'] });
      onClose();
    },
    onError: (error) => toast.error('Could not save partner', apiError(error)),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={partner ? 'Edit partner' : 'Add partner'}
      description={`${cap.toFixed(2)}% of ownership is available to assign.`}
      size="sm"
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
            {partner ? 'Save changes' : 'Add partner'}
          </Button>
        </>
      }
    >
      <form className="space-y-4" onSubmit={form.handleSubmit((values) => mutation.mutateAsync(values))}>
        <Field label="Full name" required error={form.errorFor('name')} htmlFor="p-name">
          <Input
            id="p-name"
            value={form.values.name}
            onChange={(e) => form.setField('name', e.target.value)}
            onBlur={() => form.blur('name')}
            invalid={Boolean(form.errorFor('name'))}
            autoFocus
          />
        </Field>
        <Field label="Email" error={form.errorFor('email')} htmlFor="p-email">
          <Input
            id="p-email"
            type="email"
            value={form.values.email}
            onChange={(e) => form.setField('email', e.target.value)}
            onBlur={() => form.blur('email')}
            invalid={Boolean(form.errorFor('email'))}
          />
        </Field>
        <Field label="Ownership %" required error={form.errorFor('percentage')} htmlFor="p-pct">
          <Input
            id="p-pct"
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
        <Field label="Notes" htmlFor="p-notes">
          <Textarea id="p-notes" value={form.values.notes} onChange={(e) => form.setField('notes', e.target.value)} />
        </Field>
      </form>
    </Modal>
  );
}
