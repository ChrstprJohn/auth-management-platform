import type { Request, Response } from 'express';
import { z } from 'zod';
import type { UsersService, ManagementContext } from './users.service.js';
import {
  userIdSchema,
  createUserSchema,
  banSchema,
  unbanSchema,
  deleteSchema,
} from './users.schemas.js';
import { parseInput, paginationSchema } from '../../shared/http/validation.js';
import { ApiError } from '../../shared/errors/api-error.js';

export class UsersController {
  constructor(private readonly service: UsersService) {}
  private context(res: Response): ManagementContext {
    const input: unknown = res.locals.operatorSession;
    const session = z
      .object({ operator: z.object({ id: z.uuid() }) })
      .parse(input);
    return {
      actorId: session.operator.id,
      requestId: z.uuid().parse(res.locals.requestId),
    };
  }
  private input<T>(req: Request, schema: z.ZodType<T>): T {
    if (!req.is('application/json'))
      throw new ApiError(
        415,
        'UNSUPPORTED_MEDIA_TYPE',
        'Use application/json.',
      );
    return parseInput(schema, req.body);
  }
  private target(req: Request, targetId: string): string {
    const id = parseInput(userIdSchema, req.params.id);
    if (id !== targetId)
      throw new ApiError(
        400,
        'INVALID_INPUT',
        'Confirmation target does not match the path.',
      );
    return id;
  }
  list = async (req: Request, res: Response): Promise<void> => {
    const { page, perPage } = parseInput(paginationSchema, req.query);
    res.json(await this.service.list(page, perPage));
  };
  get = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.service.get(parseInput(userIdSchema, req.params.id)));
  };
  create = async (req: Request, res: Response): Promise<void> => {
    res
      .status(201)
      .json(
        await this.service.create(
          this.context(res),
          this.input(req, createUserSchema),
        ),
      );
  };
  ban = async (req: Request, res: Response): Promise<void> => {
    const input = this.input(req, banSchema);
    res.json(
      await this.service.ban(
        this.context(res),
        this.target(req, input.targetId),
        input.durationHours,
      ),
    );
  };
  unban = async (req: Request, res: Response): Promise<void> => {
    const input = this.input(req, unbanSchema);
    res.json(
      await this.service.unban(
        this.context(res),
        this.target(req, input.targetId),
      ),
    );
  };
  delete = async (req: Request, res: Response): Promise<void> => {
    const input = this.input(req, deleteSchema);
    res.json(
      await this.service.delete(
        this.context(res),
        this.target(req, input.targetId),
      ),
    );
  };
}
