import { Router } from 'express';
import { z } from 'zod';
import { Prisma, prisma, dec } from '../lib/prisma';
import { asyncHandler } from '../utils/http';
import { authenticate, requireManager } from '../middleware/auth';
import { audit } from '../middleware/audit';
import { validateBody } from '../middleware/validate';
import { getSetting, setSetting } from '../lib/settings';
import { dateKey, startOfDay, endOfDay, addDays } from '../utils/dates';

const router = Router();
router.use(authenticate);

function statusFor(percent: number) {
  if (percent > 90) return 'DANGER';
  if (percent >= 70) return 'WARNING';
  return 'HEALTHY';
}

async function budgetFor(day: Date) {
  const key = dateKey(day);
  const fallback = Number(await getSetting<number>('dailyBudget')) || 0;

  const [record, spentAgg] = await Promise.all([
    prisma.dailyBudget.findUnique({ where: { date: key } }),
    prisma.expense.aggregate({
      where: { type: 'DAILY', date: { gte: startOfDay(day), lte: endOfDay(day) } },
      _sum: { amount: true },
    }),
  ]);

  const budgetAmount = record ? dec(record.budgetAmount) : fallback;
  const spent = dec(spentAgg._sum.amount);
  const percentUsed = budgetAmount > 0 ? Number(((spent / budgetAmount) * 100).toFixed(1)) : spent > 0 ? 100 : 0;

  return {
    date: key.toISOString().slice(0, 10),
    budgetAmount,
    spentAmount: Number(spent.toFixed(2)),
    remaining: Number((budgetAmount - spent).toFixed(2)),
    percentUsed,
    status: statusFor(percentUsed),
    exceeded: spent > budgetAmount && budgetAmount > 0,
    isDefault: !record,
  };
}

/** Today's budget snapshot. */
router.get(
  '/today',
  asyncHandler(async (_req, res) => {
    res.json(await budgetFor(new Date()));
  }),
);

/** Snapshot for any date: /api/budget/day?date=2026-09-21 */
router.get(
  '/day',
  asyncHandler(async (req, res) => {
    const date = req.query.date ? new Date(String(req.query.date)) : new Date();
    res.json(await budgetFor(date));
  }),
);

/** Rolling history for the trend chart. */
router.get(
  '/history',
  asyncHandler(async (req, res) => {
    const days = Math.min(120, Math.max(1, Number(req.query.days) || 30));
    const start = startOfDay(addDays(new Date(), -(days - 1)));
    const fallback = Number(await getSetting<number>('dailyBudget')) || 0;

    const [records, expenses] = await Promise.all([
      prisma.dailyBudget.findMany({ where: { date: { gte: dateKey(start) } } }),
      prisma.expense.findMany({
        where: { type: 'DAILY', date: { gte: start, lte: endOfDay(new Date()) } },
        select: { amount: true, date: true },
      }),
    ]);

    const budgetByDay = new Map(records.map((r) => [r.date.toISOString().slice(0, 10), dec(r.budgetAmount)]));
    const spentByDay = new Map<string, number>();
    for (const e of expenses) {
      const key = startOfDay(e.date).toISOString().slice(0, 10);
      spentByDay.set(key, (spentByDay.get(key) ?? 0) + dec(e.amount));
    }

    const series = [];
    for (let i = days - 1; i >= 0; i -= 1) {
      const d = startOfDay(addDays(new Date(), -i));
      const key = d.toISOString().slice(0, 10);
      const budget = budgetByDay.get(key) ?? fallback;
      const spent = Number((spentByDay.get(key) ?? 0).toFixed(2));
      const percentUsed = budget > 0 ? Number(((spent / budget) * 100).toFixed(1)) : 0;
      series.push({
        date: key,
        label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        budget,
        spent,
        percentUsed,
        status: statusFor(percentUsed),
      });
    }

    res.json({ series, days });
  }),
);

/** Set the budget for a specific day (HOST / ADMIN only). */
router.put(
  '/day',
  requireManager,
  validateBody(
    z.object({
      date: z.coerce.date().optional(),
      budgetAmount: z.coerce.number().min(0, 'Budget cannot be negative'),
      applyAsDefault: z.boolean().optional().default(false),
    }),
  ),
  asyncHandler(async (req, res) => {
    const { date, budgetAmount, applyAsDefault } = req.body as {
      date?: Date;
      budgetAmount: number;
      applyAsDefault?: boolean;
    };
    const key = dateKey(date ?? new Date());

    await prisma.dailyBudget.upsert({
      where: { date: key },
      update: { budgetAmount: new Prisma.Decimal(budgetAmount) },
      create: { date: key, budgetAmount: new Prisma.Decimal(budgetAmount), spentAmount: new Prisma.Decimal(0) },
    });

    if (applyAsDefault) await setSetting('dailyBudget', budgetAmount);

    await audit(req, 'UPDATE', 'DailyBudget', key.toISOString().slice(0, 10), { budgetAmount, applyAsDefault });
    res.json(await budgetFor(key));
  }),
);

/** Change the default daily budget used for days with no explicit override. */
router.put(
  '/default',
  requireManager,
  validateBody(z.object({ budgetAmount: z.coerce.number().min(0) })),
  asyncHandler(async (req, res) => {
    const { budgetAmount } = req.body as { budgetAmount: number };
    await setSetting('dailyBudget', budgetAmount);
    await audit(req, 'UPDATE', 'Setting', 'dailyBudget', { budgetAmount });
    res.json({ ok: true, dailyBudget: budgetAmount, today: await budgetFor(new Date()) });
  }),
);

export default router;
