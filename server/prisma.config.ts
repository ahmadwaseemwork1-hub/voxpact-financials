import 'dotenv/config';
import path from 'node:path';
import { defineConfig, env } from 'prisma/config';

/**
 * Prisma 7 configuration.
 *
 * The connection URL lives here (for the CLI: migrate, db push, studio) and is
 * handed to PrismaClient at runtime through the pg driver adapter — see
 * src/lib/prisma.ts. It is no longer allowed in schema.prisma.
 */
export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  datasource: {
    url: env('DATABASE_URL'),
  },
  migrations: {
    path: path.join('prisma', 'migrations'),
    seed: 'tsx prisma/seed.ts',
  },
});
