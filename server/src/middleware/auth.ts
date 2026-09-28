import type { NextFunction, Request, Response } from 'express';
import type { Role } from '../generated/prisma/client';
import { prisma } from '../lib/prisma';
import { verifyToken } from '../utils/jwt';
import { ApiError, asyncHandler } from '../utils/http';

export interface AuthUser {
  id: string;
  username: string;
  role: Role;
  email: string | null;
  fullName: string | null;
  mustChangePassword: boolean;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const ROLE_RANK: Record<Role, number> = { USER: 1, ADMIN: 2, HOST: 3 } as const;

export const rank = (role: Role) => ROLE_RANK[role];

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7).trim();
  if (typeof req.query.token === 'string' && req.query.token) return req.query.token;
  return null;
}

/** Requires a valid, non-expired JWT belonging to an active user. */
export const authenticate = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const token = extractToken(req);
  if (!token) throw ApiError.unauthorized('Authentication token missing');

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    throw ApiError.unauthorized('Session expired or invalid. Please sign in again.');
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) throw ApiError.unauthorized('Account no longer exists');
  if (!user.isActive) throw ApiError.forbidden('This account has been deactivated');

  req.user = {
    id: user.id,
    username: user.username,
    role: user.role,
    email: user.email,
    fullName: user.fullName,
    mustChangePassword: user.mustChangePassword,
  };
  next();
});

/** Allow only the listed roles. */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) return next(ApiError.forbidden());
    next();
  };
}

/** HOST or ADMIN. */
export const requireManager = requireRole('HOST', 'ADMIN');
/** HOST only. */
export const requireHost = requireRole('HOST');

/**
 * Financial modules (partners, salaries, profit distribution, reports) are
 * invisible to the USER role.
 */
export const requireFinancialAccess = requireManager;

/** True when the viewer is allowed to know HOST accounts exist. */
export const canSeeHosts = (role: Role) => role === 'HOST';
