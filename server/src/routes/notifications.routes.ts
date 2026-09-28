import { Router } from 'express';
import { prisma, dec } from '../lib/prisma';
import { asyncHandler } from '../utils/http';
import { authenticate } from '../middleware/auth';
import { getSetting } from '../lib/settings';
import { startOfDay, endOfDay, addDays } from '../utils/dates';

const router = Router();
router.use(authenticate);

/**
 * Notifications are derived live from the data (budget breaches, overdue
 * invoices, unpaid recurring bills) plus any stored notification rows.
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const now = new Date();
    const isManager = req.user!.role !== 'USER';
    const graceDays = Number(await getSetting<number>('overdueGraceDays')) || 0;
    const defaultBudget = Number(await getSetting<number>('dailyBudget')) || 0;

    const [todaySpent, todayBudget, overdue, unpaidRecurring, stored] = await Promise.all([
      prisma.expense.aggregate({
        where: { type: 'DAILY', date: { gte: startOfDay(now), lte: endOfDay(now) } },
        _sum: { amount: true },
      }),
      prisma.dailyBudget.findUnique({ where: { date: new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) } }),
      isManager
        ? prisma.revenue.findMany({
            where: { status: 'PROJECTED', projectedDate: { lt: addDays(now, -graceDays) } },
            orderBy: { projectedDate: 'asc' },
            take: 10,
          })
        : Promise.resolve([]),
      isManager
        ? prisma.expense.findMany({
            where: { type: 'RECURRING', isPaid: false, dueDate: { lte: addDays(now, 7) } },
            orderBy: { dueDate: 'asc' },
            take: 10,
          })
        : Promise.resolve([]),
      prisma.notification.findMany({
        where: { OR: [{ userId: req.user!.id }, { userId: null }] },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    const budget = todayBudget ? dec(todayBudget.budgetAmount) : defaultBudget;
    const spent = dec(todaySpent._sum.amount);
    const percent = budget > 0 ? (spent / budget) * 100 : 0;

    const items: {
      id: string;
      title: string;
      message: string;
      level: 'info' | 'warning' | 'danger' | 'success';
      link?: string;
      createdAt: Date;
      isRead: boolean;
    }[] = [];

    if (budget > 0 && percent >= 90) {
      items.push({
        id: 'budget-today',
        title: percent > 100 ? 'Daily budget exceeded' : 'Daily budget nearly spent',
        message: `${percent.toFixed(0)}% of today's budget used (${spent.toFixed(2)} of ${budget.toFixed(2)})`,
        level: percent > 100 ? 'danger' : 'warning',
        link: '/budget',
        createdAt: now,
        isRead: false,
      });
    }

    for (const r of overdue) {
      const days = Math.floor((now.getTime() - r.projectedDate.getTime()) / 86_400_000);
      items.push({
        id: `overdue-${r.id}`,
        title: `Overdue: ${r.clientName}`,
        message: `${dec(r.amount).toFixed(2)} was expected ${days} day${days === 1 ? '' : 's'} ago`,
        level: 'danger',
        link: '/revenue',
        createdAt: r.projectedDate,
        isRead: false,
      });
    }

    for (const e of unpaidRecurring) {
      items.push({
        id: `recurring-${e.id}`,
        title: `Bill due: ${e.name}`,
        message: `${dec(e.amount).toFixed(2)} ${e.dueDate ? `due ${e.dueDate.toISOString().slice(0, 10)}` : 'is unpaid'}`,
        level: 'warning',
        link: '/expenses/recurring',
        createdAt: e.dueDate ?? e.date,
        isRead: false,
      });
    }

    for (const n of stored) {
      items.push({
        id: n.id,
        title: n.title,
        message: n.message,
        level: (n.level as any) ?? 'info',
        link: n.link ?? undefined,
        createdAt: n.createdAt,
        isRead: n.isRead,
      });
    }

    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json({ notifications: items, unreadCount: items.filter((i) => !i.isRead).length });
  }),
);

router.post(
  '/read-all',
  asyncHandler(async (req, res) => {
    await prisma.notification.updateMany({
      where: { OR: [{ userId: req.user!.id }, { userId: null }], isRead: false },
      data: { isRead: true },
    });
    res.json({ ok: true });
  }),
);

export default router;
