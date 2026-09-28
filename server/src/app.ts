import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import path from 'path';
import fs from 'fs';

import { env } from './config/env';
import { apiLimiter } from './middleware/rateLimit';
import { sanitizeBody } from './middleware/validate';
import { errorHandler, notFoundHandler } from './middleware/error';
import { serveReceipt } from './middleware/upload';
import { asyncHandler } from './utils/http';

import authRoutes from './routes/auth.routes';
import userRoutes from './routes/users.routes';
import expenseRoutes from './routes/expenses.routes';
import revenueRoutes from './routes/revenue.routes';
import partnerRoutes from './routes/partners.routes';
import employeeRoutes from './routes/employees.routes';
import budgetRoutes from './routes/budget.routes';
import dashboardRoutes from './routes/dashboard.routes';
import reportRoutes from './routes/reports.routes';
import auditRoutes from './routes/audit.routes';
import settingsRoutes from './routes/settings.routes';
import searchRoutes from './routes/search.routes';
import notificationRoutes from './routes/notifications.routes';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: false,
    }),
  );
  /**
   * CORS. Two things matter here:
   *  - A disallowed origin must NOT throw. Throwing turns a CORS decision into
   *    a 500 for every request; omitting the headers lets the browser enforce
   *    it properly while same-origin and server-to-server calls still work.
   *  - When this process also serves the built SPA, the browser sends an
   *    `Origin` header for module scripts and stylesheets on the *same* origin.
   *    Those must always be allowed, or the app cannot load itself.
   */
  app.use(
    cors((req, callback) => {
      const origin = req.headers.origin;
      const host = req.headers.host;
      const sameOrigin =
        !!origin && !!host && (origin === `http://${host}` || origin === `https://${host}`);
      const allowed =
        !origin || sameOrigin || env.CORS_ORIGIN.includes('*') || env.CORS_ORIGIN.includes(origin);

      callback(null, { origin: allowed, credentials: true });
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));
  app.use(sanitizeBody);
  if (!env.isProd) app.use(morgan('dev'));

  // Uploaded receipts: stored in the database; the static dir serves files
  // written to disk by older builds
  fs.mkdirSync(env.UPLOAD_DIR, { recursive: true });
  app.get('/uploads/:file', asyncHandler(serveReceipt));
  app.use('/uploads', express.static(env.UPLOAD_DIR, { maxAge: '7d' }));

  app.get('/api/health', (_req, res) =>
    res.json({ status: 'ok', service: 'voxpact-financials-api', time: new Date().toISOString(), env: env.NODE_ENV }),
  );

  app.use('/api', apiLimiter);
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/expenses', expenseRoutes);
  app.use('/api/revenue', revenueRoutes);
  app.use('/api/partners', partnerRoutes);
  app.use('/api/employees', employeeRoutes);
  app.use('/api/budget', budgetRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/audit-logs', auditRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/search', searchRoutes);
  app.use('/api/notifications', notificationRoutes);

  // Optionally serve the built SPA (single-service deployment)
  const clientDist = path.resolve(process.cwd(), '../web/dist');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get(/^\/(?!api|uploads).*/, (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
  }

  app.use('/api', notFoundHandler);
  app.use(errorHandler);

  return app;
}
