import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '../generated/prisma/client';
import { ZodError } from 'zod';
import multer from 'multer';
import { ApiError } from '../utils/http';
import { env } from '../config/env';

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction) {
  next(ApiError.notFound('Endpoint not found'));
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: err.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    });
  }

  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.message, code: `UPLOAD_${err.code}` });
  }

  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: err.message, code: err.code, details: err.details });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = (err.meta?.target as string[] | undefined)?.join(', ') ?? 'field';
      return res.status(409).json({ error: `That ${target} is already taken`, code: 'DUPLICATE' });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Record not found', code: 'NOT_FOUND' });
    }
    if (err.code === 'P2003') {
      return res.status(409).json({ error: 'Record is referenced by other data', code: 'FK_CONSTRAINT' });
    }
  }

  // eslint-disable-next-line no-console
  console.error('[error]', err);
  return res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL',
    ...(env.isProd ? {} : { detail: err instanceof Error ? err.message : String(err) }),
  });
}
