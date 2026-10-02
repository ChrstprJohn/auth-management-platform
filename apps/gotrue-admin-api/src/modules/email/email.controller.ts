import type { Request, Response } from 'express';
import { z } from 'zod';
import { parseInput } from '../../shared/http/validation.js';
import { newPasswordSchema } from '../../shared/http/password-schema.js';
import { ApiError } from '../../shared/errors/api-error.js';
import type { EmailService } from './email.service.js';

const proofSchema = z.strictObject({
  email: z.email().max(254),
  code: z.string().regex(/^\d{6,10}$/),
});
const invitationSchema = proofSchema.extend({ password: newPasswordSchema });
export class EmailController {
  constructor(private readonly service: EmailService) {}
  private input<T>(req: Request, schema: z.ZodType<T>): T {
    if (!req.is('application/json'))
      throw new ApiError(
        415,
        'UNSUPPORTED_MEDIA_TYPE',
        'Use application/json.',
      );
    return parseInput(schema, req.body);
  }
  confirm = async (req: Request, res: Response): Promise<void> => {
    const input = this.input(req, proofSchema);
    await this.service.confirm(input.email, input.code);
    res.status(204).end();
  };
  accept = async (req: Request, res: Response): Promise<void> => {
    const input = this.input(req, invitationSchema);
    await this.service.acceptInvitation(
      input.email,
      input.code,
      input.password,
    );
    res.status(204).end();
  };
}
