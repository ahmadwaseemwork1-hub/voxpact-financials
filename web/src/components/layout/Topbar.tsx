import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bell,
  LogOut,
  Menu,
  Moon,
  Search,
  Settings as SettingsIcon,
  Sun,
  User as UserIcon,
  AlertTriangle,
  TrendingUp,
  Receipt,
  Users2,
  Loader2,
} from 'lucide-react';
import { api } from '../../lib/api';
import { cn, initials } from '../../lib/utils';
import { formatCurrency, formatRelative } from '../../lib/format';
import { useAuth } from '../../store/AuthProvider';
import { useTheme } from '../../store/ThemeProvider';
import { useDebounce } from '../../hooks/useDebounce';
import { Dropdown, DropdownItem } from '../ui/Dropdown';
import { Badge } from '../ui/Badge';
import type { AppNotification } from '../../types';
import { Logo } from './Logo';

interface SearchResult {
  id: string;
  type: 'expense' | 'revenue' | 'employee' | 'partner';
  title: string;
  subtitle: string;
  amount: number | null;
  href: string;
}

const RESULT_ICON = {
  expense: Receipt,
  revenue: TrendingUp,
  employee: UserIcon,
  partner: Users2,
} as const;

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const debounced = useDebounce(query, 300);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: results, isFetching } = useQuery({
    queryKey: ['search', debounced],
    queryFn: async () => (await api.get<{ results: SearchResult[] }>('/search', { params: { q: debounced } })).data.results,
    enabled: debounced.trim().length >= 2,
    staleTime: 20_000,
  });

  const { data: notifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () =>
      (await api.get<{ notifications: AppNotification[]; unreadCount: number }>('/notifications')).data,
    refetchInterval: 90_000,
  });

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setSearchOpen(true);
      }
      if (e.key === 'Escape') setSearchOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const unread = notifications?.unreadCount ?? 0;

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/80 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
        <button
          type="button"
          onClick={onMenu}
          aria-label="Open navigation"
          className="rounded-lg p-2 text-ink-muted transition-colors hover:bg-white/5 hover:text-ink lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="lg:hidden">
          <Logo compact />
        </div>

        {/* Global search */}
        <div ref={searchRef} className="relative ml-auto w-full max-w-md lg:ml-0">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              placeholder="Search expenses, revenue, people…"
              aria-label="Global search"
              className="h-10 w-full rounded-xl border border-line bg-surface-elevated/60 pl-9 pr-16 text-sm text-ink placeholder:text-ink-subtle transition-all focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
            <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-line px-1.5 py-0.5 text-[0.62rem] text-ink-subtle sm:block">
              ⌘K
            </kbd>
          </div>

          <AnimatePresence>
            {searchOpen && debounced.trim().length >= 2 && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18 }}
                className="glass absolute left-0 right-0 top-12 z-50 max-h-[60vh] overflow-y-auto rounded-xl bg-surface-elevated/95 p-1.5"
              >
                {isFetching && (
                  <div className="flex items-center gap-2 px-3 py-3 text-xs text-ink-muted">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…
                  </div>
                )}
                {!isFetching && !results?.length && (
                  <p className="px-3 py-4 text-center text-xs text-ink-muted">No matches for “{debounced}”</p>
                )}
                {results?.map((result) => {
                  const Icon = RESULT_ICON[result.type];
                  return (
                    <button
                      key={`${result.type}-${result.id}`}
                      type="button"
                      onClick={() => {
                        navigate(result.href);
                        setSearchOpen(false);
                        setQuery('');
                      }}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-white/[0.06]"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/12 text-accent">
                        <Icon className="h-4 w-4" strokeWidth={1.7} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-ink">{result.title}</span>
                        <span className="block truncate text-[0.7rem] text-ink-muted">{result.subtitle}</span>
                      </span>
                      {result.amount !== null && (
                        <span className="shrink-0 text-xs font-semibold tabular-nums text-ink-muted">
                          {formatCurrency(result.amount)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="rounded-lg p-2 text-ink-muted transition-all hover:bg-white/5 hover:text-accent"
          >
            {theme === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
          </button>

          {/* Notifications */}
          <Dropdown
            trigger={({ toggle }) => (
              <button
                type="button"
                onClick={toggle}
                aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
                className="relative rounded-lg p-2 text-ink-muted transition-all hover:bg-white/5 hover:text-accent"
              >
                <Bell className="h-[18px] w-[18px]" />
                {unread > 0 && (
                  <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[0.6rem] font-bold text-white">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </button>
            )}
            panelClassName="w-[340px] max-w-[calc(100vw-2rem)] p-0"
          >
            {(close) => (
              <div>
                <div className="flex items-center justify-between border-b border-line px-4 py-3">
                  <p className="text-sm font-semibold text-ink">Notifications</p>
                  {unread > 0 && (
                    <button
                      type="button"
                      className="text-[0.7rem] text-accent hover:underline"
                      onClick={async () => {
                        await api.post('/notifications/read-all').catch(() => undefined);
                        void queryClient.invalidateQueries({ queryKey: ['notifications'] });
                      }}
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-[360px] overflow-y-auto">
                  {!notifications?.notifications.length ? (
                    <p className="px-4 py-8 text-center text-xs text-ink-muted">You're all caught up.</p>
                  ) : (
                    notifications.notifications.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => {
                          if (n.link) navigate(n.link);
                          close();
                        }}
                        className="flex w-full gap-3 border-b border-line/60 px-4 py-3 text-left transition-colors last:border-0 hover:bg-white/[0.04]"
                      >
                        <span
                          className={cn(
                            'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
                            n.level === 'danger'
                              ? 'bg-danger/14 text-danger'
                              : n.level === 'warning'
                                ? 'bg-warning/14 text-warning'
                                : 'bg-accent/12 text-accent',
                          )}
                        >
                          <AlertTriangle className="h-3.5 w-3.5" strokeWidth={1.8} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[0.8rem] font-medium text-ink">{n.title}</span>
                          <span className="mt-0.5 block text-[0.72rem] leading-relaxed text-ink-muted">{n.message}</span>
                          <span className="mt-1 block text-[0.65rem] text-ink-subtle">{formatRelative(n.createdAt)}</span>
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </Dropdown>

          {/* Profile */}
          <Dropdown
            trigger={({ toggle }) => (
              <button
                type="button"
                onClick={toggle}
                aria-label="Account menu"
                className="ml-1 flex items-center gap-2.5 rounded-xl border border-line bg-surface-elevated/60 py-1.5 pl-1.5 pr-3 transition-all hover:border-accent/40"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gold-gradient text-[0.68rem] font-bold text-navy-950">
                  {initials(user?.fullName || user?.username)}
                </span>
                <span className="hidden text-left sm:block">
                  <span className="block max-w-[120px] truncate text-xs font-medium text-ink">{user?.username}</span>
                  <span className="block text-[0.62rem] uppercase tracking-wider text-ink-subtle">
                    {user?.role === 'HOST' ? 'Super Admin' : user?.role === 'ADMIN' ? 'Admin' : 'User'}
                  </span>
                </span>
              </button>
            )}
          >
            {(close) => (
              <>
                <div className="border-b border-line px-3 py-2.5">
                  <p className="truncate text-sm font-medium text-ink">{user?.fullName || user?.username}</p>
                  <p className="truncate text-[0.7rem] text-ink-muted">{user?.email || 'No email on file'}</p>
                  <div className="mt-2">
                    <Badge tone="gold">{user?.role === 'HOST' ? 'Super Administrator' : user?.role === 'ADMIN' ? 'Administrator' : 'Team Member'}</Badge>
                  </div>
                </div>
                <div className="p-1">
                  <DropdownItem
                    icon={<SettingsIcon className="h-4 w-4" />}
                    onClick={() => {
                      navigate('/settings');
                      close();
                    }}
                  >
                    Profile & settings
                  </DropdownItem>
                  <DropdownItem icon={<LogOut className="h-4 w-4" />} danger onClick={() => void logout()}>
                    Sign out
                  </DropdownItem>
                </div>
              </>
            )}
          </Dropdown>
        </div>
      </div>
    </header>
  );
}
