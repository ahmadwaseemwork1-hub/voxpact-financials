import { Router } from 'express';
import { prisma, dec } from '../lib/prisma';
import { asyncHandler } from '../utils/http';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

/** Global search across expenses, revenue, employees and partners. */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = String(req.query.q ?? '').trim();
    if (q.length < 2) return res.json({ results: [], query: q });

    const isManager = req.user!.role !== 'USER';
    const like = { contains: q, mode: 'insensitive' as const };

    const [expenses, revenues, employees, partners] = await Promise.all([
      prisma.expense.findMany({
        where: { OR: [{ name: like }, { description: like }, { category: like }] },
        take: 6,
        orderBy: { date: 'desc' },
      }),
      prisma.revenue.findMany({
        where: { OR: [{ clientName: like }, { source: like }, { description: like }] },
        take: 6,
        orderBy: { projectedDate: 'desc' },
      }),
      isManager
        ? prisma.employee.findMany({ where: { OR: [{ name: like }, { role: like }] }, take: 5 })
        : Promise.resolve([]),
      isManager ? prisma.partner.findMany({ where: { name: like }, take: 5 }) : Promise.resolve([]),
    ]);

    const results = [
      ...expenses.map((e) => ({
        id: e.id,
        type: 'expense' as const,
        title: e.name,
        subtitle: `${e.category} · ${e.date.toISOString().slice(0, 10)}`,
        amount: dec(e.amount),
        href: e.type === 'RECURRING' ? '/expenses/recurring' : '/expenses/daily',
      })),
      ...revenues.map((r) => ({
        id: r.id,
        type: 'revenue' as const,
        title: r.clientName,
        subtitle: `${r.status} · ${r.projectedDate.toISOString().slice(0, 10)}`,
        amount: dec(r.receivedAmount ?? r.amount),
        href: '/revenue',
      })),
      ...employees.map((e) => ({
        id: e.id,
        type: 'employee' as const,
        title: e.name,
        subtitle: e.role,
        amount: dec(e.monthlySalary),
        href: e.isSpecial ? '/employees/special' : '/employees/regular',
      })),
      ...partners.map((p) => ({
        id: p.id,
        type: 'partner' as const,
        title: p.name,
        subtitle: `${dec(p.percentage)}% ownership`,
        amount: null,
        href: '/partners',
      })),
    ];

    res.json({ results, query: q });
  }),
);

export default router;
