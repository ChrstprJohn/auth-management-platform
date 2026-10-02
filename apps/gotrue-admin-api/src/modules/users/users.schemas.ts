import { z } from 'zod';
import { newPasswordSchema } from '../../shared/http/password-schema.js';
export const userIdSchema = z.uuid().transform((value) => value.toLowerCase());
export const createUserSchema = z.strictObject({
  email: z.email().max(254),
  password: newPasswordSchema,
  confirmation: z.enum(['require_verification', 'operator_confirmed']),
});
export const banSchema = z.strictObject({
  durationHours: z.number().int().min(1).max(8760),
  targetId: userIdSchema,
  confirmation: z.literal('BAN_GLOBAL_USER'),
});
export const inviteSchema = z.strictObject({
  email: z.email().max(254),
  confirmation: z.literal('SEND_INVITATION'),
});
export const sendVerificationSchema = z.strictObject({
  targetId: userIdSchema,
  confirmation: z.literal('SEND_VERIFICATION_EMAIL'),
});
export const resendInvitationSchema = z.strictObject({
  targetId: userIdSchema,
  confirmation: z.literal('RESEND_INVITATION'),
});
export const unbanSchema = z.strictObject({
  targetId: userIdSchema,
  confirmation: z.literal('UNBAN_GLOBAL_USER'),
});
export const deleteSchema = z.strictObject({
  targetId: userIdSchema,
  confirmation: z.literal('DELETE_GLOBAL_USER_PERMANENTLY'),
});
