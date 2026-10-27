import type { ErrorRequestHandler, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors.js';

function sendError(
  req: Request,
  res: Response,
  status: number,
  code: string,
  message: string,
  details?: unknown,
) {
  res.status(status).json({
    error: { code, message, ...(details !== undefined && { details }) },
    requestId: req.id,
  });
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof AppError) {
    sendError(req, res, err.statusCode, err.code, err.message, err.details);
    return;
  }

  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    sendError(req, res, 400, 'VALIDATION_ERROR', 'Request validation failed', details);
    return;
  }

  // Errors from express.json(): malformed JSON or a body that is too large
  if (typeof err === 'object' && err !== null && 'type' in err) {
    if (err.type === 'entity.parse.failed') {
      sendError(req, res, 400, 'INVALID_JSON', 'Request body is not valid JSON');
      return;
    }
    if (err.type === 'entity.too.large') {
      sendError(req, res, 413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');
      return;
    }
  }

  req.log.error({ err }, 'Unhandled error');
  sendError(req, res, 500, 'INTERNAL_ERROR', 'Something went wrong');
};