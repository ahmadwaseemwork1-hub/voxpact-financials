import { Router } from 'express';
import { zEmail } from '../utils/zod';
import { z } from 'zod';
import { Prisma, prisma } from '../lib/prisma';
import { ApiError, asyncHandler, paged, param, parsePaging } from '../utils/http';
import { authenticate, requireManager } from '../middleware/auth';
import { audit } from '../middleware/audit';
import { hashPassword, validatePasswordStrength } from '../utils/password';
import { validateBody } from '../middleware/validate';

const router = Router();
router.use(authenticate, requireManager);

const roleEnum = z.enum(['HOST', 'ADMIN', 'USER']);

const createSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters')
    .max(32)
    .regex(/^[a-zA-Z0-9._-]+$/, 'Only letters, numbers, dot, underscore and hyphen'),
  password: z.string().min(1, 'Password is required'),
  role: roleEnum.default('USER'),
  email: zEmail,
  fullName: z.string().max(120).optional(),
  mustChangePassword: z.boolean().optional().default(false),
});

const updateSchema = z.object({
  role: roleEnum.optional(),
  email: zEmail,
  fullName: z.string().max(120).optional(),
  isActive: z.boolean().optional(),
  mustChangePassword: z.boolean().optional(),
});

/**
 * ADMIN must never learn that HOST accounts exist — every read is filtered and
 * every write to a HOST record answers 404 rather than 403.
 */
function visibilityFilter(role: 'HOST' | 'ADMIN' | 'USER'): Prisma.UserWhereInput {
  return role === 'HOST' ? {} : { role: { in: ['ADMIN', 'USER'] } };
}

function assertCanManage(actorRole: 'HOST' | 'ADMIN' | 'USER', targetRole: 'HOST' | 'ADMIN' | 'USER') {
  if (actorRole === 'HOST') return;
  // ADMIN
  if (targetRole === 'HOST') throw ApiError.notFound('User not found');
  if (targetRole === 'ADMIN') throw ApiError.forbidden('Only a super administrator can manage administrator accounts');
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, pageSize, skip, take } = parsePaging(req.query as any, 25);
    const { search, role, status } = req.query as Record<string, string | undefined>;

    const where: Prisma.UserWhereInput = {
      AND: [
        visibilityFilter(req.user!.role),
        role && role !== 'ALL' ? { role: role as any } : {},
        status === 'ACTIVE' ? { isActive: true } : status === 'INACTIVE' ? { isActive: false } : {},
        search
          ? {
              OR: [
                { username: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { fullName: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {},
      ],
    };

    const [rows, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
        skip,
        take,
        select: {
          id: true,
          username: true,
          role: true,
          email: true,
          fullName: true,
          createdAt: true,
          lastLogin: true,
          isActive: true,
          mustChangePassword: true,
          createdBy: { select: { username: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    res.json(paged(rows, total, page, pageSize));
  }),
);

/** Which roles the current actor is allowed to assign. */
router.get('/assignable-roles', (req, res) => {
  res.json({ roles: req.user!.role === 'HOST' ? ['HOST', 'ADMIN', 'USER'] : ['USER'] });
});

router.post(
  '/',
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof createSchema>;
    assertCanManage(req.user!.role, body.role);

    const errors = validatePasswordStrength(body.password);
    if (errors.length) throw ApiError.badRequest(errors[0], errors);

    const exists = await prisma.user.findUnique({ where: { username: body.username } });
    if (exists) throw ApiError.conflict('That username is already taken');

    const user = await prisma.user.create({
      data: {
        username: body.username,
        passwordHash: await hashPassword(body.password),
        role: body.role,
        email: body.email || null,
        fullName: body.fullName || null,
        mustChangePassword: body.mustChangePassword ?? false,
        createdById: req.user!.id,
      },
      select: { id: true, username: true, role: true, email: true, fullName: true, createdAt: true, isActive: true, lastLogin: true, mustChangePassword: true },
    });

    await audit(req, 'CREATE', 'User', user.id, { username: user.username, role: user.role });
    res.status(201).json({ user });
  }),
);

router.patch(
  '/:id',
  validateBody(updateSchema),
  asyncHandler(async (req, res) => {
    const target = await prisma.user.findUnique({ where: { id: param(req, 'id') } });
    if (!target) throw ApiError.notFound('User not found');
    assertCanManage(req.user!.role, target.role);

    const body = req.body as z.infer<typeof updateSchema>;
    if (body.role) assertCanManage(req.user!.role, body.role);

    if (target.id === req.user!.id && body.isActive === false) {
      throw ApiError.badRequest('You cannot deactivate your own account');
    }
    if (target.role === 'HOST' && body.role && body.role !== 'HOST') {
      const hostCount = await prisma.user.count({ where: { role: 'HOST', isActive: true } });
      if (hostCount <= 1) throw ApiError.badRequest('At least one active super administrator must remain');
    }

    const user = await prisma.user.update({
      where: { id: target.id },
      data: {
        role: body.role,
        email: body.email === '' ? null : body.email,
        fullName: body.fullName,
        isActive: body.isActive,
        mustChangePassword: body.mustChangePassword,
      },
      select: { id: true, username: true, role: true, email: true, fullName: true, createdAt: true, isActive: true, lastLogin: true, mustChangePassword: true },
    });

    await audit(req, 'UPDATE', 'User', user.id, { username: user.username, changes: body });
    res.json({ user });
  }),
);

router.post(
  '/:id/reset-password',
  validateBody(z.object({ newPassword: z.string().min(1), mustChangePassword: z.boolean().optional().default(true) })),
  asyncHandler(async (req, res) => {
    const target = await prisma.user.findUnique({ where: { id: param(req, 'id') } });
    if (!target) throw ApiError.notFound('User not found');
    assertCanManage(req.user!.role, target.role);

    const { newPassword, mustChangePassword } = req.body as { newPassword: string; mustChangePassword: boolean };
    const errors = validatePasswordStrength(newPassword);
    if (errors.length) throw ApiError.badRequest(errors[0], errors);

    await prisma.user.update({
      where: { id: target.id },
      data: { passwordHash: await hashPassword(newPassword), mustChangePassword, failedLoginAttempts: 0 },
    });

    await audit(req, 'PASSWORD_RESET', 'User', target.id, { username: target.username });
    res.json({ ok: true, message: `Password reset for ${target.username}` });
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const target = await prisma.user.findUnique({ where: { id: param(req, 'id') } });
    if (!target) throw ApiError.notFound('User not found');
    assertCanManage(req.user!.role, target.role);

    if (target.id === req.user!.id) throw ApiError.badRequest('You cannot delete your own account');
    if (target.role === 'HOST') {
      const hostCount = await prisma.user.count({ where: { role: 'HOST' } });
      if (hostCount <= 1) throw ApiError.badRequest('The last super administrator cannot be deleted');
    }

    await prisma.user.delete({ where: { id: target.id } });
    await audit(req, 'DELETE', 'User', target.id, { username: target.username, role: target.role });
    res.json({ ok: true });
  }),
);

export default router;
