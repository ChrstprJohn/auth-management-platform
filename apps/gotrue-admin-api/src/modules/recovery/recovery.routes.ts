import { Router, json } from 'express';
import type { CsrfMiddleware } from '../../middleware/csrf.js';
import { createRateLimiter } from '../../middleware/rate-limit.js';
import type { RecoveryController } from './recovery.controller.js';

export function createRecoveryRoutes(
  controller: RecoveryController,
  csrf: CsrfMiddleware,
): Router {
  const router = Router();
  router.post(
    '/forgot-password',
    csrf.handle,
    createRateLimiter(5, 15 * 60000),
    json({ limit: '16kb', strict: true }),
    controller.request,
  );
  router.get(
    '/recovery/callback',
    createRateLimiter(10, 15 * 60000),
    controller.callback,
  );
  router.post(
    '/reset-password',
    csrf.handle,
    createRateLimiter(10, 15 * 60000),
    json({ limit: '16kb', strict: true }),
    controller.reset,
  );
  return router;
}
