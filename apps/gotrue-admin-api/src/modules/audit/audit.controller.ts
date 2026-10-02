import type { Request, Response } from 'express';
import type { AuditService } from './audit.service.js';
import { parseInput, paginationSchema } from '../../shared/http/validation.js';
import { z } from 'zod';

const lookupSchema = z.strictObject({
  id: z.uuid().transform((id) => id.toLowerCase()),
});

export class AuditController {
  constructor(private readonly service: AuditService) {}
  list = async (req: Request, res: Response): Promise<void> => {
    const { page, perPage } = parseInput(paginationSchema, req.query);
    res.json(await this.service.list(page, perPage));
  };
  find = async (req: Request, res: Response): Promise<void> => {
    const { id } = parseInput(lookupSchema, req.params);
    parseInput(z.strictObject({}), req.query);
    res.json(await this.service.find(id));
  };
}
