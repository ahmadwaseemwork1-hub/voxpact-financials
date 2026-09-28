import 'dotenv/config';
import path from 'path';

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  const parsed = raw === undefined ? NaN : Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const NODE_ENV = process.env.NODE_ENV ?? 'development';

export const env = {
  NODE_ENV,
  isProd: NODE_ENV === 'production',
  PORT: num('PORT', 4000),

  DATABASE_URL: required('DATABASE_URL', 'postgresql://voxpact:voxpact_local_pw@localhost:5432/voxpact_financials?schema=public'),

  JWT_SECRET: required('JWT_SECRET', NODE_ENV === 'production' ? undefined : 'dev-only-insecure-secret-change-me'),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? '24h',

  BCRYPT_ROUNDS: Math.max(10, num('BCRYPT_ROUNDS', 12)),
  INACTIVITY_TIMEOUT_MINUTES: num('INACTIVITY_TIMEOUT_MINUTES', 30),

  LOGIN_RATE_LIMIT_MAX: num('LOGIN_RATE_LIMIT_MAX', 5),
  LOGIN_RATE_LIMIT_WINDOW_MINUTES: num('LOGIN_RATE_LIMIT_WINDOW_MINUTES', 15),

  CORS_ORIGIN: (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  UPLOAD_DIR: path.resolve(process.cwd(), process.env.UPLOAD_DIR ?? 'uploads'),
  MAX_UPLOAD_MB: num('MAX_UPLOAD_MB', 10),

  DEFAULT_DAILY_BUDGET: num('DEFAULT_DAILY_BUDGET', 20000),
  CURRENCY: process.env.CURRENCY ?? 'USD',
};

if (env.isProd && env.JWT_SECRET.includes('change-me')) {
  throw new Error('Refusing to start in production with the default JWT_SECRET. Set a strong JWT_SECRET.');
}
