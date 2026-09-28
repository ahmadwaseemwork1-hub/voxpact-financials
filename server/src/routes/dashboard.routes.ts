import { Router } from 'express';
import { prisma, dec } from '../lib/prisma';
import { asyncHandler } from '../utils/http';
import { authenticate } from '../middleware/auth';
import { getSetting } from '../lib/settings';
import { startOfDay, endOfDay, startOfMonth, endOfMonth, addDays, addMonths } from '../utils/dates';

const router = Router();
router.use(authenticate);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const prevStart = startOfMonth(addMonths(now, -1));
    const prevEnd = endOfMonth(addMonths(now, -1));

    const [
      monthExpenses,
      prevMonthExpenses,
      projectedAgg,
      receivedAgg,
      receivedThisMonth,
      receivedPrevMonth,
      allTimeReceived,
      allTimeExpenses,
      trendRows,
      recentExpenses,
      recentRevenue,
      categoryGroups,
      overdueCount,
    ] = await Promise.all([
      prisma.expense.aggregate({ where: { date: { gte: monthStart, lte: monthEnd } }, _sum: { amount: true }, _count: true }),
      prisma.expense.aggregate({ where: { date: { gte: prevStart, lte: prevEnd } }, _sum: { amount: true } }),
      prisma.revenue.aggregate({ _sum: { amount: true } }),
      prisma.revenue.aggregate({ where: { status: 'RECEIVED' }, _sum: { receivedAmount: true, amount: true } }),
      prisma.revenue.aggregate({ where: { status: 'RECEIVED', receivedDate: { gte: monthStart, lte: monthEnd } }, _sum: { receivedAmount: true, amount: true } }),
      prisma.revenue.aggregate({ where: { status: 'RECEIVED', receivedDate: { gte: prevStart, lte: prevEnd } }, _sum: { receivedAmount: true, amount: true } }),
      prisma.revenue.aggregate({ where: { status: 'RECEIVED' }, _sum: { receivedAmount: true, amount: true } }),
      prisma.expense.aggregate({ _sum: { amount: true } }),
      prisma.expense.findMany({ where: { date: { gte: startOfDay(addDays(now, -6)), lte: endOfDay(now) } }, select: { amount: true, date: true } }),
      prisma.expense.findMany({ take: 10, orderBy: { createdAt: 'desc' }, include: { addedBy: { select: { username: true } } } }),
      prisma.revenue.findMany({ take: 10, orderBy: { createdAt: 'desc' }, include: { addedBy: { select: { username: true } } } }),
      prisma.expense.groupBy({ by: ['category'], where: { date: { gte: monthStart, lte: monthEnd } }, _sum: { amount: true } }),
      prisma.revenue.count({ where: { status: 'PROJECTED', projectedDate: { lt: addDays(now, -3) } } }),
    ]);

    // 7-day expense trend
    const trendMap = new Map<string, number>();
    for (let i = 6; i >= 0; i -= 1) {
      const d = startOfDay(addDays(now, -i));
      trendMap.set(d.toISOString().slice(0, 10), 0);
    }
    for (const row of trendRows) {
      const key = startOfDay(row.date).toISOString().slice(0, 10);
      if (trendMap.has(key)) trendMap.set(key, (trendMap.get(key) ?? 0) + dec(row.amount));
    }
    const expenseTrend = [...trendMap.entries()].map(([date, amount]) => ({
      date,
      label: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
      amount: Number(amount.toFixed(2)),
    }));

    // 6-month revenue vs expenses
    const revExpSeries: { month: string; label: string; revenue: number; expenses: number }[] = [];
    for (let i = 5; i >= 0; i -= 1) {
      const d = addMonths(now, -i);
      const s = startOfMonth(d);
      const e = endOfMonth(d);
      const [exp, rev] = await Promise.all([
        prisma.expense.aggregate({ where: { date: { gte: s, lte: e } }, _sum: { amount: true } }),
        prisma.revenue.aggregate({ where: { status: 'RECEIVED', receivedDate: { gte: s, lte: e } }, _sum: { receivedAmount: true, amount: true } }),
      ]);
      revExpSeries.push({
        month: `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, '0')}`,
        label: s.toLocaleString('en-US', { month: 'short' }),
        expenses: Number(dec(exp._sum.amount).toFixed(2)),
        revenue: Number((dec(rev._sum.receivedAmount) || dec(rev._sum.amount)).toFixed(2)),
      });
    }

    // Budget
    const defaultBudget = Number(await getSetting<number>('dailyBudget')) || 0;
    const todayRecord = await prisma.dailyBudget.findUnique({
      where: { date: new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) },
    });
    const todaySpentAgg = await prisma.expense.aggregate({
      where: { type: 'DAILY', date: { gte: startOfDay(now), lte: endOfDay(now) } },
      _sum: { amount: true },
    });
    const budgetAmount = todayRecord ? dec(todayRecord.budgetAmount) : defaultBudget;
    const todaySpent = dec(todaySpentAgg._sum.amount);
    const budgetPercent = budgetAmount > 0 ? Number(((todaySpent / budgetAmount) * 100).toFixed(1)) : 0;

    const monthlyExpenseTotal = dec(monthExpenses._sum.amount);
    const prevMonthlyExpenseTotal = dec(prevMonthExpenses._sum.amount);
    const totalProjected = dec(projectedAgg._sum.amount);
    const totalReceived = dec(receivedAgg._sum.receivedAmount) || dec(receivedAgg._sum.amount);
    const monthReceived = dec(receivedThisMonth._sum.receivedAmount) || dec(receivedThisMonth._sum.amount);
    const prevMonthReceived = dec(receivedPrevMonth._sum.receivedAmount) || dec(receivedPrevMonth._sum.amount);
    const cashOnHand = (dec(allTimeReceived._sum.receivedAmount) || dec(allTimeReceived._sum.amount)) - dec(allTimeExpenses._sum.amount);

    const pct = (current: number, previous: number) =>
      previous > 0 ? Number((((current - previous) / previous) * 100).toFixed(1)) : current > 0 ? 100 : 0;

    const activity = [
      ...recentExpenses.map((e) => ({
        id: e.id,
        kind: 'EXPENSE' as const,
        title: e.name,
        subtitle: e.category,
        amount: -dec(e.amount),
        at: e.createdAt,
        by: e.addedBy?.username ?? 'system',
      })),
      ...recentRevenue.map((r) => ({
        id: r.id,
        kind: 'REVENUE' as const,
        title: r.clientName,
        subtitle: r.status === 'RECEIVED' ? 'Payment received' : 'Projected revenue',
        amount: dec(r.receivedAmount ?? r.amount),
        at: r.createdAt,
        by: r.addedBy?.username ?? 'system',
      })),
    ]
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 10);

    const isManager = req.user!.role !== 'USER';

    res.json({
      stats: {
        totalRevenueProjected: Number(totalProjected.toFixed(2)),
        totalRevenueReceived: Number(totalReceived.toFixed(2)),
        revenueThisMonth: Number(monthReceived.toFixed(2)),
        revenueChangePct: pct(monthReceived, prevMonthReceived),
        monthlyExpenses: Number(monthlyExpenseTotal.toFixed(2)),
        expenseChangePct: pct(monthlyExpenseTotal, prevMonthlyExpenseTotal),
        expenseCount: monthExpenses._count,
        netProfit: Number((monthReceived - monthlyExpenseTotal).toFixed(2)),
        cashOnHand: isManager ? Number(cashOnHand.toFixed(2)) : null,
        projectionAccuracy: totalProjected > 0 ? Number(((totalReceived / totalProjected) * 100).toFixed(1)) : 0,
        overdueCount,
      },
      budget: {
        budgetAmount,
        spentAmount: Number(todaySpent.toFixed(2)),
        remaining: Number((budgetAmount - todaySpent).toFixed(2)),
        percentUsed: budgetPercent,
        status: budgetPercent > 90 ? 'DANGER' : budgetPercent >= 70 ? 'WARNING' : 'HEALTHY',
      },
      charts: {
        expenseTrend,
        revenueVsExpenses: revExpSeries,
        expenseByCategory: categoryGroups
          .map((g) => ({ category: g.category, amount: Number(dec(g._sum.amount).toFixed(2)) }))
          .sort((a, b) => b.amount - a.amount),
      },
      activity,
    });
  }),
);

export default router;
