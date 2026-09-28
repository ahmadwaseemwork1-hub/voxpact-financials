import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, Receipt, TrendingUp, X } from 'lucide-react';
import { useAuth } from '../../store/AuthProvider';
import { ExpenseFormModal } from '../forms/ExpenseFormModal';
import { RevenueFormModal } from '../forms/RevenueFormModal';

export function QuickActions() {
  const { can } = useAuth();
  const [open, setOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [revenueOpen, setRevenueOpen] = useState(false);

  const actions = [
    can('manage:expenses') && {
      label: 'Add Expense',
      icon: Receipt,
      onClick: () => {
        setExpenseOpen(true);
        setOpen(false);
      },
    },
    can('manage:revenue') && {
      label: 'Add Revenue',
      icon: TrendingUp,
      onClick: () => {
        setRevenueOpen(true);
        setOpen(false);
      },
    },
  ].filter(Boolean) as { label: string; icon: typeof Receipt; onClick: () => void }[];

  if (!actions.length) return null;

  return (
    <>
      <div className="no-print fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2.5">
        <AnimatePresence>
          {open &&
            actions.map((action, i) => (
              <motion.button
                key={action.label}
                type="button"
                initial={{ opacity: 0, y: 12, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.9 }}
                transition={{ duration: 0.2, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
                onClick={action.onClick}
                className="glass flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-medium text-ink transition-all hover:border-accent/45 hover:text-accent"
              >
                <action.icon className="h-4 w-4" strokeWidth={1.8} />
                {action.label}
              </motion.button>
            ))}
        </AnimatePresence>

        <motion.button
          type="button"
          onClick={() => setOpen((o) => !o)}
          whileTap={{ scale: 0.94 }}
          aria-label={open ? 'Close quick actions' : 'Open quick actions'}
          aria-expanded={open}
          className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gold-gradient text-navy-950 shadow-[0_8px_28px_rgba(201,169,98,0.4)] transition-transform hover:scale-105"
        >
          <motion.span animate={{ rotate: open ? 135 : 0 }} transition={{ duration: 0.25 }}>
            {open ? <X className="h-6 w-6" strokeWidth={2.2} /> : <Plus className="h-6 w-6" strokeWidth={2.2} />}
          </motion.span>
        </motion.button>
      </div>

      <ExpenseFormModal open={expenseOpen} onClose={() => setExpenseOpen(false)} mode="DAILY" />
      <RevenueFormModal open={revenueOpen} onClose={() => setRevenueOpen(false)} />
    </>
  );
}
