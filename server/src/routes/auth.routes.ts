import { Router } from 'express';
import { zEmail } from '../utils/zod';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { env } from '../config/env';
import { ApiError, asyncHandler } from '../utils/http';
import { comparePassword, hashPassword, validatePasswordStrength, PASSWORD_POLICY } from '../utils/password';
import { signToken } from '../utils/jwt';
import { authenticate } from '../middleware/auth';
import { audit, clientIp } from '../middleware/audit';
import { loginLimiter } from '../middleware/rateLimit';
import { validateBody } from '../middleware/validate';

const router = Router();

const loginSchema = z.object({
  username: z.string().trim().min(1, 'Username is required').max(64),
  password: z.string().min(1, 'Password is required').max(200),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(1, 'New password is required'),
});

/** Public config the login screen needs (password rules, inactivity timeout). */
router.get('/config', (_req, res) => {
  res.json({
    passwordPolicy: PASSWORD_POLICY,
    inactivityTimeoutMinutes: env.INACTIVITY_TIMEOUT_MINUTES,
    currency: env.CURRENCY,
  });
});

router.post(
  '/login',
  loginLimiter,
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { username, password } = req.body as z.infer<typeof loginSchema>;
    const ip = clientIp(req);

    const user = await prisma.user.findUnique({ where: { username } });

    const fail = async (reason: string) => {
      await prisma.loginAttempt.create({ data: { username, ipAddress: ip, success: false, reason } });
      await audit(req, 'LOGIN_FAILED', 'Auth', user?.id ?? null, { username, reason }, username);
      throw ApiError.unauthorized('Invalid username or password');
    };

    if (!user) await fail('unknown_user');
    if (!user!.isActive) {
      await prisma.loginAttempt.create({ data: { username, ipAddress: ip, success: false, reason: 'inactive' } });
      await audit(req, 'LOGIN_FAILED', 'Auth', user!.id, { username, reason: 'inactive' }, username);
      throw ApiError.forbidden('This account has been deactivated. Contact an administrator.');
    }

    const ok = await comparePassword(password, user!.passwordHash);
    if (!ok) {
      await prisma.user.update({
        where: { id: user!.id },
        data: { failedLoginAttempts: { increment: 1 } },
      });
      await fail('bad_password');
    }

    const updated = await prisma.user.update({
      where: { id: user!.id },
      data: { lastLogin: new Date(), failedLoginAttempts: 0 },
    });

    await prisma.loginAttempt.create({ data: { username, ipAddress: ip, success: true } });

    const token = signToken({ sub: updated.id, username: updated.username, role: updated.role });

    req.user = {
      id: updated.id,
      username: updated.username,
      role: updated.role,
      email: updated.email,
      fullName: updated.fullName,
      mustChangePassword: updated.mustChangePassword,
    };
    await audit(req, 'LOGIN', 'Auth', updated.id, { username });

    res.json({
      token,
      expiresInHours: 24,
      inactivityTimeoutMinutes: env.INACTIVITY_TIMEOUT_MINUTES,
      user: {
        id: updated.id,
        username: updated.username,
        role: updated.role,
        email: updated.email,
        fullName: updated.fullName,
        lastLogin: updated.lastLogin,
        mustChangePassword: updated.mustChangePassword,
      },
    });
  }),
);

router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        username: true,
        role: true,
        email: true,
        fullName: true,
        lastLogin: true,
        createdAt: true,
        mustChangePassword: true,
      },
    });
    res.json({ user, inactivityTimeoutMinutes: env.INACTIVITY_TIMEOUT_MINUTES });
  }),
);

router.post(
  '/logout',
  authenticate,
  asyncHandler(async (req, res) => {
    await audit(req, 'LOGOUT', 'Auth', req.user!.id);
    res.json({ ok: true });
  }),
);

router.post(
  '/change-password',
  authenticate,
  validateBody(changePasswordSchema),
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body as z.infer<typeof changePasswordSchema>;

    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) throw ApiError.notFound('Account not found');

    if (!(await comparePassword(currentPassword, user.passwordHash))) {
      throw ApiError.badRequest('Current password is incorrect');
    }
    if (await comparePassword(newPassword, user.passwordHash)) {
      throw ApiError.badRequest('New password must be different from the current password');
    }

    const errors = validatePasswordStrength(newPassword);
    if (errors.length) throw ApiError.badRequest(errors[0], errors);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(newPassword), mustChangePassword: false },
    });

    await audit(req, 'PASSWORD_CHANGE', 'User', user.id, { self: true });
    res.json({ ok: true, message: 'Password updated' });
  }),
);

/** Update own profile (email / full name). */
router.patch(
  '/profile',
  authenticate,
  validateBody(
    z.object({
      email: zEmail,
      fullName: z.string().max(120).optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const { email, fullName } = req.body as { email?: string; fullName?: string };
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { email: email === '' ? null : email, fullName },
      select: { id: true, username: true, role: true, email: true, fullName: true, lastLogin: true, mustChangePassword: true },
    });
    await audit(req, 'UPDATE', 'User', user.id, { self: true, fields: ['email', 'fullName'] });
    res.json({ user });
  }),
);

export default router;
