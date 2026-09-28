import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { env } from '../config/env';

/**
 * 5 failed sign-ins per 15 minutes, keyed by IP + username.
 *
 * `ipKeyGenerator` normalises IPv6 to its /64 prefix — without it a single
 * user could rotate addresses inside their own subnet and walk past the limit.
 */
export const loginLimiter = rateLimit({
  windowMs: env.LOGIN_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
  limit: env.LOGIN_RATE_LIMIT_MAX,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) =>
    `${ipKeyGenerator(req.ip ?? '')}:${String((req.body as { username?: string } | undefined)?.username ?? '').toLowerCase()}`,
  message: {
    error: `Too many failed sign-in attempts. Try again in ${env.LOGIN_RATE_LIMIT_WINDOW_MINUTES} minutes.`,
    code: 'RATE_LIMITED',
  },
});

/** Broad protection for the rest of the API. */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: env.isProd ? 300 : 2000,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.', code: 'RATE_LIMITED' },
});
