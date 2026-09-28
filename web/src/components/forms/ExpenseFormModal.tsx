import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Paperclip, Trash2 } from 'lucide-react';
import { api, apiError } from '../../lib/api';
import { todayInput, toInputDate } from '../../lib/format';
import { useToast } from '../../store/ToastProvider';
import { useFormState, positiveNumber, required } from '../../hooks/useFormState';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Field, Input, Select, Textarea, Toggle } from '../ui/Input';
import type { Expense, Settings } from '../../types';

interface Values {
  name: string;
  description: string;
  category: string;
  amount: string;
  date: string;
  dueDate: string;
  paymentMethod: string;
  isPaid: boolean;
}

export function ExpenseFormModal({
  open,
  onClose,
  mode,
  expense,
}: {
  open: boolean;
  onClose: () => void;
  mode: 'DAILY' | 'RECURRING';
  expense?: Expense | null;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [receipt, setReceipt] = useState<File | null>(null);
  const [removeReceipt, setRemoveReceipt] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => (await api.get<{ settings: Settings }>('/settings')).data.settings,
    staleTime: 300_000,
  });

  const categories = settings?.categories ?? ['Operations', 'Marketing', 'Salary', 'Utilities'];
  const methods = settings?.paymentMethods ?? ['Cash', 'Bank Transfer', 'Credit Card'];

  const initial = useMemo<Values>(
    () => ({
      name: expense?.name ?? '',
      description: expense?.description ?? '',
      category: expense?.category ?? categories[0] ?? '',
      amount: expense ? String(expense.amount) : '',
      date: expense ? toInputDate(expense.date) : todayInput(),
      dueDate: expense?.dueDate ? toInputDate(expense.dueDate) : '',
      paymentMethod: expense?.paymentMethod ?? '',
      isPaid: expense ? expense.isPaid : mode === 'DAILY',
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [expense, open, settings],
  );

  const form = useFormState<Values>(initial, (values) => ({
    name: required(values.name, mode === 'RECURRING' ? 'Give this bill a name' : 'Describe the expense'),
    category: required(values.category, 'Pick a category'),
    amount: positiveNumber(values.amount),
    date: required(values.date, 'Pick a date'),
  }));

  useEffect(() => {
    if (open) {
      form.reset(initial);
      setReceipt(null);
      setRemoveReceipt(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial]);

  const mutation = useMutation({
    mutationFn: async (values: Values) => {
      const payload = new FormData();
      payload.append('type', mode);
      payload.append('name', values.name);
      payload.append('description', values.description);
      payload.append('category', values.category);
      payload.append('amount', values.amount);
      payload.append('date', new Date(values.date).toISOString());
      if (values.dueDate) payload.append('dueDate', new Date(values.dueDate).toISOString());
      payload.append('paymentMethod', values.paymentMethod);
      payload.append('isPaid', String(values.isPaid));
      payload.append('isRecurring', String(mode === 'RECURRING'));
      if (receipt) payload.append('receipt', receipt);
      if (removeReceipt) payload.append('removeReceipt', 'true');

      if (expense) return (await api.patch(`/expenses/${expense.id}`, payload)).data;
      return (await api.post('/expenses', payload)).data;
    },
    onSuccess: () => {
      toast.success(expense ? 'Expense updated' : 'Expense recorded');
      void queryClient.invalidateQueries({ queryKey: ['expenses'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['budget'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      onClose();
    },
    onError: (error) => toast.error('Could not save expense', apiError(error)),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={expense ? 'Edit expense' : mode === 'RECURRING' ? 'New recurring expense' : 'New expense'}
      description={
        mode === 'RECURRING'
          ? 'Monthly bills that repeat — rent, subscriptions, utilities.'
          : 'One-off spending recorded against today’s budget.'
      }
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
            {expense ? 'Save changes' : 'Add expense'}
          </Button>
        </>
      }
    >
      <form className="space-y-4" onSubmit={form.handleSubmit((values) => mutation.mutateAsync(values))}>
        <Field label={mode === 'RECURRING' ? 'Bill name' : 'Description'} required error={form.errorFor('name')} htmlFor="exp-name">
          <Input
            id="exp-name"
            value={form.values.name}
            onChange={(e) => form.setField('name', e.target.value)}
            onBlur={() => form.blur('name')}
            invalid={Boolean(form.errorFor('name'))}
            placeholder={mode === 'RECURRING' ? 'Office rent' : 'Lead data purchase'}
            autoFocus
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category" required error={form.errorFor('category')} htmlFor="exp-cat">
            <Select
              id="exp-cat"
              value={form.values.category}
              onChange={(e) => form.setField('category', e.target.value)}
              onBlur={() => form.blur('category')}
              invalid={Boolean(form.errorFor('category'))}
            >
              <option value="">Select a category…</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Amount" required error={form.errorFor('amount')} htmlFor="exp-amount">
            <Input
              id="exp-amount"
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
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={mode === 'RECURRING' ? 'Billing month' : 'Date'} required error={form.errorFor('date')} htmlFor="exp-date">
            <Input
              id="exp-date"
              type="date"
              value={form.values.date}
              onChange={(e) => form.setField('date', e.target.value)}
              onBlur={() => form.blur('date')}
              invalid={Boolean(form.errorFor('date'))}
            />
          </Field>

          {mode === 'RECURRING' ? (
            <Field label="Due date" htmlFor="exp-due">
              <Input id="exp-due" type="date" value={form.values.dueDate} onChange={(e) => form.setField('dueDate', e.target.value)} />
            </Field>
          ) : (
            <Field label="Payment method" htmlFor="exp-method">
              <Select id="exp-method" value={form.values.paymentMethod} onChange={(e) => form.setField('paymentMethod', e.target.value)}>
                <option value="">Not specified</option>
                {methods.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>

        <Field label="Notes" htmlFor="exp-notes">
          <Textarea
            id="exp-notes"
            value={form.values.description}
            onChange={(e) => form.setField('description', e.target.value)}
            placeholder="Optional context for this entry"
          />
        </Field>

        <div className="flex items-center justify-between rounded-xl border border-line bg-surface-elevated/50 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-ink">Marked as paid</p>
            <p className="text-xs text-ink-muted">Unpaid entries appear in the pending bills list.</p>
          </div>
          <Toggle checked={form.values.isPaid} onChange={(next) => form.setField('isPaid', next)} label="Paid" />
        </div>

        {mode === 'DAILY' && (
          <Field label="Receipt" hint="PNG, JPG, WEBP or PDF · max 10 MB">
            <div className="flex flex-wrap items-center gap-2.5">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-surface-elevated/60 px-3.5 py-2 text-xs text-ink-muted transition-colors hover:border-accent/50 hover:text-ink">
                <Paperclip className="h-3.5 w-3.5" />
                {receipt ? receipt.name.slice(0, 28) : 'Attach receipt'}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    setReceipt(e.target.files?.[0] ?? null);
                    setRemoveReceipt(false);
                  }}
                />
              </label>
              {expense?.receiptUrl && !removeReceipt && !receipt && (
                <>
                  <a
                    href={expense.receiptUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-accent underline-offset-2 hover:underline"
                  >
                    View current receipt
                  </a>
                  <button
                    type="button"
                    onClick={() => setRemoveReceipt(true)}
                    className="inline-flex items-center gap-1 text-xs text-danger hover:underline"
                  >
                    <Trash2 className="h-3 w-3" /> Remove
                  </button>
                </>
              )}
              {removeReceipt && <span className="text-xs text-danger">Receipt will be removed on save</span>}
            </div>
          </Field>
        )}
      </form>
    </Modal>
  );
}
