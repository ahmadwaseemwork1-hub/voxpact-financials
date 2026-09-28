import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Prisma } from '../generated/prisma/client';
import { env } from '../config/env';

/**
 * Prisma 7 talks to PostgreSQL through a driver adapter (node-postgres) rather
 * than a bundled Rust engine — the connection string is supplied here, not in
 * schema.prisma.
 */
const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

// Decimal -> plain number when serialised to JSON, so the API always returns
// numeric amounts instead of `{ s, e, d }` objects.
(Prisma.Decimal.prototype as unknown as { toJSON(): number }).toJSON = function toJSON(this: Prisma.Decimal) {
  return Number(this.toString());
};

declare global {
  // eslint-disable-next-line no-var
  var __voxpactPrisma: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  global.__voxpactPrisma ??
  new PrismaClient({
    adapter,
    log: env.isProd ? ['error'] : ['warn', 'error'],
  });

if (!env.isProd) global.__voxpactPrisma = prisma;

export { Prisma };

/** Decimal -> number helper for server side maths. */
export const dec = (value: Prisma.Decimal | number | null | undefined): number =>
  value === null || value === undefined ? 0 : Number(value.toString());
