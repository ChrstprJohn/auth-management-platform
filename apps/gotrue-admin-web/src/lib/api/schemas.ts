import { z } from 'zod';
import type { OperatorSession, SafeUser, AuditEntry } from '@auth/contracts';

const timestamp = z.iso.datetime({ offset: true });
export const sessionSchema: z.ZodType<OperatorSession> = z.object({
  operator: z.object({ id: z.uuid(), email: z.email().max(254) }),
  expiresAt: timestamp,
});
export const userSchema: z.ZodType<SafeUser> = z.object({
  id: z.uuid(),
  email: z.email().max(254).nullable(),
  createdAt: timestamp.nullable(),
  emailConfirmedAt: timestamp.nullable(),
  invitedAt: timestamp.nullable().default(null),
  lastSignInAt: timestamp.nullable(),
  bannedUntil: timestamp.nullable(),
  isBanned: z.boolean().nullable(),
});
export const auditSchema: z.ZodType<AuditEntry> = z.object({
  id: z.uuid(),
  actorId: z.uuid(),
  targetId: z.uuid().nullable(),
  action: z.enum([
    'create',
    'ban',
    'unban',
    'delete',
    'invite',
    'send_verification',
  ]),
  outcome: z.enum(['pending', 'succeeded', 'failed', 'unknown']),
  createdAt: timestamp,
  completedAt: timestamp.nullable(),
  requestId: z.uuid(),
});
const pagination = {
  page: z.number().int().min(1).max(10000),
  perPage: z.number().int().min(1).max(100),
  hasNextPage: z.boolean(),
};
export const usersSchema = z.object({
  users: z.array(userSchema),
  ...pagination,
});
export const historySchema = z.object({
  entries: z.array(auditSchema),
  ...pagination,
});
export const auditDetailSchema = z.object({ entry: auditSchema });
export const detailSchema = z.object({ user: userSchema });
export const mutationSchema = z.object({ user: userSchema, auditId: z.uuid() });
export const deletionSchema = z.object({
  deleted: z.literal(true),
  targetId: z.uuid(),
  auditId: z.uuid(),
});
export const errorSchema = z.object({
  error: z.object({
    code: z.string().regex(/^[A-Z_]{1,80}$/),
    message: z.string(),
  }),
  requestId: z.uuid(),
  auditId: z.uuid().optional(),
  outcome: z.enum(['succeeded', 'failed', 'unknown']).optional(),
});
export const liveSchema = z.object({ status: z.literal('ok') });
export const readySchema = z.object({
  status: z.enum(['ready', 'unavailable']),
});
export const upstreamSchema = z.object({
  status: z.enum(['reachable', 'unavailable']),
  version: z.string().max(100).nullable(),
});
