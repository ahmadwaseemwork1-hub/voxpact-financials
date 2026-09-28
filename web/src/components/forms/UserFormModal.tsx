import { useEffect, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, X } from 'lucide-react';
import { api, apiError } from '../../lib/api';
import { useToast } from '../../store/ToastProvider';
import { useAuth } from '../../store/AuthProvider';
import { useFormState, passwordChecks, passwordIsStrong, required, validEmail } from '../../hooks/useFormState';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Field, Input, Select, Toggle } from '../ui/Input';
import type { Role, User } from '../../types';

interface Values {
  username: string;
  password: string;
  role: Role;
  email: string;
  fullName: string;
  mustChangePassword: boolean;
  isActive: boolean;
}

export function PasswordStrength({ password }: { password: string }) {
  const checks = passwordChecks(password);
  return (
    <ul className="mt-2 grid gap-1 sm:grid-cols-2">
      {checks.map((check) => (
        <li
          key={check.label}
          className={`flex items-center gap-1.5 text-[0.7rem] ${check.passed ? 'text-positive' : 'text-ink-subtle'}`}
        >
          {check.passed ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
          {check.label}
        </li>
      ))}
    </ul>
  );
}

export function UserFormModal({
  open,
  onClose,
  user,
  assignableRoles,
}: {
  open: boolean;
  onClose: () => void;
  user?: User | null;
  assignableRoles: Role[];
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { isHost } = useAuth();

  const initial = useMemo<Values>(
    () => ({
      username: user?.username ?? '',
      password: '',
      role: user?.role ?? (assignableRoles[0] ?? 'USER'),
      email: user?.email ?? '',
      fullName: user?.fullName ?? '',
      mustChangePassword: user ? Boolean(user.mustChangePassword) : true,
      isActive: user ? Boolean(user.isActive) : true,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, open, assignableRoles],
  );

  const form = useFormState<Values>(initial, (values) => ({
    username: user
      ? undefined
      : required(values.username, 'Username is required') ??
        (!/^[a-zA-Z0-9._-]{3,32}$/.test(values.username)
          ? '3–32 characters: letters, numbers, dot, underscore, hyphen'
          : undefined),
    password: user ? undefined : passwordIsStrong(values.password) ? undefined : 'Password does not meet the policy',
    email: validEmail(values.email),
  }));

  useEffect(() => {
    if (open) form.reset(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial]);

  const mutation = useMutation({
    mutationFn: async (values: Values) => {
      if (user) {
        return (
          await api.patch(`/users/${user.id}`, {
            role: values.role,
            email: values.email,
            fullName: values.fullName,
            isActive: values.isActive,
            mustChangePassword: values.mustChangePassword,
          })
        ).data;
      }
      return (
        await api.post('/users', {
          username: values.username,
          password: values.password,
          role: values.role,
          email: values.email,
          fullName: values.fullName,
          mustChangePassword: values.mustChangePassword,
        })
      ).data;
    },
    onSuccess: () => {
      toast.success(user ? 'User updated' : 'User created');
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      onClose();
    },
    onError: (error) => toast.error('Could not save user', apiError(error)),
  });

  const roleLabel: Record<Role, string> = {
    HOST: 'Super Administrator — unrestricted access',
    ADMIN: 'Administrator — full business data, manages users',
    USER: 'Team Member — expense entry only',
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={user ? `Edit ${user.username}` : 'Create user'}
      description={user ? 'Change role, contact details or access.' : 'Credentials are hashed before they are stored.'}
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
            {user ? 'Save changes' : 'Create user'}
          </Button>
        </>
      }
    >
      <form className="space-y-4" onSubmit={form.handleSubmit((values) => mutation.mutateAsync(values))}>
        {!user && (
          <Field label="Username" required error={form.errorFor('username')} htmlFor="u-name">
            <Input
              id="u-name"
              value={form.values.username}
              onChange={(e) => form.setField('username', e.target.value)}
              onBlur={() => form.blur('username')}
              invalid={Boolean(form.errorFor('username'))}
              autoComplete="off"
              autoFocus
            />
          </Field>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" htmlFor="u-full">
            <Input id="u-full" value={form.values.fullName} onChange={(e) => form.setField('fullName', e.target.value)} />
          </Field>
          <Field label="Email" error={form.errorFor('email')} htmlFor="u-email">
            <Input
              id="u-email"
              type="email"
              value={form.values.email}
              onChange={(e) => form.setField('email', e.target.value)}
              onBlur={() => form.blur('email')}
              invalid={Boolean(form.errorFor('email'))}
            />
          </Field>
        </div>

        <Field label="Role" hint={roleLabel[form.values.role]} htmlFor="u-role">
          <Select
            id="u-role"
            value={form.values.role}
            onChange={(e) => form.setField('role', e.target.value as Role)}
            disabled={assignableRoles.length <= 1 && !isHost}
          >
            {assignableRoles.map((role) => (
              <option key={role} value={role}>
                {role === 'HOST' ? 'Super Administrator' : role === 'ADMIN' ? 'Administrator' : 'Team Member'}
              </option>
            ))}
          </Select>
        </Field>

        {!user && (
          <Field label="Password" required error={form.errorFor('password')} htmlFor="u-pass">
            <Input
              id="u-pass"
              type="password"
              value={form.values.password}
              onChange={(e) => form.setField('password', e.target.value)}
              onBlur={() => form.blur('password')}
              invalid={Boolean(form.errorFor('password'))}
              autoComplete="new-password"
            />
            <PasswordStrength password={form.values.password} />
          </Field>
        )}

        <div className="space-y-2.5">
          <div className="flex items-center justify-between rounded-xl border border-line bg-surface-elevated/50 px-4 py-3">
            <div>
              <p className="text-sm text-ink">Require password change at next sign-in</p>
              <p className="text-xs text-ink-muted">Recommended for accounts you create for someone else.</p>
            </div>
            <Toggle
              checked={form.values.mustChangePassword}
              onChange={(n) => form.setField('mustChangePassword', n)}
              label="Require password change"
            />
          </div>
          {user && (
            <div className="flex items-center justify-between rounded-xl border border-line bg-surface-elevated/50 px-4 py-3">
              <div>
                <p className="text-sm text-ink">Account active</p>
                <p className="text-xs text-ink-muted">Deactivated accounts cannot sign in.</p>
              </div>
              <Toggle checked={form.values.isActive} onChange={(n) => form.setField('isActive', n)} label="Active" />
            </div>
          )}
        </div>
      </form>
    </Modal>
  );
}

export function ResetPasswordModal({
  open,
  onClose,
  user,
}: {
  open: boolean;
  onClose: () => void;
  user: User | null;
}) {
  const toast = useToast();
  const form = useFormState({ password: '', mustChange: true }, (values) => ({
    password: passwordIsStrong(values.password) ? undefined : 'Password does not meet the policy',
  }));

  useEffect(() => {
    if (open) form.reset({ password: '', mustChange: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const mutation = useMutation({
    mutationFn: async (values: { password: string; mustChange: boolean }) =>
      (await api.post(`/users/${user!.id}/reset-password`, { newPassword: values.password, mustChangePassword: values.mustChange })).data,
    onSuccess: () => {
      toast.success('Password reset', `${user?.username} will use the new password at next sign-in.`);
      onClose();
    },
    onError: (error) => toast.error('Could not reset password', apiError(error)),
  });

  if (!user) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Reset password — ${user.username}`}
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
            Reset password
          </Button>
        </>
      }
    >
      <Field label="New password" required error={form.errorFor('password')} htmlFor="r-pass">
        <Input
          id="r-pass"
          type="password"
          value={form.values.password}
          onChange={(e) => form.setField('password', e.target.value)}
          onBlur={() => form.blur('password')}
          invalid={Boolean(form.errorFor('password'))}
          autoComplete="new-password"
          autoFocus
        />
        <PasswordStrength password={form.values.password} />
      </Field>
      <div className="mt-4 flex items-center justify-between rounded-xl border border-line bg-surface-elevated/50 px-4 py-3">
        <p className="text-sm text-ink">Force change at next sign-in</p>
        <Toggle checked={form.values.mustChange} onChange={(n) => form.setField('mustChange', n)} label="Force change" />
      </div>
    </Modal>
  );
}
