import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import type { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import { ApiError, param } from '../utils/http';

/**
 * Receipts are stored in PostgreSQL (receipt_files), not on local disk, so they
 * survive redeploys on hosts with an ephemeral filesystem. Files uploaded to
 * disk by older builds are still served from UPLOAD_DIR (see app.ts).
 */
fs.mkdirSync(env.UPLOAD_DIR, { recursive: true });

const ALLOWED = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/heic',
  'application/pdf',
]);

export const receiptUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED.has(file.mimetype)) {
      return cb(ApiError.badRequest('Only PNG, JPG, WEBP or PDF receipts are allowed'));
    }
    cb(null, true);
  },
});

/** Persist an uploaded receipt and return its public URL. */
export async function saveReceipt(file: Express.Multer.File): Promise<string> {
  const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 10);
  const id = `${Date.now()}-${crypto.randomBytes(16).toString('hex')}${ext}`;
  await prisma.receiptFile.create({
    data: { id, mimeType: file.mimetype, size: file.size, data: new Uint8Array(file.buffer) },
  });
  return `/uploads/${id}`;
}

export function deleteUpload(url?: string | null) {
  if (!url?.startsWith('/uploads/')) return;
  const filename = path.basename(url);
  prisma.receiptFile.deleteMany({ where: { id: filename } }).catch(() => undefined);
  // files written to disk by builds before receipts moved into the database
  fs.promises.unlink(path.join(env.UPLOAD_DIR, filename)).catch(() => undefined);
}

/** GET /uploads/:file — streams a receipt stored in the database. */
export async function serveReceipt(req: Request, res: Response, next: NextFunction) {
  const file = await prisma.receiptFile.findUnique({ where: { id: param(req, 'file') } });
  if (!file) return next();
  const body = Buffer.from(file.data);
  res.set({
    'Content-Type': file.mimeType,
    'Content-Length': String(body.length),
    'Content-Disposition': 'inline',
    'Cache-Control': 'private, max-age=604800',
  });
  res.end(body);
}
