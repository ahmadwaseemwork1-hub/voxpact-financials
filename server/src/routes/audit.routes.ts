import { Router } from 'express';
import { Prisma, prisma } from '../lib/prisma';
import { asyncHandler, paged, parsePaging } from '../utils/http';
import { authenticate, requireManager } from '../middleware/auth';
import { audit } from '../middleware/audit';
import { toCsv, sendCsv } from '../utils/csv';
import { startOfDay, endOfDay } from '../utils/dates';

const router = Router();
router.use(authenticate, requireManager);

/** ADMIN must not see that HOST accounts exist, so HOST activity is hidden. */
function visibility(role: string): Prisma.AuditLogWhereInput {
  return role === 'HOST' ? {} : { NOT: { role: 'HOST' } };
}

function buildWhere(req: any): Prisma.AuditLogWhereInput {
  const q = req.query as Record<string, string | undefined>;
  const and: Prisma.AuditLogWhereInput[] = [visibility(req.user.role)];
  if (q.action && q.action !== 'ALL') and.push({ action: q.action });
  if (q.entityType && q.entityType !== 'ALL') and.push({ entityType: q.entityType });
  if (q.userId) and.push({ userId: q.userId });
  if (q.search) {
    and.push({
      OR: [
        { username: { contains: q.search, mode: 'insensitive' } },
        { entityType: { contains: q.search, mode: 'insensitive' } },
        { action: { contains: q.search, mode: 'insensitive' } },
      ],
    });
  }
  if (q.from || q.to) {
    and.push({
      timestamp: {
        ...(q.from ? { gte: startOfDay(q.from) } : {}),
        ...(q.to ? { lte: endOfDay(q.to) } : {}),
      },
    });
  }
  return { AND: and };
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, pageSize, skip, take } = parsePaging(req.query as any, 50);
    const where = buildWhere(req);

    const [rows, total] = await Promise.all([
      prisma.auditLog.findMany({ where, orderBy: { timestamp: 'desc' }, skip, take }),
      prisma.auditLog.count({ where }),
    ]);

    res.json(paged(rows, total, page, pageSize));
  }),
);

router.get(
  '/export',
  asyncHandler(async (req, res) => {
    const where = buildWhere(req);
    const rows = await prisma.auditLog.findMany({ where, orderBy: { timestamp: 'desc' }, take: 10000 });
    const csv = toCsv(
      rows.map((r) => ({
        timestamp: r.timestamp.toISOString(),
        username: r.username,
        role: r.role ?? '',
        action: r.action,
        entityType: r.entityType,
        entityId: r.entityId ?? '',
        ipAddress: r.ipAddress ?? '',
        details: r.details ? JSON.stringify(r.details) : '',
      })),
      [
        { key: 'timestamp', label: 'Timestamp' },
        { key: 'username', label: 'User' },
        { key: 'role', label: 'Role' },
        { key: 'action', label: 'Action' },
        { key: 'entityType', label: 'Entity' },
        { key: 'entityId', label: 'Entity ID' },
        { key: 'ipAddress', label: 'IP Address' },
        { key: 'details', label: 'Details' },
      ],
    );
    await audit(req, 'EXPORT', 'AuditLog', null, { count: rows.length });
    sendCsv(res, `voxpact-audit-log-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }),
);

export default router;
