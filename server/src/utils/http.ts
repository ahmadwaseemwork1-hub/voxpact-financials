import type { NextFunction, Request, Response } from 'express';

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, message: string, code = 'ERROR', details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(msg = 'Bad request', details?: unknown) {
    return new ApiError(400, msg, 'BAD_REQUEST', details);
  }
  static unauthorized(msg = 'Not authenticated') {
    return new ApiError(401, msg, 'UNAUTHORIZED');
  }
  static forbidden(msg = 'You do not have permission to perform this action') {
    return new ApiError(403, msg, 'FORBIDDEN');
  }
  static notFound(msg = 'Not found') {
    return new ApiError(404, msg, 'NOT_FOUND');
  }
  static conflict(msg = 'Conflict') {
    return new ApiError(409, msg, 'CONFLICT');
  }
  static tooMany(msg = 'Too many requests') {
    return new ApiError(429, msg, 'RATE_LIMITED');
  }
}

/** Wraps an async route handler so rejected promises reach the error middleware. */
export const asyncHandler =
  <T extends Request>(fn: (req: T, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req as T, res, next)).catch(next);
  };

/**
 * Express 5 types route params as `string | string[]` because path-to-regexp v8
 * allows repeated segments. Every route here expects a single value.
 */
export function param(req: Request, name: string): string {
  const value = (req.params as Record<string, string | string[] | undefined>)[name];
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

/** Parse `?page=&pageSize=` with sane bounds. */
export function parsePaging(query: Record<string, unknown>, defaultSize = 50) {
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(500, Math.max(1, Number(query.pageSize) || defaultSize));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

export function paged<T>(data: T[], total: number, page: number, pageSize: number) {
  return {
    data,
    meta: {
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}
