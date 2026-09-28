import { Router } from 'express';
import { zEmail, zText } from '../utils/zod';
import { z } from 'zod';
import { Prisma, prisma, dec } from '../lib/prisma';
import { ApiError, asyncHandler, param } from '../utils/http';
import { authenticate, requireFinancialAccess } from '../middleware/auth';
import { audit, diff } from '../middleware/audit';
import { validateBody } from '../middleware/validate';
import { getSetting, setSetting } from '../lib/settings';
import { toCsv, sendCsv } from '../utils/csv';

const router = Router();
// Profit distribution is never visible to the USER role.
router.use(authenticate, requireFinancialAccess);

const partnerSchema = z.object({
  name: z.string().trim().min(1, 'Partner name is required').max(120),
  email: zEmail,
  percentage: z.coerce.number().min(0, 'Percentage cannot be negative').max(100, 'Percentage cannot exceed 100'),
  notes: zText(500),
  paymentStatus: z.enum(['PENDING', 'PAID']).optional(),
});

async function buildDistribution(profitOverride?: number) {
  const partners = await prisma.partner.findMany({ orderBy: [{ percentage: 'desc' }, { name: 'asc' }] });
  const storedProfit = Number(await getSetting<number>('distributableProfit')) || 0;
  const profit = profitOverride ?? storedProfit;
  const totalPercentage = partners.reduce((sum, p) => sum + dec(p.percentage), 0);

  const rows = partners.map((p) => {
    const percentage = dec(p.percentage);
    return {
      ...p,
      percentage,
      shareAmount: Number(((profit * percentage) / 100).toFixed(2)),
    };
  });

  return {
    partners: rows,
    profit,
    totalPercentage: Number(totalPercentage.toFixed(3)),
    remainingPercentage: Number((100 - totalPercentage).toFixed(3)),
    isValid: Math.abs(totalPercentage - 100) < 0.001,
    totalDistributed: Number(rows.reduce((s, r) => s + r.shareAmount, 0).toFixed(2)),
    paidAmount: Number(rows.filter((r) => r.paymentStatus === 'PAID').reduce((s, r) => s + r.shareAmount, 0).toFixed(2)),
  };
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const override = req.query.profit !== undefined ? Number(req.query.profit) : undefined;
    res.json(await buildDistribution(Number.isFinite(override) ? override : undefined));
  }),
);

/** Persist the profit figure being distributed. */
router.put(
  '/profit',
  validateBody(z.object({ profit: z.coerce.number().min(0, 'Profit cannot be negative') })),
  asyncHandler(async (req, res) => {
    const { profit } = req.body as { profit: number };
    await setSetting('distributableProfit', profit);
    await audit(req, 'UPDATE', 'PartnerDistribution', null, { profit });
    res.json(await buildDistribution(profit));
  }),
);

router.post(
  '/',
  validateBody(partnerSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof partnerSchema>;
    const current = await prisma.partner.aggregate({ _sum: { percentage: true } });
    if (dec(current._sum.percentage) + body.percentage > 100.001) {
      throw ApiError.badRequest(
        `Total ownership would exceed 100% (currently ${dec(current._sum.percentage)}%, ${(100 - dec(current._sum.percentage)).toFixed(2)}% available)`,
      );
    }

    const partner = await prisma.partner.create({
      data: {
        name: body.name,
        email: body.email || null,
        percentage: new Prisma.Decimal(body.percentage),
        notes: body.notes || null,
        paymentStatus: body.paymentStatus ?? 'PENDING',
      },
    });

    await audit(req, 'CREATE', 'Partner', partner.id, { name: partner.name, percentage: dec(partner.percentage) });
    res.status(201).json({ partner, distribution: await buildDistribution() });
  }),
);

router.patch(
  '/:id',
  validateBody(partnerSchema.partial()),
  asyncHandler(async (req, res) => {
    const existing = await prisma.partner.findUnique({ where: { id: param(req, 'id') } });
    if (!existing) throw ApiError.notFound('Partner not found');
    const body = req.body as Partial<z.infer<typeof partnerSchema>>;

    if (body.percentage !== undefined) {
      const others = await prisma.partner.aggregate({ where: { id: { not: existing.id } }, _sum: { percentage: true } });
      if (dec(others._sum.percentage) + body.percentage > 100.001) {
        throw ApiError.badRequest(
          `Total ownership would exceed 100% (${(100 - dec(others._sum.percentage)).toFixed(2)}% available for this partner)`,
        );
      }
    }

    const partner = await prisma.partner.update({
      where: { id: existing.id },
      data: {
        name: body.name,
        email: body.email === '' ? null : body.email,
        percentage: body.percentage !== undefined ? new Prisma.Decimal(body.percentage) : undefined,
        notes: body.notes === '' ? null : body.notes,
        paymentStatus: body.paymentStatus,
      },
    });

    await audit(req, 'UPDATE', 'Partner', partner.id, { name: partner.name, changes: diff(existing as any, partner as any) });
    res.json({ partner, distribution: await buildDistribution() });
  }),
);

router.post(
  '/:id/toggle-paid',
  asyncHandler(async (req, res) => {
    const existing = await prisma.partner.findUnique({ where: { id: param(req, 'id') } });
    if (!existing) throw ApiError.notFound('Partner not found');
    const partner = await prisma.partner.update({
      where: { id: existing.id },
      data: { paymentStatus: existing.paymentStatus === 'PAID' ? 'PENDING' : 'PAID' },
    });
    await audit(req, 'UPDATE', 'Partner', partner.id, { field: 'paymentStatus', to: partner.paymentStatus });
    res.json({ partner, distribution: await buildDistribution() });
  }),
);

/** Reset every partner back to pending — used when starting a new payout cycle. */
router.post(
  '/reset-payments',
  asyncHandler(async (req, res) => {
    await prisma.partner.updateMany({ data: { paymentStatus: 'PENDING' } });
    await audit(req, 'UPDATE', 'PartnerDistribution', null, { action: 'reset_payments' });
    res.json(await buildDistribution());
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const existing = await prisma.partner.findUnique({ where: { id: param(req, 'id') } });
    if (!existing) throw ApiError.notFound('Partner not found');
    await prisma.partner.delete({ where: { id: existing.id } });
    await audit(req, 'DELETE', 'Partner', existing.id, { name: existing.name, percentage: dec(existing.percentage) });
    res.json({ ok: true, distribution: await buildDistribution() });
  }),
);

router.get(
  '/export',
  asyncHandler(async (req, res) => {
    const distribution = await buildDistribution();
    const csv = toCsv(
      distribution.partners.map((p) => ({
        name: p.name,
        email: p.email ?? '',
        percentage: p.percentage.toFixed(2),
        shareAmount: p.shareAmount.toFixed(2),
        paymentStatus: p.paymentStatus,
      })),
      [
        { key: 'name', label: 'Partner' },
        { key: 'email', label: 'Email' },
        { key: 'percentage', label: 'Percentage (%)' },
        { key: 'shareAmount', label: 'Share Amount' },
        { key: 'paymentStatus', label: 'Payment Status' },
      ],
    );
    await audit(req, 'EXPORT', 'Partner', null, { profit: distribution.profit });
    sendCsv(res, `voxpact-partner-distribution-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }),
);

export default router;
