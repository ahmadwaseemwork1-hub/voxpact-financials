import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Pencil, Plus, Search, ShieldCheck, Trash2, UserCheck, UserX } from 'lucide-react';
import { api, apiError } from '../lib/api';
import { formatDateTime, formatRelative } from '../lib/format';
import { useAuth } from '../store/AuthProvider';
import { useToast } from '../store/ToastProvider';
import { useDebounce } from '../hooks/useDebounce';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { PageHeader } from '../components/layout/PageHeader';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { MotionCard } from '../components/ui/Card';
import { DataTable, type Column } from '../components/ui/DataTable';
import { Input, Select } from '../components/ui/Input';
import { useConfirm } from '../components/ui/ConfirmDialog';
import { UserFormModal, ResetPasswordModal } from '../components/forms/UserFormModal';
import type { Paged, Role, User } from '../types';

const ROLE_LABEL: Record<Role, string> = {
  HOST: 'Super Admin',
  ADMIN: 'Administrator',
  USER: 'Team Member',
};

export default function Users() {
  useDocumentTitle('User management');
  const toast = useToast();
  const queryClient = useQueryClient();
  const { user: currentUser, isHost } = useAuth();
  const { confirm, dialog } = useConfirm();

  const [search, setSearch] = useState('');
  const [role, setRole] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [resetting, setResetting] = useState<User | null>(null);
  const debounced = useDebounce(search, 300);

  const params = useMemo(
    () => ({
      page,
      pageSize: 25,
      search: debounced || undefined,
      role: role !== 'ALL' ? role : undefined,
      status: status !== 'ALL' ? status : undefined,
    }),
    [page, debounced, role, status],
  );

  const { data, isLoading } = useQuery({
    queryKey: ['users', params],
    queryFn: async () => (await api.get<Paged<User>>('/users', { params })).data,
  });

  const { data: assignable } = useQuery({
    queryKey: ['assignable-roles'],
    queryFn: async () => (await api.get<{ roles: Role[] }>('/users/assignable-roles')).data.roles,
    staleTime: 600_000,
  });

  const toggleActive = useMutation({
    mutationFn: async (target: User) => api.patch(`/users/${target.id}`, { isActive: !target.isActive }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Account updated');
    },
    onError: (error) => toast.error('Could not update', apiError(error)),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => {
      toast.success('User deleted');
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error) => toast.error('Could not delete', apiError(error)),
  });

  const rows = data?.data ?? [];
  const canManage = (target: User) => {
    if (isHost) return true;
    return target.role === 'USER';
  };

  const columns: Column<User>[] = [
    {
      key: 'username',
      header: 'User',
      sortValue: (r) => r.username,
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">
            {row.username}
            {row.id === currentUser?.id && <span className="ml-2 text-[0.65rem] text-accent">you</span>}
          </p>
          <p className="truncate text-[0.7rem] text-ink-muted">{row.fullName || row.email || '—'}</p>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      width: '150px',
      sortValue: (r) => r.role,
      render: (row) => (
        <Badge tone={row.role === 'HOST' ? 'gold' : row.role === 'ADMIN' ? 'info' : 'neutral'}>
          {ROLE_LABEL[row.role]}
        </Badge>
      ),
    },
    {
      key: 'createdAt',
      header: 'Created',
      width: '130px',
      sortValue: (r) => r.createdAt ?? '',
      render: (row) => <span className="whitespace-nowrap text-xs text-ink-muted">{formatDateTime(row.createdAt)}</span>,
    },
    {
      key: 'lastLogin',
      header: 'Last sign-in',
      width: '140px',
      sortValue: (r) => r.lastLogin ?? '',
      render: (row) => (
        <span className="whitespace-nowrap text-xs text-ink-muted">
          {row.lastLogin ? formatRelative(row.lastLogin) : 'Never'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '130px',
      render: (row) => (
        <div className="flex flex-wrap gap-1.5">
          <Badge tone={row.isActive ? 'positive' : 'danger'} dot>
            {row.isActive ? 'Active' : 'Disabled'}
          </Badge>
          {row.mustChangePassword && <Badge tone="warning">Must reset</Badge>}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: '150px',
      render: (row) => (
        <div className="flex justify-end gap-1">
          <Button
            size="icon"
            variant="ghost"
            disabled={!canManage(row)}
            aria-label={`Reset password for ${row.username}`}
            title="Reset password"
            onClick={() => setResetting(row)}
          >
            <KeyRound className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            disabled={!canManage(row) || row.id === currentUser?.id}
            aria-label={`${row.isActive ? 'Deactivate' : 'Activate'} ${row.username}`}
            title={row.isActive ? 'Deactivate' : 'Activate'}
            onClick={() => toggleActive.mutate(row)}
          >
            {row.isActive ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            disabled={!canManage(row)}
            aria-label={`Edit ${row.username}`}
            onClick={() => {
              setEditing(row);
              setFormOpen(true);
            }}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="hover:text-danger"
            disabled={!canManage(row) || row.id === currentUser?.id}
            aria-label={`Delete ${row.username}`}
            onClick={() =>
              confirm({
                title: 'Delete user',
                message: (
                  <>
                    Permanently delete <strong className="text-ink">{row.username}</strong>? Their audit history is kept
                    but the account cannot sign in again.
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

  const counts = {
    total: data?.meta.total ?? 0,
    active: rows.filter((r) => r.isActive).length,
    admins: rows.filter((r) => r.role !== 'USER').length,
  };

  return (
    <div>
      <PageHeader
        title="User management"
        subtitle={
          isHost
            ? 'Full control over super admins, administrators and team members.'
            : 'Create and manage team member accounts.'
        }
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Create user
          </Button>
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <MotionCard className="p-5">
          <p className="text-[0.68rem] uppercase tracking-wider text-ink-subtle">Total accounts</p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums text-ink">{counts.total}</p>
        </MotionCard>
        <MotionCard delay={0.06} className="p-5">
          <p className="text-[0.68rem] uppercase tracking-wider text-ink-subtle">Active on this page</p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums text-positive">{counts.active}</p>
        </MotionCard>
        <MotionCard delay={0.12} className="p-5">
          <p className="text-[0.68rem] uppercase tracking-wider text-ink-subtle">Elevated roles</p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums text-accent">{counts.admins}</p>
        </MotionCard>
      </div>

      <div className="mb-4 flex flex-wrap gap-2.5">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search username, name or email…"
            className="pl-9"
            aria-label="Search users"
          />
        </div>
        <Select
          value={role}
          onChange={(e) => {
            setRole(e.target.value);
            setPage(1);
          }}
          className="w-[170px]"
          aria-label="Filter by role"
        >
          <option value="ALL">All roles</option>
          {isHost && <option value="HOST">Super Admin</option>}
          <option value="ADMIN">Administrator</option>
          <option value="USER">Team Member</option>
        </Select>
        <Select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="w-[150px]"
          aria-label="Filter by status"
        >
          <option value="ALL">Any status</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Disabled</option>
        </Select>
      </div>

      {!isHost && (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-line bg-surface-elevated/50 px-4 py-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <p className="text-xs leading-relaxed text-ink-muted">
            You can create and manage <strong className="text-ink">Team Member</strong> accounts. Administrator accounts
            are managed by the system owner.
          </p>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        loading={isLoading}
        emptyTitle="No users match these filters"
        emptyMessage="Create an account to give someone access to the portal."
        rowClassName={(row) => (row.isActive ? undefined : 'opacity-60')}
        pagination={
          data
            ? { page: data.meta.page, totalPages: data.meta.totalPages, total: data.meta.total, onPageChange: setPage }
            : undefined
        }
      />

      <UserFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        user={editing}
        assignableRoles={assignable ?? ['USER']}
      />
      <ResetPasswordModal open={Boolean(resetting)} onClose={() => setResetting(null)} user={resetting} />
      {dialog}
    </div>
  );
}
