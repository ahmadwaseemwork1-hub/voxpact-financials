import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';

/** Validates and REPLACES req.body with the parsed (sanitised) result. */
export const validateBody =
  (schema: ZodType) => (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) return next(result.error);
    req.body = result.data;
    next();
  };

/**
 * Validates query params. Express 5 exposes `req.query` as a getter-only
 * accessor, so the parsed result is stashed on `res.locals.query` rather than
 * written back onto the request.
 */
export const validateQuery =
  (schema: ZodType) => (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) return next(result.error);
    res.locals.query = result.data;
    next();
  };

/** Strips angle brackets + control chars from every string in the body. */
export function sanitizeBody(req: Request, _res: Response, next: NextFunction) {
  const clean = (value: unknown): unknown => {
    if (typeof value === 'string') {
      // eslint-disable-next-line no-control-regex
      return value.replace(/[\u0000-\u001F\u007F]/g, '').replace(/<\/?[^>]*>/g, '').trim();
    }
    if (Array.isArray(value)) return value.map(clean);
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = clean(v);
      return out;
    }
    return value;
  };
  if (req.body && typeof req.body === 'object') req.body = clean(req.body) as any;
  next();
}
