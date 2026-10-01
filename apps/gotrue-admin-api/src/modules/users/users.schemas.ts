import { z } from 'zod';
export const userIdSchema = z.uuid().transform((value) => value.toLowerCase());
const passwordSchema = z
  .string()
  .min(8)
  .refine((value) => Buffer.byteLength(value, 'utf8') <= 72);
export const createUserSchema = z.strictObject({
  email: z.email().max(254),
  password: passwordSchema,
  confirmation: z.enum(['require_verification', 'operator_confirmed']),
});
export const banSchema = z.strictObject({
  durationHours: z.number().int().min(1).max(8760),
  targetId: userIdSchema,
  confirmation: z.literal('BAN_GLOBAL_USER'),
});
export const unbanSchema = z.strictObject({
  targetId: userIdSchema,
  confirmation: z.literal('UNBAN_GLOBAL_USER'),
});
export const deleteSchema = z.strictObject({
  targetId: userIdSchema,
  confirmation: z.literal('DELETE_GLOBAL_USER_PERMANENTLY'),
});
