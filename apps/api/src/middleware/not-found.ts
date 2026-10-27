import type { RequestHandler } from 'express';
import { notFound } from '../lib/errors.js';

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(notFound('ROUTE_NOT_FOUND', `Route ${req.method} ${req.path} not found`));
};