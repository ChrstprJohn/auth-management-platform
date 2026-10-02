import { Router, json } from 'express';
import type { CsrfMiddleware } from '../../middleware/csrf.js';
import { createRateLimiter } from '../../middleware/rate-limit.js';
import type { EmailController } from './email.controller.js';
export function createEmailRoutes(
  controller: EmailController,
  csrf: CsrfMiddleware,
): Router {
  const router = Router();
  router.use(
    csrf.handle,
    createRateLimiter(10, 15 * 60 * 1000),
    json({ limit: '16kb', strict: true }),
  );
  router.post('/confirm', controller.confirm);
  router.post('/accept-invitation', controller.accept);
  return router;
}
