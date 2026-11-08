import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Router } from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { authenticate } from './middleware/authenticate.js';
import { requireRole } from './middleware/authorize.js';
import { errorHandler } from './middleware/error-handler.js';
import { httpLogger } from './middleware/http-logger.js';
import { notFoundHandler } from './middleware/not-found.js';
import { authRouter, meRouter } from './modules/auth/auth.routes.js';
import { healthRouter } from './modules/health/health.routes.js';
import {
  publicCategoriesRouter,
  publicMenuItemsRouter,
  staffCategoriesRouter,
  staffMenuItemsRouter,
} from './modules/menu/menu.routes.js';

export function createApp() {
  const app = express();

  // Behind a reverse proxy in production: trust its X-Forwarded-For so rate limiting sees real IPs.
  if (env.NODE_ENV === 'production') app.set('trust proxy', 1);

  app.use(httpLogger);
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  const api = Router();

  // Public and per-user routes
  api.use('/health', healthRouter);
  api.use('/auth', authRouter);
  api.use('/me', meRouter);
  api.use('/categories', publicCategoriesRouter);
  api.use('/menu-items', publicMenuItemsRouter);

  // Staff routes: one authorization check for the whole group
  const staff = Router();
  staff.use(authenticate, requireRole('STAFF', 'ADMIN'));
  staff.use('/categories', staffCategoriesRouter);
  staff.use('/menu-items', staffMenuItemsRouter);
  api.use('/staff', staff);

  app.use('/api/v1', api);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
