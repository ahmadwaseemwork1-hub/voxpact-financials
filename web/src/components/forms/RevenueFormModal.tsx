import { useEffect, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, apiError } from '../../lib/api';
import { todayInput, toInputDate } from '../../lib/format';
import { useToast } from '../../store/ToastProvider';
import { useFormState, positiveNumber, required } from '../../hooks/useFormState';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Field, Input, Select, Textarea } from '../ui/Input';
import type { Revenue } from '../../types';

interface Values {
  clientName: string;
  source: string;
  description: string;
  amount: string;
  projectedDate: string;
  status: 'PROJECTED' | 'RECEIVED';
  receivedDate: string;
  receivedAmount: string;
}

export function RevenueFormModal({
  open,
  onClose,
  revenue,
}: {
  open: boolean;
  onClose: () => void;
  revenue?: Revenue | null;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();

  const initial = useMemo<Values>(
    () => ({
      clientName: revenue?.clientName ?? '',
      source: revenue?.source ?? '',
      description: revenue?.description ?? '',
      amount: revenue ? String(revenue.amount) : '',
      projectedDate: revenue ? toInputDate(revenue.projectedDate) : todayInput(),
      status: revenue?.status ?? 'PROJECTED',
      receivedDate: revenue?.receivedDate ? toInputDate(revenue.receivedDate) : todayInput(),
      receivedAmount: revenue?.receivedAmount != null ? String(revenue.receivedAmount) : '',
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [revenue, open],
  );

  const form = useFormState<Values>(initial, (values) => ({
    clientName: required(values.clientName, 'Who is this revenue from?'),
    amount: positiveNumber(values.amount),
    projectedDate: required(values.projectedDate, 'Pick the expected date'),
  }));

  useEffect(() => {
    if (open) form.reset(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial]);

  const mutation = useMutation({
    mutationFn: async (values: Values) => {
      const payload = {
        clientName: values.clientName,
        source: values.source,
        description: values.description,
        amount: Number(values.amount),
        projectedDate: new Date(values.projectedDate).toISOString(),
        status: values.status,
        receivedDate: values.status === 'RECEIVED' ? new Date(values.receivedDate).toISOString() : null,
        receivedAmount:
          values.status === 'RECEIVED' ? Number(values.receivedAmount || values.amount) : null,
      };
      if (revenue) return (await api.patch(`/revenue/${revenue.id}`, payload)).data;
      return (await api.post('/revenue', payload)).data;
    },
    onSuccess: () => {
      toast.success(revenue ? 'Revenue updated' : 'Revenue recorded');
      void queryClient.invalidateQueries({ queryKey: ['revenue'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      onClose();
    },
    onError: (error) => toast.error('Could not save revenue', apiError(error)),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={revenue ? 'Edit revenue' : 'New revenue entry'}
      description="Track what you expect to invoice and what has actually landed."
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
            {revenue ? 'Save changes' : 'Add revenue'}
          </Button>
        </>
      }
    >
      <form className="space-y-4" onSubmit={form.handleSubmit((values) => mutation.mutateAsync(values))}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Client / source" required error={form.errorFor('clientName')} htmlFor="rev-client">
            <Input
              id="rev-client"
              value={form.values.clientName}
              onChange={(e) => form.setField('clientName', e.target.value)}
              onBlur={() => form.blur('clientName')}
              invalid={Boolean(form.errorFor('clientName'))}
              placeholder="Apex Insurance Group"
              autoFocus
            />
          </Field>
          <Field label="Channel" hint="Live transfers, dispatch, video…" htmlFor="rev-source">
            <Input
              id="rev-source"
              value={form.values.source}
              onChange={(e) => form.setField('source', e.target.value)}
              placeholder="Live transfers"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Amount" required error={form.errorFor('amount')} htmlFor="rev-amount">
            <Input
              id="rev-amount"
              type="number"
              step="0.01"
              min="0"
              value={form.values.amount}
              onChange={(e) => form.setField('amount', e.target.value)}
              onBlur={() => form.blur('amount')}
              invalid={Boolean(form.errorFor('amount'))}
              placeholder="0.00"
            />
          </Field>
          <Field label="Expected date" required error={form.errorFor('projectedDate')} htmlFor="rev-date">
            <Input
              id="rev-date"
              type="date"
              value={form.values.projectedDate}
              onChange={(e) => form.setField('projectedDate', e.target.value)}
              onBlur={() => form.blur('projectedDate')}
              invalid={Boolean(form.errorFor('projectedDate'))}
            />
          </Field>
        </div>

        <Field label="Status" htmlFor="rev-status">
          <Select
            id="rev-status"
            value={form.values.status}
            onChange={(e) => form.setField('status', e.target.value as Values['status'])}
          >
            <option value="PROJECTED">Projected — not received yet</option>
            <option value="RECEIVED">Received</option>
          </Select>
        </Field>

        {form.values.status === 'RECEIVED' && (
          <div className="grid gap-4 rounded-xl border border-positive/25 bg-positive/[0.06] p-4 sm:grid-cols-2">
            <Field label="Received date" htmlFor="rev-rdate">
              <Input
                id="rev-rdate"
                type="date"
                value={form.values.receivedDate}
                onChange={(e) => form.setField('receivedDate', e.target.value)}
              />
            </Field>
            <Field label="Received amount" hint="Leave blank to use the full amount" htmlFor="rev-ramount">
              <Input
                id="rev-ramount"
                type="number"
                step="0.01"
                min="0"
                value={form.values.receivedAmount}
                onChange={(e) => form.setField('receivedAmount', e.target.value)}
                placeholder={form.values.amount || '0.00'}
              />
            </Field>
          </div>
        )}

        <Field label="Notes" htmlFor="rev-notes">
          <Textarea
            id="rev-notes"
            value={form.values.description}
            onChange={(e) => form.setField('description', e.target.value)}
            placeholder="Invoice number, payment terms, context…"
          />
        </Field>
      </form>
    </Modal>
  );
}
