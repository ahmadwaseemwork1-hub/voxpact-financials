import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import { env } from '../config/env';
import { ApiError } from '../utils/http';

fs.mkdirSync(env.UPLOAD_DIR, { recursive: true });

const ALLOWED = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/heic',
  'application/pdf',
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, env.UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().slice(0, 10);
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
  },
});

export const receiptUpload = multer({
  storage,
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED.has(file.mimetype)) {
      return cb(ApiError.badRequest('Only PNG, JPG, WEBP or PDF receipts are allowed'));
    }
    cb(null, true);
  },
});

export function receiptPublicUrl(filename: string) {
  return `/uploads/${filename}`;
}

export function deleteUpload(url?: string | null) {
  if (!url?.startsWith('/uploads/')) return;
  const filename = path.basename(url);
  fs.promises.unlink(path.join(env.UPLOAD_DIR, filename)).catch(() => undefined);
}
