import { Router } from 'express';
import type { AuthenticateMiddleware } from '../../middleware/authenticate.js';
import type { AuditController } from './audit.controller.js';

export function createAuditRoutes(
  controller: AuditController,
  authenticate: AuthenticateMiddleware,
): Router {
  const router = Router();
  router.get('/', authenticate.handle, controller.list);
  return router;
}
