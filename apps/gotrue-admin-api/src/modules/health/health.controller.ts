import type { Request, Response } from 'express';
import type { HealthService } from './health.service.js';

export class HealthController {
  constructor(private readonly service: HealthService) {}
  live = (_req: Request, res: Response): void => {
    res.json({ status: 'ok' });
  };
  ready = async (_req: Request, res: Response): Promise<void> => {
    const ready = await this.service.ready();
    res
      .status(ready ? 200 : 503)
      .json({ status: ready ? 'ready' : 'unavailable' });
  };
}
