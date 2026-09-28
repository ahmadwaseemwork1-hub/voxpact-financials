import type { Request } from 'express';
import { prisma } from '../lib/prisma';

export type AuditAction =
  | 'LOGIN'
  | 'LOGIN_FAILED'
  | 'LOGOUT'
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'EXPORT'
  | 'PASSWORD_CHANGE'
  | 'PASSWORD_RESET';

export function clientIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim();
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}

/**
 * Writes an audit entry. Never throws — auditing must not break a request.
 */
export async function audit(
  req: Request,
  action: AuditAction,
  entityType: string,
  entityId?: string | null,
  details?: Record<string, unknown>,
  overrideUsername?: string,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: req.user?.id ?? null,
        username: overrideUsername ?? req.user?.username ?? 'anonymous',
        role: req.user?.role ?? null,
        action,
        entityType,
        entityId: entityId ?? null,
        details: (details ?? undefined) as any,
        ipAddress: clientIp(req),
        userAgent: String(req.headers['user-agent'] ?? '').slice(0, 300),
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[audit] failed to write entry:', err);
  }
}

/** Convenience for diffing an update in the audit trail. */
export function diff(before: Record<string, any>, after: Record<string, any>) {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(after)) {
    const a = before?.[key];
    const b = after[key];
    const sa = a instanceof Date ? a.toISOString() : a?.toString?.() ?? a;
    const sb = b instanceof Date ? b.toISOString() : b?.toString?.() ?? b;
    if (sa !== sb) changes[key] = { from: sa ?? null, to: sb ?? null };
  }
  return changes;
}
