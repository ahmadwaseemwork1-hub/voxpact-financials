import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../store/AuthProvider';
import { NAVIGATION } from './navigation';
import { Logo } from './Logo';

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { can, user } = useAuth();
  const location = useLocation();
  const [expanded, setExpanded] = useState<string[]>(['Expenses', 'Employees']);

  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const items = NAVIGATION.filter((item) => !item.permission || can(item.permission));

  const content = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-5 py-5">
        <Logo />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close navigation"
          className="rounded-lg p-1.5 text-ink-subtle hover:bg-white/5 hover:text-ink lg:hidden"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="no-scrollbar flex-1 space-y-1 overflow-y-auto px-3 pb-4" aria-label="Main navigation">
        {items.map((item) => {
          const children = item.children?.filter((c) => !c.permission || can(c.permission)) ?? [];

          if (children.length) {
            const isOpen = expanded.includes(item.label);
            const hasActiveChild = children.some((c) => location.pathname === c.to);
            return (
              <div key={item.label}>
                <button
                  type="button"
                  onClick={() => setExpanded((list) => (isOpen ? list.filter((l) => l !== item.label) : [...list, item.label]))}
                  aria-expanded={isOpen}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
                    hasActiveChild ? 'text-ink' : 'text-ink-muted hover:bg-white/[0.05] hover:text-ink',
                  )}
                >
                  <item.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.7} />
                  <span className="flex-1 text-left">{item.label}</span>
                  <ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-200', isOpen && 'rotate-180')} />
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="ml-[22px] mt-1 space-y-0.5 border-l border-line pl-3">
                        {children.map((child) => (
                          <NavLink
                            key={child.to}
                            to={child.to}
                            className={({ isActive }) =>
                              cn(
                                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-[0.8rem] transition-all duration-200',
                                isActive
                                  ? 'bg-accent/12 font-medium text-accent'
                                  : 'text-ink-muted hover:bg-white/[0.04] hover:text-ink',
                              )
                            }
                          >
                            <child.icon className="h-[15px] w-[15px]" strokeWidth={1.7} />
                            {child.label}
                          </NavLink>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          }

          return (
            <NavLink
              key={item.to}
              to={item.to!}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
                  isActive ? 'text-accent' : 'text-ink-muted hover:bg-white/[0.05] hover:text-ink',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="nav-active"
                      className="absolute inset-0 rounded-xl border border-accent/25 bg-accent/10"
                      transition={{ type: 'spring', stiffness: 400, damping: 34 }}
                    />
                  )}
                  <item.icon className="relative h-[18px] w-[18px] shrink-0" strokeWidth={1.7} />
                  <span className="relative">{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-line px-5 py-4">
        <p className="text-[0.68rem] text-ink-subtle">
          Signed in as <span className="font-medium text-ink-muted">{user?.username}</span>
        </p>
        <p className="mt-0.5 text-[0.62rem] uppercase tracking-[0.16em] text-accent/70">
          {user?.role === 'HOST' ? 'Super Administrator' : user?.role === 'ADMIN' ? 'Administrator' : 'Team Member'}
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] border-r border-line bg-surface-elevated/45 backdrop-blur-xl lg:block">
        {content}
      </aside>

      {/* Mobile */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 z-40 bg-navy-950/70 backdrop-blur-sm lg:hidden"
              aria-hidden
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-y-0 left-0 z-50 w-[272px] border-r border-line bg-surface-elevated/95 backdrop-blur-xl lg:hidden"
            >
              {content}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
