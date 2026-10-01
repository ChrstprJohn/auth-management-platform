import { Router } from 'express';
import type { AuthenticateMiddleware } from '../../middleware/authenticate.js';
import type { HealthController } from './health.controller.js';

export function createHealthRoutes(
  controller: HealthController,
  authenticate: AuthenticateMiddleware,
): Router {
  const router = Router();
  router.get('/health/live', controller.live);
  router.get('/health/ready', controller.ready);
  router.get('/v1/operator/health', authenticate.handle, controller.upstream);
  return router;
}
