import type { ErrorRequestHandler } from 'express';
import type { Logger } from 'pino';
import { ApiError } from '../shared/errors/api-error.js';

export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (error: unknown, _req, res, _next) => {
    let safe =
      error instanceof ApiError
        ? error
        : new ApiError(
            500,
            'INTERNAL_ERROR',
            'The request could not be completed.',
          );
    if (typeof error === 'object' && error !== null && 'type' in error) {
      if (error.type === 'entity.parse.failed')
        safe = new ApiError(400, 'INVALID_INPUT', 'Invalid JSON body.');
      if (error.type === 'entity.too.large')
        safe = new ApiError(
          413,
          'BODY_TOO_LARGE',
          'Request body is too large.',
        );
    }
    if (safe.status >= 500)
      logger.error(
        { requestId: res.locals.requestId, code: safe.code },
        'Request failed',
      );
    res.status(safe.status).json({
      error: { code: safe.code, message: safe.message },
      requestId: res.locals.requestId,
    });
  };
}
