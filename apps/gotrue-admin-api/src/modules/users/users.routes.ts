import { Router, json } from 'express';
import type { AuthenticateMiddleware } from '../../middleware/authenticate.js';
import type { CsrfMiddleware } from '../../middleware/csrf.js';
import type { UsersController } from './users.controller.js';
import { createRateLimiter } from '../../middleware/rate-limit.js';

export function createUsersRoutes(
  controller: UsersController,
  authenticate: AuthenticateMiddleware,
  csrf: CsrfMiddleware,
): Router {
  const router = Router();
  const jsonBody = json({ limit: '16kb', strict: true });
  router.use(authenticate.handle);
  const emailLimit = createRateLimiter(5, 15 * 60 * 1000);
  router.post(
    '/invitations',
    csrf.handle,
    emailLimit,
    jsonBody,
    controller.invite,
  );
  router.post(
    '/:id/send-verification',
    csrf.handle,
    emailLimit,
    jsonBody,
    controller.sendVerification,
  );
  router.get('/', controller.list);
  router.post(
    '/:id/resend-invitation',
    csrf.handle,
    emailLimit,
    jsonBody,
    controller.resendInvitation,
  );
  router.get('/:id', controller.get);
  router.post('/', csrf.handle, jsonBody, controller.create);
  router.post('/:id/ban', csrf.handle, jsonBody, controller.ban);
  router.post('/:id/unban', csrf.handle, jsonBody, controller.unban);
  router.delete('/:id', csrf.handle, jsonBody, controller.delete);
  return router;
}
