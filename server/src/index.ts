import { createApp } from './app';
import { env } from './config/env';
import { prisma } from './lib/prisma';

async function bootstrap() {
  try {
    await prisma.$connect();
    // eslint-disable-next-line no-console
    console.log('✓ Database connected');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('✖ Could not connect to the database. Check DATABASE_URL.\n', err);
    process.exit(1);
  }

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`\n  Voxpact Financials API`);
    console.log(`  ▸ http://localhost:${env.PORT}/api/health`);
    console.log(`  ▸ env: ${env.NODE_ENV}\n`);
  });

  const shutdown = async (signal: string) => {
    // eslint-disable-next-line no-console
    console.log(`\n${signal} received — shutting down…`);
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

void bootstrap();
