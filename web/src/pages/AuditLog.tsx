import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, ScrollText, Search } from 'lucide-react';
import { api, apiError, downloadFile } from '../lib/api';
import { formatDateTime } from '../lib/format';
import { useToast } from '../store/ToastProvider';
import { useDebounce } from '../hooks/useDebounce';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { PageHeader } from '../components/layout/PageHeader';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { DataTable, type Column } from '../components/ui/DataTable';
import { Input, Select } from '../components/ui/Input';
import type { AuditLog as AuditEntry, Paged } from '../types';

const ACTION_TONE: Record<string, 'positive' | 'warning' | 'danger' | 'info' | 'gold' | 'neutral'> = {
  LOGIN: 'positive',
  LOGOUT: 'neutral',
  LOGIN_FAILED: 'danger',
  CREATE: 'info',
  UPDATE: 'warning',
  DELETE: 'danger',
  EXPORT: 'gold',
  PASSWORD_CHANGE: 'warning',
  PASSWORD_RESET: 'warning',
};

export default function AuditLog() {
  useDocumentTitle('Audit log');
  const toast = useToast();

  const [search, setSearch] = useState('');
  const [action, setAction] = useState('ALL');
  const [entityType, setEntityType] = useState('ALL');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const debounced = useDebounce(search, 300);

  const params = useMemo(
    () => ({
      page,
      pageSize: 50,
      search: debounced || undefined,
      action: action !== 'ALL' ? action : undefined,
      entityType: entityType !== 'ALL' ? entityType : undefined,
      from: from || undefined,
      to: to || undefined,
    }),
    [page, debounced, action, entityType, from, to],
  );

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', params],
    queryFn: async () => (await api.get<Paged<AuditEntry>>('/audit-logs', { params })).data,
  });

  const columns: Column<AuditEntry>[] = [
    {
      key: 'timestamp',
      header: 'When',
      width: '170px',
      sortValue: (r) => r.timestamp,
      render: (row) => <span className="whitespace-nowrap text-xs text-ink-muted">{formatDateTime(row.timestamp)}</span>,
    },
    {
      key: 'username',
      header: 'User',
      width: '150px',
      sortValue: (r) => r.username,
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm text-ink">{row.username}</p>
          {row.role && <p className="text-[0.65rem] uppercase tracking-wider text-ink-subtle">{row.role}</p>}
        </div>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      width: '150px',
      render: (row) => <Badge tone={ACTION_TONE[row.action] ?? 'neutral'}>{row.action.replace('_', ' ')}</Badge>,
    },
    {
      key: 'entityType',
      header: 'Entity',
      width: '140px',
      render: (row) => <span className="text-xs text-ink-muted">{row.entityType}</span>,
    },
    {
      key: 'details',
      header: 'Details',
      render: (row) => (
        <span className="line-clamp-2 block max-w-[420px] break-words font-mono text-[0.68rem] leading-relaxed text-ink-subtle">
          {row.details ? JSON.stringify(row.details) : '—'}
        </span>
      ),
    },
    {
      key: 'ipAddress',
      header: 'IP',
      width: '130px',
      render: (row) => <span className="font-mono text-[0.68rem] text-ink-subtle">{row.ipAddress ?? '—'}</span>,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Audit log"
        subtitle="Every sign-in, create, update, delete and export — with user, time and IP."
        actions={
          <Button
            variant="secondary"
            onClick={() => downloadFile('/audit-logs/export', params).catch((e) => toast.error('Export failed', apiError(e)))}
          >
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        }
      />

      <div className="mb-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative lg:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search user, action or entity…"
            className="pl-9"
            aria-label="Search audit log"
          />
        </div>
        <Select value={action} onChange={(e) => setAction(e.target.value)} aria-label="Filter by action">
          <option value="ALL">All actions</option>
          {Object.keys(ACTION_TONE).map((a) => (
            <option key={a} value={a}>
              {a.replace('_', ' ')}
            </option>
          ))}
        </Select>
        <Select value={entityType} onChange={(e) => setEntityType(e.target.value)} aria-label="Filter by entity">
          <option value="ALL">All entities</option>
          {['Auth', 'User', 'Expense', 'Revenue', 'Partner', 'Employee', 'SpecialEmployeeProject', 'DailyBudget', 'Setting', 'Report'].map(
            (e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ),
          )}
        </Select>
        <div className="grid grid-cols-2 gap-2">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        rowKey={(row) => row.id}
        loading={isLoading}
        dense
        emptyTitle="No audit entries"
        emptyMessage="Activity recorded in the portal will appear here."
        pagination={
          data
            ? { page: data.meta.page, totalPages: data.meta.totalPages, total: data.meta.total, onPageChange: setPage }
            : undefined
        }
      />
    </div>
  );
}
