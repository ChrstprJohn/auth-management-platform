import type { Request, Response } from 'express';
import type { AuditService } from './audit.service.js';
import { parseInput, paginationSchema } from '../../shared/http/validation.js';

export class AuditController {
  constructor(private readonly service: AuditService) {}
  list = async (req: Request, res: Response): Promise<void> => {
    const { page, perPage } = parseInput(paginationSchema, req.query);
    res.json(await this.service.list(page, perPage));
  };
}
