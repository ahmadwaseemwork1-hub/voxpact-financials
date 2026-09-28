import { Router } from 'express';
import { z } from 'zod';
import { Prisma, prisma, dec } from '../lib/prisma';
import { ApiError, asyncHandler, paged, param, parsePaging } from '../utils/http';
import { authenticate, requireManager } from '../middleware/auth';
import { audit, diff } from '../middleware/audit';
import { validateBody } from '../middleware/validate';
import { zNullableDate, zPositiveMoney, zText } from '../utils/zod';
import { toCsv, sendCsv } from '../utils/csv';
import { startOfDay, endOfDay, addDays, monthKey, startOfMonth, endOfMonth } from '../utils/dates';
import { getSetting } from '../lib/settings';

const router = Router();
router.use(authenticate);

const includeUser = { addedBy: { select: { id: true, username: true, fullName: true } } } as const;

const createSchema = z.object({
  clientName: z.string().trim().min(1, 'Client or source is required').max(160),
  source: zText(120),
  description: zText(500),
  amount: zPositiveMoney,
  projectedDate: z.coerce.date({ error: 'Enter a valid projected date' }),
  receivedDate: zNullableDate.optional(),
  receivedAmount: z.coerce.number().min(0).optional().nullable(),
  status: z.enum(['PROJECTED', 'RECEIVED']).default('PROJECTED'),
});

const updateSchema = createSchema.partial();

/** Revenue is read-only for the USER role. */
const requireWrite = requireManager;

function buildWhere(req: any): Prisma.RevenueWhereInput {
  const q = req.query as Record<string, string | undefined>;
  const and: Prisma.RevenueWhereInput[] = [];
  if (q.status && ['PROJECTED', 'RECEIVED'].includes(q.status)) and.push({ status: q.status as any });
  if (q.search) {
    and.push({
      OR: [
        { clientName: { contains: q.search, mode: 'insensitive' } },
        { source: { contains: q.search, mode: 'insensitive' } },
        { description: { contains: q.search, mode: 'insensitive' } },
      ],
    });
  }
  if (q.from || q.to) {
    and.push({
      projectedDate: {
        ...(q.from ? { gte: startOfDay(q.from) } : {}),
        ...(q.to ? { lte: endOfDay(q.to) } : {}),
      },
    });
  }
  return and.length ? { AND: and } : {};
}

function decorate(row: any, graceDays: number) {
  const isOverdue =
    row.status === 'PROJECTED' && new Date(row.projectedDate) < addDays(new Date(), -graceDays);
  const daysLate = isOverdue
    ? Math.floor((Date.now() - new Date(row.projectedDate).getTime()) / 86_400_000)
    : 0;
  return { ...row, isOverdue, daysLate, displayStatus: isOverdue ? 'OVERDUE' : row.status };
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, pageSize, skip, take } = parsePaging(req.query as any, 50);
    const where = buildWhere(req);
    const graceDays = Number(await getSetting<number>('overdueGraceDays')) || 0;

    const [rows, total, projectedSum, receivedSum] = await Promise.all([
      prisma.revenue.findMany({ where, orderBy: [{ projectedDate: 'desc' }], skip, take, include: includeUser }),
      prisma.revenue.count({ where }),
      prisma.revenue.aggregate({ where, _sum: { amount: true } }),
      prisma.revenue.aggregate({ where: { AND: [where, { status: 'RECEIVED' }] }, _sum: { receivedAmount: true, amount: true } }),
    ]);

    let decorated = rows.map((r) => decorate(r, graceDays));
    if ((req.query as any).status === 'OVERDUE') decorated = decorated.filter((r) => r.isOverdue);

    const projected = dec(projectedSum._sum.amount);
    const received = dec(receivedSum._sum.receivedAmount) || dec(receivedSum._sum.amount);

    res.json({
      ...paged(decorated, total, page, pageSize),
      totals: {
        projected,
        received,
        outstanding: Math.max(0, projected - received),
        accuracy: projected > 0 ? Number(((received / projected) * 100).toFixed(1)) : 0,
      },
    });
  }),
);

/** Monthly projected vs received series for charts. */
router.get(
  '/trends',
  asyncHandler(async (req, res) => {
    const months = Math.min(36, Math.max(1, Number((req.query as any).months) || 12));
    const end = endOfMonth();
    const start = startOfMonth(new Date(end.getFullYear(), end.getMonth() - (months - 1), 1));

    const rows = await prisma.revenue.findMany({
      where: { OR: [{ projectedDate: { gte: start, lte: end } }, { receivedDate: { gte: start, lte: end } }] },
      select: { amount: true, receivedAmount: true, projectedDate: true, receivedDate: true, status: true },
    });

    const buckets = new Map<string, { month: string; label: string; projected: number; received: number }>();
    for (let i = months - 1; i >= 0; i -= 1) {
      const d = new Date(end.getFullYear(), end.getMonth() - i, 1);
      buckets.set(monthKey(d), { month: monthKey(d), label: d.toLocaleString('en-US', { month: 'short' }), projected: 0, received: 0 });
    }

    for (const row of rows) {
      const p = buckets.get(monthKey(row.projectedDate));
      if (p) p.projected += dec(row.amount);
      if (row.receivedDate) {
        const r = buckets.get(monthKey(row.receivedDate));
        if (r) r.received += dec(row.receivedAmount ?? row.amount);
      }
    }

    res.json({ months: [...buckets.values()] });
  }),
);

router.get(
  '/export',
  asyncHandler(async (req, res) => {
    const where = buildWhere(req);
    const graceDays = Number(await getSetting<number>('overdueGraceDays')) || 0;
    const rows = await prisma.revenue.findMany({ where, orderBy: { projectedDate: 'desc' }, include: includeUser });

    const csv = toCsv(
      rows.map((r) => {
        const d = decorate(r, graceDays);
        return {
          clientName: r.clientName,
          source: r.source ?? '',
          amount: dec(r.amount).toFixed(2),
          projectedDate: r.projectedDate.toISOString().slice(0, 10),
          receivedDate: r.receivedDate ? r.receivedDate.toISOString().slice(0, 10) : '',
          receivedAmount: r.receivedAmount ? dec(r.receivedAmount).toFixed(2) : '',
          status: d.displayStatus,
          addedBy: r.addedBy?.username ?? '',
        };
      }),
      [
        { key: 'clientName', label: 'Client / Source' },
        { key: 'source', label: 'Channel' },
        { key: 'amount', label: 'Projected Amount' },
        { key: 'projectedDate', label: 'Projected Date' },
        { key: 'receivedAmount', label: 'Received Amount' },
        { key: 'receivedDate', label: 'Received Date' },
        { key: 'status', label: 'Status' },
        { key: 'addedBy', label: 'Added By' },
      ],
    );

    await audit(req, 'EXPORT', 'Revenue', null, { count: rows.length });
    sendCsv(res, `voxpact-revenue-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }),
);

router.post(
  '/',
  requireWrite,
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof createSchema>;
    const isReceived = body.status === 'RECEIVED';

    const revenue = await prisma.revenue.create({
      data: {
        clientName: body.clientName,
        source: body.source || null,
        description: body.description || null,
        amount: new Prisma.Decimal(body.amount),
        projectedDate: body.projectedDate,
        receivedDate: isReceived ? body.receivedDate ?? new Date() : body.receivedDate ?? null,
        receivedAmount:
          isReceived ? new Prisma.Decimal(body.receivedAmount ?? body.amount) : body.receivedAmount != null ? new Prisma.Decimal(body.receivedAmount) : null,
        status: body.status,
        addedById: req.user!.id,
      },
      include: includeUser,
    });

    await audit(req, 'CREATE', 'Revenue', revenue.id, { clientName: revenue.clientName, amount: dec(revenue.amount), status: revenue.status });
    res.status(201).json({ revenue });
  }),
);

router.patch(
  '/:id',
  requireWrite,
  validateBody(updateSchema),
  asyncHandler(async (req, res) => {
    const existing = await prisma.revenue.findUnique({ where: { id: param(req, 'id') } });
    if (!existing) throw ApiError.notFound('Revenue entry not found');
    const body = req.body as z.infer<typeof updateSchema>;

    const revenue = await prisma.revenue.update({
      where: { id: existing.id },
      data: {
        clientName: body.clientName,
        source: body.source === '' ? null : body.source,
        description: body.description === '' ? null : body.description,
        amount: body.amount !== undefined ? new Prisma.Decimal(body.amount) : undefined,
        projectedDate: body.projectedDate,
        receivedDate: body.receivedDate === undefined ? undefined : body.receivedDate,
        receivedAmount:
          body.receivedAmount === undefined ? undefined : body.receivedAmount === null ? null : new Prisma.Decimal(body.receivedAmount),
        status: body.status,
      },
      include: includeUser,
    });

    await audit(req, 'UPDATE', 'Revenue', revenue.id, { clientName: revenue.clientName, changes: diff(existing as any, revenue as any) });
    res.json({ revenue });
  }),
);

/** Mark a projected entry as received. */
router.post(
  '/:id/receive',
  requireWrite,
  validateBody(
    z.object({
      receivedAmount: z.coerce.number().positive().optional(),
      receivedDate: z.coerce.date().optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const existing = await prisma.revenue.findUnique({ where: { id: param(req, 'id') } });
    if (!existing) throw ApiError.notFound('Revenue entry not found');
    if (existing.status === 'RECEIVED') throw ApiError.badRequest('This entry is already marked as received');

    const { receivedAmount, receivedDate } = req.body as { receivedAmount?: number; receivedDate?: Date };

    const revenue = await prisma.revenue.update({
      where: { id: existing.id },
      data: {
        status: 'RECEIVED',
        receivedDate: receivedDate ?? new Date(),
        receivedAmount: new Prisma.Decimal(receivedAmount ?? dec(existing.amount)),
      },
      include: includeUser,
    });

    await audit(req, 'UPDATE', 'Revenue', revenue.id, { action: 'mark_received', amount: dec(revenue.receivedAmount) });
    res.json({ revenue });
  }),
);

router.delete(
  '/:id',
  requireWrite,
  asyncHandler(async (req, res) => {
    const existing = await prisma.revenue.findUnique({ where: { id: param(req, 'id') } });
    if (!existing) throw ApiError.notFound('Revenue entry not found');
    await prisma.revenue.delete({ where: { id: existing.id } });
    await audit(req, 'DELETE', 'Revenue', existing.id, { clientName: existing.clientName, amount: dec(existing.amount) });
    res.json({ ok: true });
  }),
);

export default router;
