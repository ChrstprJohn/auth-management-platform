import { rateLimit } from 'express-rate-limit';
import type { RequestHandler } from 'express';

export function createRateLimiter(
  limit: number,
  windowMs: number,
): RequestHandler {
  return rateLimit({
    limit,
    windowMs,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Try again later.',
        },
        requestId: res.locals.requestId,
      });
    },
  });
}
