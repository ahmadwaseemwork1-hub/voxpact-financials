import { Router } from 'express';
import { prisma, dec } from '../lib/prisma';
import { asyncHandler } from '../utils/http';
import { authenticate, requireFinancialAccess } from '../middleware/auth';
import { audit } from '../middleware/audit';
import { toCsv, sendCsv } from '../utils/csv';
import { parseRange, monthKey } from '../utils/dates';
import { getSettings } from '../lib/settings';

const router = Router();
// Reports expose salary + profit data, so they are manager-only.
router.use(authenticate, requireFinancialAccess);

async function profitAndLoss(from: Date, to: Date) {
  const [expenses, revenues] = await Promise.all([
    prisma.expense.findMany({ where: { date: { gte: from, lte: to } }, select: { category: true, amount: true, type: true, date: true } }),
    prisma.revenue.findMany({
      where: { status: 'RECEIVED', receivedDate: { gte: from, lte: to } },
      select: { clientName: true, amount: true, receivedAmount: true, receivedDate: true },
    }),
  ]);

  const revenueTotal = revenues.reduce((s, r) => s + dec(r.receivedAmount ?? r.amount), 0);
  const expenseTotal = expenses.reduce((s, e) => s + dec(e.amount), 0);

  const byCategory = new Map<string, number>();
  for (const e of expenses) byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + dec(e.amount));

  const byClient = new Map<string, number>();
  for (const r of revenues) byClient.set(r.clientName, (byClient.get(r.clientName) ?? 0) + dec(r.receivedAmount ?? r.amount));

  const monthly = new Map<string, { month: string; label: string; revenue: number; expenses: number; profit: number }>();
  const touch = (d: Date) => {
    const key = monthKey(d);
    if (!monthly.has(key)) {
      monthly.set(key, { month: key, label: d.toLocaleString('en-US', { month: 'short', year: '2-digit' }), revenue: 0, expenses: 0, profit: 0 });
    }
    return monthly.get(key)!;
  };
  for (const e of expenses) touch(e.date).expenses += dec(e.amount);
  for (const r of revenues) if (r.receivedDate) touch(r.receivedDate).revenue += dec(r.receivedAmount ?? r.amount);
  for (const m of monthly.values()) m.profit = Number((m.revenue - m.expenses).toFixed(2));

  return {
    range: { from, to },
    summary: {
      revenue: Number(revenueTotal.toFixed(2)),
      expenses: Number(expenseTotal.toFixed(2)),
      netProfit: Number((revenueTotal - expenseTotal).toFixed(2)),
      margin: revenueTotal > 0 ? Number((((revenueTotal - expenseTotal) / revenueTotal) * 100).toFixed(1)) : 0,
      recurringExpenses: Number(expenses.filter((e) => e.type === 'RECURRING').reduce((s, e) => s + dec(e.amount), 0).toFixed(2)),
      dailyExpenses: Number(expenses.filter((e) => e.type === 'DAILY').reduce((s, e) => s + dec(e.amount), 0).toFixed(2)),
      transactionCount: expenses.length + revenues.length,
    },
    expenseByCategory: [...byCategory.entries()]
      .map(([category, amount]) => ({
        category,
        amount: Number(amount.toFixed(2)),
        share: expenseTotal > 0 ? Number(((amount / expenseTotal) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.amount - a.amount),
    revenueByClient: [...byClient.entries()]
      .map(([client, amount]) => ({ client, amount: Number(amount.toFixed(2)) }))
      .sort((a, b) => b.amount - a.amount),
    monthly: [...monthly.values()].sort((a, b) => (a.month > b.month ? 1 : -1)),
  };
}

/** Everything the Reports page needs, in one round-trip. */
router.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const { from, to } = parseRange(req.query as any);

    const [pnl, partners, employees, specialProjects, settings, revenueTrend] = await Promise.all([
      profitAndLoss(from, to),
      prisma.partner.findMany({ orderBy: { percentage: 'desc' } }),
      prisma.employee.findMany({ orderBy: { name: 'asc' } }),
      prisma.specialEmployeeProject.findMany({
        where: { date: { gte: from, lte: to } },
        include: { employee: { select: { name: true } } },
        orderBy: { date: 'desc' },
      }),
      getSettings(),
      prisma.revenue.findMany({
        where: { OR: [{ projectedDate: { gte: from, lte: to } }, { receivedDate: { gte: from, lte: to } }] },
        select: { amount: true, receivedAmount: true, projectedDate: true, receivedDate: true },
      }),
    ]);

    const trendMap = new Map<string, { month: string; label: string; projected: number; received: number }>();
    const touchTrend = (d: Date) => {
      const key = monthKey(d);
      if (!trendMap.has(key)) {
        trendMap.set(key, { month: key, label: d.toLocaleString('en-US', { month: 'short', year: '2-digit' }), projected: 0, received: 0 });
      }
      return trendMap.get(key)!;
    };
    for (const r of revenueTrend) {
      touchTrend(r.projectedDate).projected += dec(r.amount);
      if (r.receivedDate) touchTrend(r.receivedDate).received += dec(r.receivedAmount ?? r.amount);
    }

    const activeEmployees = employees.filter((e) => e.isActive && !e.isSpecial);
    const profit = pnl.summary.netProfit;

    res.json({
      ...pnl,
      revenueTrend: [...trendMap.values()].sort((a, b) => (a.month > b.month ? 1 : -1)),
      partnerDistribution: partners.map((p) => ({
        id: p.id,
        name: p.name,
        percentage: dec(p.percentage),
        shareAmount: Number(((Math.max(0, profit) * dec(p.percentage)) / 100).toFixed(2)),
        paymentStatus: p.paymentStatus,
      })),
      employeeCost: {
        rows: employees.map((e) => ({
          id: e.id,
          name: e.name,
          role: e.role,
          type: e.isSpecial ? 'Percentage-based' : 'Salaried',
          monthlySalary: dec(e.monthlySalary),
          bonus: dec(e.bonus),
          totalMonthlyCost: dec(e.monthlySalary) + dec(e.bonus),
          isActive: e.isActive,
        })),
        totalMonthly: Number(activeEmployees.reduce((s, e) => s + dec(e.monthlySalary) + dec(e.bonus), 0).toFixed(2)),
        specialPayouts: Number(specialProjects.reduce((s, p) => s + dec(p.payoutAmount), 0).toFixed(2)),
        specialProjects: specialProjects.map((p) => ({
          id: p.id,
          employee: p.employee.name,
          projectName: p.projectName,
          totalAmount: dec(p.totalAmount),
          percentage: dec(p.percentage),
          payoutAmount: dec(p.payoutAmount),
          date: p.date,
          isPaid: p.isPaid,
        })),
      },
      company: settings.company,
      currency: settings.currency,
    });
  }),
);

/** CSV export for any report type. */
router.get(
  '/export',
  asyncHandler(async (req, res) => {
    const { from, to } = parseRange(req.query as any);
    const type = String(req.query.type ?? 'pnl');
    const stamp = `${from.toISOString().slice(0, 10)}_${to.toISOString().slice(0, 10)}`;
    const pnl = await profitAndLoss(from, to);

    let csv = '';
    let filename = `voxpact-report-${stamp}.csv`;

    if (type === 'expense-breakdown') {
      csv = toCsv(pnl.expenseByCategory, [
        { key: 'category', label: 'Category' },
        { key: 'amount', label: 'Amount' },
        { key: 'share', label: 'Share (%)' },
      ]);
      filename = `voxpact-expense-breakdown-${stamp}.csv`;
    } else if (type === 'revenue-trends') {
      csv = toCsv(pnl.monthly, [
        { key: 'label', label: 'Month' },
        { key: 'revenue', label: 'Revenue' },
        { key: 'expenses', label: 'Expenses' },
        { key: 'profit', label: 'Profit' },
      ]);
      filename = `voxpact-revenue-trends-${stamp}.csv`;
    } else if (type === 'partner-distribution') {
      const partners = await prisma.partner.findMany({ orderBy: { percentage: 'desc' } });
      csv = toCsv(
        partners.map((p) => ({
          name: p.name,
          percentage: dec(p.percentage).toFixed(2),
          shareAmount: ((Math.max(0, pnl.summary.netProfit) * dec(p.percentage)) / 100).toFixed(2),
          paymentStatus: p.paymentStatus,
        })),
        [
          { key: 'name', label: 'Partner' },
          { key: 'percentage', label: 'Percentage (%)' },
          { key: 'shareAmount', label: 'Share Amount' },
          { key: 'paymentStatus', label: 'Payment Status' },
        ],
      );
      filename = `voxpact-partner-distribution-${stamp}.csv`;
    } else if (type === 'employee-cost') {
      const employees = await prisma.employee.findMany({ orderBy: { name: 'asc' } });
      csv = toCsv(
        employees.map((e) => ({
          name: e.name,
          role: e.role,
          type: e.isSpecial ? 'Percentage-based' : 'Salaried',
          monthlySalary: dec(e.monthlySalary).toFixed(2),
          bonus: dec(e.bonus).toFixed(2),
          total: (dec(e.monthlySalary) + dec(e.bonus)).toFixed(2),
          status: e.isActive ? 'Active' : 'Inactive',
        })),
        [
          { key: 'name', label: 'Employee' },
          { key: 'role', label: 'Role' },
          { key: 'type', label: 'Type' },
          { key: 'monthlySalary', label: 'Monthly Salary' },
          { key: 'bonus', label: 'Bonus' },
          { key: 'total', label: 'Total Monthly Cost' },
          { key: 'status', label: 'Status' },
        ],
      );
      filename = `voxpact-employee-cost-${stamp}.csv`;
    } else {
      csv = toCsv(
        [
          { line: 'Revenue (received)', amount: pnl.summary.revenue.toFixed(2) },
          { line: 'Daily expenses', amount: pnl.summary.dailyExpenses.toFixed(2) },
          { line: 'Recurring expenses', amount: pnl.summary.recurringExpenses.toFixed(2) },
          { line: 'Total expenses', amount: pnl.summary.expenses.toFixed(2) },
          { line: 'Net profit', amount: pnl.summary.netProfit.toFixed(2) },
          { line: 'Margin (%)', amount: pnl.summary.margin.toFixed(1) },
        ],
        [
          { key: 'line', label: 'Line Item' },
          { key: 'amount', label: 'Amount' },
        ],
      );
      filename = `voxpact-profit-and-loss-${stamp}.csv`;
    }

    await audit(req, 'EXPORT', 'Report', null, { type, from, to });
    sendCsv(res, filename, csv);
  }),
);

export default router;
