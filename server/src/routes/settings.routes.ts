import { Router } from 'express';
import { zEmail } from '../utils/zod';
import { z } from 'zod';
import { asyncHandler } from '../utils/http';
import { authenticate, requireManager } from '../middleware/auth';
import { audit } from '../middleware/audit';
import { validateBody } from '../middleware/validate';
import { getSettings, setSetting } from '../lib/settings';
import { env } from '../config/env';

const router = Router();
router.use(authenticate);

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const settings = await getSettings();
    res.json({ settings, inactivityTimeoutMinutes: env.INACTIVITY_TIMEOUT_MINUTES });
  }),
);

const settingsSchema = z.object({
  company: z
    .object({
      name: z.string().max(120).optional(),
      legalName: z.string().max(160).optional(),
      address: z.string().max(240).optional(),
      email: zEmail,
      tagline: z.string().max(160).optional(),
    })
    .optional(),
  currency: z.string().min(1).max(8).optional(),
  dailyBudget: z.coerce.number().min(0).optional(),
  overdueGraceDays: z.coerce.number().int().min(0).max(365).optional(),
  categories: z.array(z.string().min(1).max(60)).max(80).optional(),
  paymentMethods: z.array(z.string().min(1).max(60)).max(40).optional(),
});

router.put(
  '/',
  requireManager,
  validateBody(settingsSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof settingsSchema>;
    for (const [key, value] of Object.entries(body)) {
      if (value !== undefined) await setSetting(key, value);
    }
    await audit(req, 'UPDATE', 'Setting', null, { keys: Object.keys(body) });
    res.json({ settings: await getSettings() });
  }),
);

export default router;
