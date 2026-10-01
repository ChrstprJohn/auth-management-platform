import { z } from 'zod';
import { newPasswordSchema } from '../../shared/http/password-schema.js';
export const forgotPasswordSchema = z.strictObject({
  email: z.email().max(254),
});
export const resetPasswordSchema = z.strictObject({
  password: newPasswordSchema,
});
export const recoveryCallbackSchema = z.strictObject({
  state: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  code: z.uuid(),
});
