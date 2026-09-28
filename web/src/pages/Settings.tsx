import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Check,
  Moon,
  Palette,
  Plus,
  Save,
  ShieldCheck,
  Sun,
  Tag,
  Timer,
  UserCog,
  X,
} from 'lucide-react';
import { api, apiError } from '../lib/api';
import { setCurrency } from '../lib/format';
import { cn } from '../lib/utils';
import { useAuth } from '../store/AuthProvider';
import { useTheme } from '../store/ThemeProvider';
import { useToast } from '../store/ToastProvider';
import { useFormState, passwordChecks, passwordIsStrong } from '../hooks/useFormState';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { PageHeader } from '../components/layout/PageHeader';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { CardBody, CardHeader, MotionCard } from '../components/ui/Card';
import { Field, Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import type { Settings as AppSettings } from '../types';

/* -------------------------------------------------------------- password */

export function ChangePasswordModal({
  open,
  onClose,
  forced = false,
}: {
  open: boolean;
  onClose: () => void;
  forced?: boolean;
}) {
  const toast = useToast();
  const { refresh } = useAuth();

  const form = useFormState(
    { currentPassword: '', newPassword: '', confirmPassword: '' },
    (values) => ({
      currentPassword: values.currentPassword ? undefined : 'Enter your current password',
      newPassword: passwordIsStrong(values.newPassword) ? undefined : 'Password does not meet the policy',
      confirmPassword: values.confirmPassword === values.newPassword ? undefined : 'Passwords do not match',
    }),
  );

  useEffect(() => {
    if (open) form.reset({ currentPassword: '', newPassword: '', confirmPassword: '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const mutation = useMutation({
    mutationFn: async (values: { currentPassword: string; newPassword: string }) =>
      (await api.post('/auth/change-password', values)).data,
    onSuccess: async () => {
      toast.success('Password updated');
      await refresh();
      onClose();
    },
    onError: (error) => toast.error('Could not change password', apiError(error)),
  });

  const checks = passwordChecks(form.values.newPassword);

  return (
    <Modal
      open={open}
      onClose={forced ? () => undefined : onClose}
      title={forced ? 'Set a new password' : 'Change password'}
      description={
        forced
          ? 'This account is still using its initial password. Choose a new one to continue.'
          : 'Choose a strong password you do not use anywhere else.'
      }
      size="sm"
      footer={
        <>
          {!forced && (
            <Button variant="ghost" onClick={onClose} disabled={mutation.isPending}>
              Cancel
            </Button>
          )}
          <Button
            onClick={form.handleSubmit((values) =>
              mutation.mutateAsync({ currentPassword: values.currentPassword, newPassword: values.newPassword }),
            )}
            loading={mutation.isPending}
            disabled={!form.isValid}
          >
            Update password
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Current password" required error={form.errorFor('currentPassword')} htmlFor="cp-current">
          <Input
            id="cp-current"
            type="password"
            value={form.values.currentPassword}
            onChange={(e) => form.setField('currentPassword', e.target.value)}
            onBlur={() => form.blur('currentPassword')}
            invalid={Boolean(form.errorFor('currentPassword'))}
            autoComplete="current-password"
          />
        </Field>
        <Field label="New password" required error={form.errorFor('newPassword')} htmlFor="cp-new">
          <Input
            id="cp-new"
            type="password"
            value={form.values.newPassword}
            onChange={(e) => form.setField('newPassword', e.target.value)}
            onBlur={() => form.blur('newPassword')}
            invalid={Boolean(form.errorFor('newPassword'))}
            autoComplete="new-password"
          />
          <ul className="mt-2 grid gap-1 sm:grid-cols-2">
            {checks.map((check) => (
              <li
                key={check.label}
                className={cn('flex items-center gap-1.5 text-[0.7rem]', check.passed ? 'text-positive' : 'text-ink-subtle')}
              >
                {check.passed ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                {check.label}
              </li>
            ))}
          </ul>
        </Field>
        <Field label="Confirm new password" required error={form.errorFor('confirmPassword')} htmlFor="cp-confirm">
          <Input
            id="cp-confirm"
            type="password"
            value={form.values.confirmPassword}
            onChange={(e) => form.setField('confirmPassword', e.target.value)}
            onBlur={() => form.blur('confirmPassword')}
            invalid={Boolean(form.errorFor('confirmPassword'))}
            autoComplete="new-password"
          />
        </Field>
      </div>
    </Modal>
  );
}

/* --------------------------------------------------------- tag list editor */

function TagEditor({
  values,
  onChange,
  placeholder,
  disabled,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState('');

  const add = () => {
    const value = draft.trim();
    if (!value || values.some((v) => v.toLowerCase() === value.toLowerCase())) return;
    onChange([...values, value]);
    setDraft('');
  };

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {values.map((value) => (
          <span
            key={value}
            className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/12 px-2.5 py-1 text-[0.7rem] text-accent"
          >
            {value}
            {!disabled && (
              <button
                type="button"
                onClick={() => onChange(values.filter((v) => v !== value))}
                aria-label={`Remove ${value}`}
                className="hover:text-danger"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}
        {values.length === 0 && <span className="text-xs text-ink-subtle">Nothing configured yet</span>}
      </div>
      {!disabled && (
        <div className="mt-3 flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add();
              }
            }}
            placeholder={placeholder}
          />
          <Button variant="secondary" onClick={add} type="button">
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ page */

export default function SettingsPage() {
  useDocumentTitle('Settings');
  const toast = useToast();
  const queryClient = useQueryClient();
  const { user, setUser, isManager, inactivityMinutes } = useAuth();
  const { theme, setTheme } = useTheme();

  const [passwordOpen, setPasswordOpen] = useState(false);
  const [profile, setProfile] = useState({ fullName: '', email: '' });
  const [settings, setSettings] = useState<AppSettings | null>(null);

  const { data } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => (await api.get<{ settings: AppSettings }>('/settings')).data.settings,
  });

  useEffect(() => {
    if (user) setProfile({ fullName: user.fullName ?? '', email: user.email ?? '' });
  }, [user]);

  useEffect(() => {
    if (data) setSettings(data);
  }, [data]);

  const saveProfile = useMutation({
    mutationFn: async () => (await api.patch('/auth/profile', profile)).data,
    onSuccess: (result: { user: typeof user }) => {
      if (result.user) setUser(result.user);
      toast.success('Profile updated');
    },
    onError: (error) => toast.error('Could not save profile', apiError(error)),
  });

  const saveSettings = useMutation({
    mutationFn: async () => (await api.put('/settings', settings)).data,
    onSuccess: (result: { settings: AppSettings }) => {
      setCurrency(result.settings.currency);
      toast.success('Settings saved');
      void queryClient.invalidateQueries({ queryKey: ['settings'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (error) => toast.error('Could not save settings', apiError(error)),
  });

  const patch = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) =>
    setSettings((s) => (s ? { ...s, [key]: value } : s));

  return (
    <div>
      <PageHeader title="Settings" subtitle="Your profile, security, and — for administrators — how the portal behaves." />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Profile */}
        <MotionCard>
          <CardHeader
            title="Your profile"
            subtitle={`Signed in as ${user?.username}`}
            icon={<UserCog className="h-4 w-4" strokeWidth={1.8} />}
            action={
              <Badge tone={user?.role === 'HOST' ? 'gold' : user?.role === 'ADMIN' ? 'info' : 'neutral'}>
                {user?.role === 'HOST' ? 'Super Admin' : user?.role === 'ADMIN' ? 'Administrator' : 'Team Member'}
              </Badge>
            }
          />
          <CardBody className="space-y-4">
            <Field label="Full name" htmlFor="s-name">
              <Input
                id="s-name"
                value={profile.fullName}
                onChange={(e) => setProfile((p) => ({ ...p, fullName: e.target.value }))}
              />
            </Field>
            <Field label="Email" htmlFor="s-email">
              <Input
                id="s-email"
                type="email"
                value={profile.email}
                onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))}
              />
            </Field>
            <Button onClick={() => saveProfile.mutate()} loading={saveProfile.isPending}>
              <Save className="h-4 w-4" /> Save profile
            </Button>
          </CardBody>
        </MotionCard>

        {/* Security */}
        <MotionCard delay={0.06}>
          <CardHeader title="Security" subtitle="Credentials and session behaviour" icon={<ShieldCheck className="h-4 w-4" strokeWidth={1.8} />} />
          <CardBody className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-line bg-surface-elevated/50 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-ink">Password</p>
                <p className="text-xs text-ink-muted">
                  Min 8 characters with an uppercase letter, a number and a symbol.
                </p>
              </div>
              <Button variant="secondary" onClick={() => setPasswordOpen(true)}>
                Change
              </Button>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-line bg-surface-elevated/50 px-4 py-3">
              <Timer className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <div>
                <p className="text-sm font-medium text-ink">Automatic sign-out</p>
                <p className="text-xs text-ink-muted">
                  This session ends after {inactivityMinutes} minutes of inactivity, and tokens expire after 24 hours.
                </p>
              </div>
            </div>

            {user?.mustChangePassword && (
              <div className="rounded-xl border border-warning/30 bg-warning/[0.08] px-4 py-3">
                <p className="text-xs text-warning">
                  This account is still on its initial password. Change it now.
                </p>
              </div>
            )}
          </CardBody>
        </MotionCard>

        {/* Appearance */}
        <MotionCard delay={0.12}>
          <CardHeader title="Appearance" subtitle="Dark is the default" icon={<Palette className="h-4 w-4" strokeWidth={1.8} />} />
          <CardBody>
            <div className="grid grid-cols-2 gap-3">
              {(['dark', 'light'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setTheme(mode)}
                  className={cn(
                    'flex flex-col items-center gap-2.5 rounded-xl border p-5 transition-all duration-200',
                    theme === mode
                      ? 'border-accent/60 bg-accent/[0.08] shadow-glow'
                      : 'border-line hover:border-accent/35 hover:bg-white/[0.03]',
                  )}
                >
                  {mode === 'dark' ? (
                    <Moon className="h-5 w-5 text-accent" strokeWidth={1.7} />
                  ) : (
                    <Sun className="h-5 w-5 text-accent" strokeWidth={1.7} />
                  )}
                  <span className="text-sm font-medium capitalize text-ink">{mode} mode</span>
                  {theme === mode && <Badge tone="gold">Active</Badge>}
                </button>
              ))}
            </div>
          </CardBody>
        </MotionCard>

        {/* Company / business settings */}
        {isManager && settings && (
          <>
            <MotionCard delay={0.18}>
              <CardHeader
                title="Company"
                subtitle="Used on exported PDF reports"
                icon={<Building2 className="h-4 w-4" strokeWidth={1.8} />}
              />
              <CardBody className="space-y-4">
                <Field label="Display name" htmlFor="c-name">
                  <Input
                    id="c-name"
                    value={settings.company?.name ?? ''}
                    onChange={(e) => patch('company', { ...settings.company, name: e.target.value })}
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Legal name" htmlFor="c-legal">
                    <Input
                      id="c-legal"
                      value={settings.company?.legalName ?? ''}
                      onChange={(e) => patch('company', { ...settings.company, legalName: e.target.value })}
                    />
                  </Field>
                  <Field label="Email" htmlFor="c-email">
                    <Input
                      id="c-email"
                      value={settings.company?.email ?? ''}
                      onChange={(e) => patch('company', { ...settings.company, email: e.target.value })}
                    />
                  </Field>
                </div>
                <Field label="Address" htmlFor="c-addr">
                  <Input
                    id="c-addr"
                    value={settings.company?.address ?? ''}
                    onChange={(e) => patch('company', { ...settings.company, address: e.target.value })}
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Currency" hint="ISO code, e.g. USD" htmlFor="c-cur">
                    <Input id="c-cur" value={settings.currency} onChange={(e) => patch('currency', e.target.value.toUpperCase())} />
                  </Field>
                  <Field label="Default daily budget" htmlFor="c-budget">
                    <Input
                      id="c-budget"
                      type="number"
                      min="0"
                      value={settings.dailyBudget}
                      onChange={(e) => patch('dailyBudget', Number(e.target.value))}
                    />
                  </Field>
                  <Field label="Overdue grace (days)" htmlFor="c-grace">
                    <Input
                      id="c-grace"
                      type="number"
                      min="0"
                      value={settings.overdueGraceDays}
                      onChange={(e) => patch('overdueGraceDays', Number(e.target.value))}
                    />
                  </Field>
                </div>
              </CardBody>
            </MotionCard>

            <MotionCard delay={0.24}>
              <CardHeader
                title="Categories & payment methods"
                subtitle="Shown in the expense forms"
                icon={<Tag className="h-4 w-4" strokeWidth={1.8} />}
              />
              <CardBody className="space-y-6">
                <div>
                  <p className="mb-2.5 text-xs font-medium text-ink-muted">Expense categories</p>
                  <TagEditor
                    values={settings.categories ?? []}
                    onChange={(next) => patch('categories', next)}
                    placeholder="Add a category…"
                  />
                </div>
                <div>
                  <p className="mb-2.5 text-xs font-medium text-ink-muted">Payment methods</p>
                  <TagEditor
                    values={settings.paymentMethods ?? []}
                    onChange={(next) => patch('paymentMethods', next)}
                    placeholder="Add a payment method…"
                  />
                </div>
              </CardBody>
            </MotionCard>
          </>
        )}
      </div>

      {isManager && settings && (
        <div className="mt-5 flex justify-end">
          <Button onClick={() => saveSettings.mutate()} loading={saveSettings.isPending} size="lg">
            <Save className="h-4 w-4" /> Save all settings
          </Button>
        </div>
      )}

      <ChangePasswordModal open={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </div>
  );
}
