import { Router } from 'express';
import { z } from 'zod';
import { Prisma, prisma, dec } from '../lib/prisma';
import { ApiError, asyncHandler, paged, param, parsePaging } from '../utils/http';
import { authenticate, requireManager } from '../middleware/auth';
import { audit, diff } from '../middleware/audit';
import { validateBody } from '../middleware/validate';
import { zBool, zNullableDate, zPositiveMoney, zText } from '../utils/zod';
import { receiptUpload, saveReceipt, deleteUpload } from '../middleware/upload';
import { toCsv, sendCsv } from '../utils/csv';
import {
  parseRange,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  isoWeekKey,
  monthKey,
  startOfMonth,
  endOfMonth,
} from '../utils/dates';
import { getSetting } from '../lib/settings';

const router = Router();
router.use(authenticate);

const baseSchema = {
  name: z.string().trim().min(1, 'Name is required').max(160),
  description: zText(500),
  category: z.string().trim().min(1, 'Category is required').max(60),
  amount: zPositiveMoney,
  date: z.coerce.date({ error: 'Enter a valid date' }),
  paymentMethod: zText(60),
  isPaid: zBool.optional(),
};

const createSchema = z.object({
  ...baseSchema,
  type: z.enum(['DAILY', 'RECURRING']).default('DAILY'),
  dueDate: zNullableDate.optional(),
  isRecurring: zBool.optional().default(false),
});

const updateSchema = z.object({
  name: baseSchema.name.optional(),
  description: baseSchema.description,
  category: baseSchema.category.optional(),
  amount: baseSchema.amount.optional(),
  date: baseSchema.date.optional(),
  paymentMethod: baseSchema.paymentMethod,
  isPaid: zBool.optional(),
  dueDate: zNullableDate.optional(),
  isRecurring: zBool.optional(),
  removeReceipt: zBool.optional(),
});

const includeUser = { addedBy: { select: { id: true, username: true, fullName: true } } } as const;

function buildWhere(req: any): Prisma.ExpenseWhereInput {
  const q = req.query as Record<string, string | undefined>;
  const and: Prisma.ExpenseWhereInput[] = [];

  if (q.type && q.type !== 'ALL') and.push({ type: q.type as any });
  if (q.category && q.category !== 'ALL') and.push({ category: q.category });
  if (q.status === 'PAID') and.push({ isPaid: true });
  if (q.status === 'PENDING') and.push({ isPaid: false });
  if (q.from || q.to) {
    and.push({
      date: {
        ...(q.from ? { gte: startOfDay(q.from) } : {}),
        ...(q.to ? { lte: endOfDay(q.to) } : {}),
      },
    });
  }
  if (q.minAmount) and.push({ amount: { gte: new Prisma.Decimal(q.minAmount) } });
  if (q.maxAmount) and.push({ amount: { lte: new Prisma.Decimal(q.maxAmount) } });
  if (q.search) {
    and.push({
      OR: [
        { name: { contains: q.search, mode: 'insensitive' } },
        { description: { contains: q.search, mode: 'insensitive' } },
        { category: { contains: q.search, mode: 'insensitive' } },
      ],
    });
  }
  if (q.addedById) and.push({ addedById: q.addedById });

  return and.length ? { AND: and } : {};
}

// --------------------------------------------------------------- categories
router.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    const [configured, used] = await Promise.all([
      getSetting<string[]>('categories'),
      prisma.expense.findMany({ distinct: ['category'], select: { category: true } }),
    ]);
    const set = new Set([...(configured ?? []), ...used.map((u) => u.category)]);
    res.json({ categories: [...set].filter(Boolean).sort() });
  }),
);

// ------------------------------------------------------------------ listing
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, pageSize, skip, take } = parsePaging(req.query as any, 50);
    const where = buildWhere(req);

    const [rows, total, sum] = await Promise.all([
      prisma.expense.findMany({ where, orderBy: [{ date: 'desc' }, { createdAt: 'desc' }], skip, take, include: includeUser }),
      prisma.expense.count({ where }),
      prisma.expense.aggregate({ where, _sum: { amount: true } }),
    ]);

    res.json({ ...paged(rows, total, page, pageSize), totals: { amount: dec(sum._sum.amount) } });
  }),
);

// ------------------------------------------------------------------- weekly
router.get(
  '/weekly',
  asyncHandler(async (req, res) => {
    const { from, to } = parseRange(req.query as any);
    const rows = await prisma.expense.findMany({
      where: { date: { gte: from, lte: to } },
      orderBy: { date: 'asc' },
      include: includeUser,
    });

    const buckets = new Map<
      string,
      { week: string; weekStart: string; weekEnd: string; total: number; count: number; byCategory: Record<string, number>; items: typeof rows }
    >();

    for (const row of rows) {
      const key = isoWeekKey(row.date);
      if (!buckets.has(key)) {
        buckets.set(key, {
          week: key,
          weekStart: startOfWeek(row.date).toISOString(),
          weekEnd: endOfWeek(row.date).toISOString(),
          total: 0,
          count: 0,
          byCategory: {},
          items: [] as any,
        });
      }
      const bucket = buckets.get(key)!;
      const amount = dec(row.amount);
      bucket.total += amount;
      bucket.count += 1;
      bucket.byCategory[row.category] = (bucket.byCategory[row.category] ?? 0) + amount;
      bucket.items.push(row as any);
    }

    const weeks = [...buckets.values()].sort((a, b) => (a.week < b.week ? 1 : -1));
    res.json({ weeks, total: weeks.reduce((s, w) => s + w.total, 0), range: { from, to } });
  }),
);

// ------------------------------------------------------------------ monthly
router.get(
  '/monthly',
  asyncHandler(async (req, res) => {
    const months = Math.min(36, Math.max(1, Number((req.query as any).months) || 12));
    const end = endOfMonth();
    const start = startOfMonth(new Date(end.getFullYear(), end.getMonth() - (months - 1), 1));

    const rows = await prisma.expense.findMany({
      where: { date: { gte: start, lte: end } },
      select: { id: true, type: true, category: true, amount: true, date: true, isPaid: true, name: true },
      orderBy: { date: 'asc' },
    });

    const buckets = new Map<
      string,
      { month: string; label: string; daily: number; recurring: number; total: number; count: number; paid: number; pending: number; byCategory: Record<string, number> }
    >();

    for (let i = 0; i < months; i += 1) {
      const d = new Date(end.getFullYear(), end.getMonth() - i, 1);
      buckets.set(monthKey(d), {
        month: monthKey(d),
        label: d.toLocaleString('en-US', { month: 'short', year: 'numeric' }),
        daily: 0,
        recurring: 0,
        total: 0,
        count: 0,
        paid: 0,
        pending: 0,
        byCategory: {},
      });
    }

    for (const row of rows) {
      const bucket = buckets.get(monthKey(row.date));
      if (!bucket) continue;
      const amount = dec(row.amount);
      bucket.total += amount;
      bucket.count += 1;
      if (row.type === 'RECURRING') bucket.recurring += amount;
      else bucket.daily += amount;
      if (row.isPaid) bucket.paid += amount;
      else bucket.pending += amount;
      bucket.byCategory[row.category] = (bucket.byCategory[row.category] ?? 0) + amount;
    }

    res.json({ months: [...buckets.values()].sort((a, b) => (a.month < b.month ? 1 : -1)) });
  }),
);

// --------------------------------------------------------------------- CSV
router.get(
  '/export',
  asyncHandler(async (req, res) => {
    const where = buildWhere(req);
    const rows = await prisma.expense.findMany({ where, orderBy: { date: 'desc' }, include: includeUser });

    const csv = toCsv(
      rows.map((r) => ({
        date: r.date.toISOString().slice(0, 10),
        type: r.type,
        name: r.name,
        description: r.description ?? '',
        category: r.category,
        amount: dec(r.amount).toFixed(2),
        paymentMethod: r.paymentMethod ?? '',
        status: r.isPaid ? 'Paid' : 'Pending',
        dueDate: r.dueDate ? r.dueDate.toISOString().slice(0, 10) : '',
        addedBy: r.addedBy?.username ?? 'system',
      })),
      [
        { key: 'date', label: 'Date' },
        { key: 'type', label: 'Type' },
        { key: 'name', label: 'Name' },
        { key: 'description', label: 'Description' },
        { key: 'category', label: 'Category' },
        { key: 'amount', label: 'Amount' },
        { key: 'paymentMethod', label: 'Payment Method' },
        { key: 'status', label: 'Status' },
        { key: 'dueDate', label: 'Due Date' },
        { key: 'addedBy', label: 'Added By' },
      ],
    );

    await audit(req, 'EXPORT', 'Expense', null, { count: rows.length, filters: req.query });
    sendCsv(res, `voxpact-expenses-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }),
);

// ------------------------------------------------------------------- create
router.post(
  '/',
  receiptUpload.single('receipt'),
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof createSchema>;

    if (body.type === 'RECURRING' && req.user!.role === 'USER') {
      throw ApiError.forbidden('Only administrators can manage recurring expenses');
    }

    const expense = await prisma.expense.create({
      data: {
        type: body.type,
        name: body.name,
        description: body.description || null,
        category: body.category,
        amount: new Prisma.Decimal(body.amount),
        date: body.date,
        dueDate: body.dueDate ?? null,
        paymentMethod: body.paymentMethod || null,
        isPaid: body.isPaid ?? true,
        isRecurring: body.isRecurring ?? body.type === 'RECURRING',
        receiptUrl: req.file ? await saveReceipt(req.file) : null,
        addedById: req.user!.id,
      },
      include: includeUser,
    });

    await audit(req, 'CREATE', 'Expense', expense.id, { name: expense.name, amount: dec(expense.amount), category: expense.category, type: expense.type });
    res.status(201).json({ expense });
  }),
);

// ------------------------------------------------------------------- update
router.patch(
  '/:id',
  receiptUpload.single('receipt'),
  validateBody(updateSchema),
  asyncHandler(async (req, res) => {
    const existing = await prisma.expense.findUnique({ where: { id: param(req, 'id') } });
    if (!existing) throw ApiError.notFound('Expense not found');

    if (req.user!.role === 'USER') {
      if (existing.type === 'RECURRING') throw ApiError.forbidden('Only administrators can edit recurring expenses');
      if (existing.addedById !== req.user!.id) throw ApiError.forbidden('You can only edit entries you added');
    }
    if (existing.sourceType && req.user!.role !== 'HOST') {
      throw ApiError.forbidden(`This entry is generated from ${existing.sourceType} and is managed there`);
    }

    const body = req.body as z.infer<typeof updateSchema>;
    let receiptUrl = existing.receiptUrl;
    if (body.removeReceipt) {
      deleteUpload(existing.receiptUrl);
      receiptUrl = null;
    }
    if (req.file) {
      deleteUpload(existing.receiptUrl);
      receiptUrl = await saveReceipt(req.file);
    }

    const data: Prisma.ExpenseUpdateInput = {
      name: body.name,
      description: body.description === '' ? null : body.description,
      category: body.category,
      amount: body.amount !== undefined ? new Prisma.Decimal(body.amount) : undefined,
      date: body.date,
      dueDate: body.dueDate === undefined ? undefined : body.dueDate,
      paymentMethod: body.paymentMethod === '' ? null : body.paymentMethod,
      isPaid: body.isPaid,
      isRecurring: body.isRecurring,
      receiptUrl,
    };

    const expense = await prisma.expense.update({ where: { id: existing.id }, data, include: includeUser });
    await audit(req, 'UPDATE', 'Expense', expense.id, { name: expense.name, changes: diff(existing as any, expense as any) });
    res.json({ expense });
  }),
);

// -------------------------------------------------------------- toggle paid
router.post(
  '/:id/toggle-paid',
  asyncHandler(async (req, res) => {
    const existing = await prisma.expense.findUnique({ where: { id: param(req, 'id') } });
    if (!existing) throw ApiError.notFound('Expense not found');
    if (req.user!.role === 'USER' && existing.type === 'RECURRING') throw ApiError.forbidden();

    const expense = await prisma.expense.update({
      where: { id: existing.id },
      data: { isPaid: !existing.isPaid },
      include: includeUser,
    });
    await audit(req, 'UPDATE', 'Expense', expense.id, { field: 'isPaid', from: existing.isPaid, to: expense.isPaid });
    res.json({ expense });
  }),
);

// ------------------------------------------------------------------- delete
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const existing = await prisma.expense.findUnique({ where: { id: param(req, 'id') } });
    if (!existing) throw ApiError.notFound('Expense not found');

    if (req.user!.role === 'USER') {
      if (existing.type === 'RECURRING') throw ApiError.forbidden('Only administrators can delete recurring expenses');
      if (existing.addedById !== req.user!.id) throw ApiError.forbidden('You can only delete entries you added');
    }

    deleteUpload(existing.receiptUrl);
    await prisma.expense.delete({ where: { id: existing.id } });
    await audit(req, 'DELETE', 'Expense', existing.id, { name: existing.name, amount: dec(existing.amount), category: existing.category });
    res.json({ ok: true });
  }),
);

// ------------------------------------------------- recurring: roll to next month
router.post(
  '/:id/rollover',
  requireManager,
  asyncHandler(async (req, res) => {
    const source = await prisma.expense.findUnique({ where: { id: param(req, 'id') } });
    if (!source || source.type !== 'RECURRING') throw ApiError.notFound('Recurring expense not found');

    const nextDate = new Date(source.date);
    nextDate.setMonth(nextDate.getMonth() + 1);
    const nextDue = source.dueDate ? new Date(source.dueDate) : null;
    if (nextDue) nextDue.setMonth(nextDue.getMonth() + 1);

    const duplicate = await prisma.expense.findFirst({
      where: {
        type: 'RECURRING',
        name: source.name,
        date: { gte: startOfMonth(nextDate), lte: endOfMonth(nextDate) },
      },
    });
    if (duplicate) throw ApiError.conflict('Next month already has this recurring expense');

    const expense = await prisma.expense.create({
      data: {
        type: 'RECURRING',
        name: source.name,
        description: source.description,
        category: source.category,
        amount: source.amount,
        date: nextDate,
        dueDate: nextDue,
        paymentMethod: source.paymentMethod,
        isPaid: false,
        isRecurring: true,
        addedById: req.user!.id,
      },
      include: includeUser,
    });

    await audit(req, 'CREATE', 'Expense', expense.id, { rolloverFrom: source.id, name: expense.name });
    res.status(201).json({ expense });
  }),
);

export default router;
