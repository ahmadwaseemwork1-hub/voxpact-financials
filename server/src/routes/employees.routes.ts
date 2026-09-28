import { Router } from 'express';
import { z } from 'zod';
import { Prisma, prisma, dec } from '../lib/prisma';
import { ApiError, asyncHandler, param } from '../utils/http';
import { authenticate, requireFinancialAccess } from '../middleware/auth';
import { audit, diff } from '../middleware/audit';
import { validateBody } from '../middleware/validate';
import { zBool, zEmail, zMoney } from '../utils/zod';
import { toCsv, sendCsv } from '../utils/csv';
import { startOfMonth, endOfMonth } from '../utils/dates';

const router = Router();
// Salary data is never visible to the USER role.
router.use(authenticate, requireFinancialAccess);

const employeeSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  role: z.string().trim().min(1, 'Role is required').max(120),
  email: zEmail,
  monthlySalary: zMoney.optional().default(0),
  bonus: zMoney.optional().default(0),
  isSpecial: zBool.optional().default(false),
  isActive: zBool.optional().default(true),
});

const projectSchema = z.object({
  employeeId: z.string().min(1, 'Select an employee'),
  projectName: z.string().trim().min(1, 'Project name is required').max(160),
  totalAmount: z.coerce.number().positive('Project amount must be greater than zero'),
  percentage: z.coerce.number().min(0, 'Percentage cannot be negative').max(100, 'Percentage cannot exceed 100'),
  date: z.coerce.date(),
  isPaid: zBool.optional().default(false),
  addToExpenses: zBool.optional().default(true),
});

// ------------------------------------------------------------- regular staff
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = req.query as Record<string, string | undefined>;
    const where: Prisma.EmployeeWhereInput = {
      AND: [
        q.special === 'true' ? { isSpecial: true } : q.special === 'false' ? { isSpecial: false } : {},
        q.status === 'ACTIVE' ? { isActive: true } : q.status === 'INACTIVE' ? { isActive: false } : {},
        q.search ? { OR: [{ name: { contains: q.search, mode: 'insensitive' } }, { role: { contains: q.search, mode: 'insensitive' } }] } : {},
      ],
    };

    const employees = await prisma.employee.findMany({ where, orderBy: [{ isActive: 'desc' }, { name: 'asc' }] });

    const rows = employees.map((e) => ({
      ...e,
      monthlySalary: dec(e.monthlySalary),
      bonus: dec(e.bonus),
      totalMonthlyCost: dec(e.monthlySalary) + dec(e.bonus),
    }));

    const active = rows.filter((r) => r.isActive && !r.isSpecial);
    res.json({
      employees: rows,
      totals: {
        headcount: rows.filter((r) => !r.isSpecial).length,
        activeHeadcount: active.length,
        monthlySalary: Number(active.reduce((s, r) => s + r.monthlySalary, 0).toFixed(2)),
        monthlyBonus: Number(active.reduce((s, r) => s + r.bonus, 0).toFixed(2)),
        monthlyCost: Number(active.reduce((s, r) => s + r.totalMonthlyCost, 0).toFixed(2)),
      },
    });
  }),
);

router.post(
  '/',
  validateBody(employeeSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof employeeSchema>;
    const employee = await prisma.employee.create({
      data: {
        name: body.name,
        role: body.role,
        email: body.email || null,
        monthlySalary: new Prisma.Decimal(body.monthlySalary ?? 0),
        bonus: new Prisma.Decimal(body.bonus ?? 0),
        isSpecial: body.isSpecial ?? false,
        isActive: body.isActive ?? true,
      },
    });
    await audit(req, 'CREATE', 'Employee', employee.id, { name: employee.name, isSpecial: employee.isSpecial });
    res.status(201).json({ employee });
  }),
);

router.patch(
  '/:id',
  validateBody(employeeSchema.partial()),
  asyncHandler(async (req, res) => {
    const existing = await prisma.employee.findUnique({ where: { id: param(req, 'id') } });
    if (!existing) throw ApiError.notFound('Employee not found');
    const body = req.body as Partial<z.infer<typeof employeeSchema>>;

    const employee = await prisma.employee.update({
      where: { id: existing.id },
      data: {
        name: body.name,
        role: body.role,
        email: body.email === '' ? null : body.email,
        monthlySalary: body.monthlySalary !== undefined ? new Prisma.Decimal(body.monthlySalary) : undefined,
        bonus: body.bonus !== undefined ? new Prisma.Decimal(body.bonus) : undefined,
        isSpecial: body.isSpecial,
        isActive: body.isActive,
      },
    });
    await audit(req, 'UPDATE', 'Employee', employee.id, { name: employee.name, changes: diff(existing as any, employee as any) });
    res.json({ employee });
  }),
);

/** Bulk activate / deactivate. */
router.post(
  '/bulk-status',
  validateBody(z.object({ ids: z.array(z.string()).min(1, 'Select at least one employee'), isActive: zBool })),
  asyncHandler(async (req, res) => {
    const { ids, isActive } = req.body as { ids: string[]; isActive: boolean };
    const result = await prisma.employee.updateMany({ where: { id: { in: ids } }, data: { isActive } });
    await audit(req, 'UPDATE', 'Employee', null, { bulk: true, count: result.count, isActive });
    res.json({ ok: true, updated: result.count });
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const existing = await prisma.employee.findUnique({ where: { id: param(req, 'id') } });
    if (!existing) throw ApiError.notFound('Employee not found');
    await prisma.employee.delete({ where: { id: existing.id } });
    await audit(req, 'DELETE', 'Employee', existing.id, { name: existing.name });
    res.json({ ok: true });
  }),
);

/**
 * Push this month's active salary bill into the expense ledger as a single
 * "Salary run" entry. Idempotent per month.
 */
router.post(
  '/post-salaries',
  asyncHandler(async (req, res) => {
    const monthStart = startOfMonth();
    const monthEnd = endOfMonth();
    const sourceId = `salary-${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`;

    const active = await prisma.employee.findMany({ where: { isActive: true, isSpecial: false } });
    const total = active.reduce((s, e) => s + dec(e.monthlySalary) + dec(e.bonus), 0);
    if (total <= 0) throw ApiError.badRequest('There is no active salary cost to post');

    const existing = await prisma.expense.findFirst({ where: { sourceType: 'SALARY_RUN', sourceId } });
    const data = {
      type: 'RECURRING' as const,
      name: `Salary run — ${monthStart.toLocaleString('en-US', { month: 'long', year: 'numeric' })}`,
      description: `${active.length} active employees`,
      category: 'Salary',
      amount: new Prisma.Decimal(total.toFixed(2)),
      date: monthEnd,
      dueDate: monthEnd,
      isPaid: false,
      isRecurring: true,
      sourceType: 'SALARY_RUN',
      sourceId,
      addedById: req.user!.id,
    };

    const expense = existing
      ? await prisma.expense.update({ where: { id: existing.id }, data })
      : await prisma.expense.create({ data });

    await audit(req, existing ? 'UPDATE' : 'CREATE', 'Expense', expense.id, { sourceType: 'SALARY_RUN', total });
    res.json({ expense, total, headcount: active.length, updated: Boolean(existing) });
  }),
);

// ---------------------------------------------------------- special projects
router.get(
  '/special/projects',
  asyncHandler(async (req, res) => {
    const q = req.query as Record<string, string | undefined>;
    const where: Prisma.SpecialEmployeeProjectWhereInput = {
      AND: [
        q.employeeId ? { employeeId: q.employeeId } : {},
        q.search ? { projectName: { contains: q.search, mode: 'insensitive' } } : {},
      ],
    };

    const projects = await prisma.specialEmployeeProject.findMany({
      where,
      orderBy: { date: 'desc' },
      include: { employee: { select: { id: true, name: true, role: true } } },
    });

    res.json({
      projects,
      totals: {
        count: projects.length,
        totalProjectValue: Number(projects.reduce((s, p) => s + dec(p.totalAmount), 0).toFixed(2)),
        totalPayout: Number(projects.reduce((s, p) => s + dec(p.payoutAmount), 0).toFixed(2)),
        pendingPayout: Number(projects.filter((p) => !p.isPaid).reduce((s, p) => s + dec(p.payoutAmount), 0).toFixed(2)),
      },
    });
  }),
);

router.post(
  '/special/projects',
  validateBody(projectSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof projectSchema>;
    const employee = await prisma.employee.findUnique({ where: { id: body.employeeId } });
    if (!employee) throw ApiError.notFound('Employee not found');

    const payout = Number(((body.totalAmount * body.percentage) / 100).toFixed(2));

    const project = await prisma.specialEmployeeProject.create({
      data: {
        employeeId: employee.id,
        projectName: body.projectName,
        totalAmount: new Prisma.Decimal(body.totalAmount),
        percentage: new Prisma.Decimal(body.percentage),
        payoutAmount: new Prisma.Decimal(payout),
        date: body.date,
        isPaid: body.isPaid ?? false,
      },
      include: { employee: { select: { id: true, name: true, role: true } } },
    });

    if (body.addToExpenses !== false) {
      const expense = await prisma.expense.create({
        data: {
          type: 'DAILY',
          name: `Payout — ${employee.name} (${body.projectName})`,
          description: `${body.percentage}% of ${body.totalAmount}`,
          category: 'Salary',
          amount: new Prisma.Decimal(payout),
          date: body.date,
          isPaid: body.isPaid ?? false,
          sourceType: 'SPECIAL_PAYOUT',
          sourceId: project.id,
          addedById: req.user!.id,
        },
      });
      await prisma.specialEmployeeProject.update({ where: { id: project.id }, data: { expenseId: expense.id } });
    }

    await audit(req, 'CREATE', 'SpecialEmployeeProject', project.id, { employee: employee.name, project: project.projectName, payout });
    res.status(201).json({ project });
  }),
);

router.patch(
  '/special/projects/:id',
  validateBody(projectSchema.partial()),
  asyncHandler(async (req, res) => {
    const existing = await prisma.specialEmployeeProject.findUnique({ where: { id: param(req, 'id') } });
    if (!existing) throw ApiError.notFound('Project not found');
    const body = req.body as Partial<z.infer<typeof projectSchema>>;

    const totalAmount = body.totalAmount ?? dec(existing.totalAmount);
    const percentage = body.percentage ?? dec(existing.percentage);
    const payout = Number(((totalAmount * percentage) / 100).toFixed(2));

    const project = await prisma.specialEmployeeProject.update({
      where: { id: existing.id },
      data: {
        employeeId: body.employeeId,
        projectName: body.projectName,
        totalAmount: new Prisma.Decimal(totalAmount),
        percentage: new Prisma.Decimal(percentage),
        payoutAmount: new Prisma.Decimal(payout),
        date: body.date,
        isPaid: body.isPaid,
      },
      include: { employee: { select: { id: true, name: true, role: true } } },
    });

    if (existing.expenseId) {
      await prisma.expense.update({
        where: { id: existing.expenseId },
        data: {
          name: `Payout — ${project.employee.name} (${project.projectName})`,
          amount: new Prisma.Decimal(payout),
          date: project.date,
          isPaid: project.isPaid,
        },
      }).catch(() => undefined);
    }

    await audit(req, 'UPDATE', 'SpecialEmployeeProject', project.id, { changes: diff(existing as any, project as any) });
    res.json({ project });
  }),
);

router.delete(
  '/special/projects/:id',
  asyncHandler(async (req, res) => {
    const existing = await prisma.specialEmployeeProject.findUnique({ where: { id: param(req, 'id') } });
    if (!existing) throw ApiError.notFound('Project not found');
    if (existing.expenseId) {
      await prisma.expense.delete({ where: { id: existing.expenseId } }).catch(() => undefined);
    }
    await prisma.specialEmployeeProject.delete({ where: { id: existing.id } });
    await audit(req, 'DELETE', 'SpecialEmployeeProject', existing.id, { project: existing.projectName });
    res.json({ ok: true });
  }),
);

router.get(
  '/export',
  asyncHandler(async (req, res) => {
    const employees = await prisma.employee.findMany({ orderBy: { name: 'asc' } });
    const csv = toCsv(
      employees.map((e) => ({
        name: e.name,
        role: e.role,
        type: e.isSpecial ? 'Percentage-based' : 'Salaried',
        monthlySalary: dec(e.monthlySalary).toFixed(2),
        bonus: dec(e.bonus).toFixed(2),
        totalMonthlyCost: (dec(e.monthlySalary) + dec(e.bonus)).toFixed(2),
        status: e.isActive ? 'Active' : 'Inactive',
      })),
      [
        { key: 'name', label: 'Name' },
        { key: 'role', label: 'Role' },
        { key: 'type', label: 'Type' },
        { key: 'monthlySalary', label: 'Monthly Salary' },
        { key: 'bonus', label: 'Bonus' },
        { key: 'totalMonthlyCost', label: 'Total Monthly Cost' },
        { key: 'status', label: 'Status' },
      ],
    );
    await audit(req, 'EXPORT', 'Employee', null, { count: employees.length });
    sendCsv(res, `voxpact-employees-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }),
);

export default router;
