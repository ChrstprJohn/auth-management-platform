import { Router, json } from 'express';
import type { CsrfMiddleware } from '../../middleware/csrf.js';
import { createRateLimiter } from '../../middleware/rate-limit.js';
import type { OperatorAuthController } from './operator-auth.controller.js';

export function createOperatorAuthRoutes(
  controller: OperatorAuthController,
  csrf: CsrfMiddleware,
): Router {
  const router = Router();
  router.post(
    '/login',
    csrf.handle,
    createRateLimiter(10, 15 * 60000),
    json({ limit: '16kb', strict: true }),
    controller.login,
  );
  router.get('/me', controller.me);
  router.post('/logout', csrf.handle, controller.logout);
  return router;
}
