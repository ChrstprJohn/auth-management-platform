import type { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { AuditAction, AuditEntry, AuditOutcome } from '@auth/contracts';
import { unavailable } from '../../shared/errors/api-error.js';

export interface AuditStore {
  intent(
    actorId: string,
    targetId: string | null,
    action: AuditAction,
    requestId: string,
  ): Promise<string>;
  complete(
    id: string,
    outcome: Exclude<AuditOutcome, 'pending'>,
    targetId: string | null,
  ): Promise<void>;
  list(page: number, perPage: number): Promise<AuditEntry[]>;
  find(id: string): Promise<AuditEntry | null>;
  hasUnresolvedOperatorRemoval(
    operatorIds: readonly string[],
  ): Promise<boolean>;
}
const rowSchema = z.object({
  id: z.uuid(),
  actor_id: z.uuid(),
  target_id: z.uuid().nullable(),
  action: z.enum([
    'create',
    'ban',
    'unban',
    'delete',
    'invite',
    'send_verification',
  ]),
  outcome: z.enum(['pending', 'succeeded', 'failed', 'unknown']),
  created_at: z.date(),
  completed_at: z.date().nullable(),
  request_id: z.uuid(),
});
function entryFromRow(value: unknown): AuditEntry {
  const row = rowSchema.parse(value);
  return {
    id: row.id,
    actorId: row.actor_id,
    targetId: row.target_id,
    action: row.action,
    outcome: row.outcome,
    createdAt: row.created_at.toISOString(),
    completedAt: row.completed_at?.toISOString() ?? null,
    requestId: row.request_id,
  };
}
export class AuditRepository implements AuditStore {
  constructor(private readonly pool: Pool) {}
  async intent(
    actorId: string,
    targetId: string | null,
    action: AuditAction,
    requestId: string,
  ): Promise<string> {
    const id = randomUUID();
    try {
      await this.pool.query(
        'INSERT INTO management_audit (id, actor_id, target_id, action, request_id) VALUES ($1,$2,$3,$4,$5)',
        [id, actorId, targetId, action, requestId],
      );
      return id;
    } catch {
      throw unavailable();
    }
  }
  async complete(
    id: string,
    outcome: Exclude<AuditOutcome, 'pending'>,
    targetId: string | null,
  ): Promise<void> {
    try {
      const result = await this.pool.query(
        "UPDATE management_audit SET outcome=$2, target_id=COALESCE($3,target_id), completed_at=CURRENT_TIMESTAMP WHERE id=$1 AND outcome='pending'",
        [id, outcome, targetId],
      );
      if (result.rowCount !== 1) throw unavailable();
    } catch {
      throw unavailable();
    }
  }
  async list(page: number, perPage: number): Promise<AuditEntry[]> {
    try {
      const result = await this.pool.query<Record<string, unknown>>(
        'SELECT id, actor_id, target_id, action, outcome, created_at, completed_at, request_id FROM management_audit ORDER BY created_at DESC, id DESC LIMIT $1 OFFSET $2',
        [perPage + 1, (page - 1) * perPage],
      );
      return result.rows.map(entryFromRow);
    } catch {
      throw unavailable();
    }
  }
  async find(id: string): Promise<AuditEntry | null> {
    try {
      const result = await this.pool.query<Record<string, unknown>>(
        'SELECT id, actor_id, target_id, action, outcome, created_at, completed_at, request_id FROM management_audit WHERE id=$1',
        [id],
      );
      return result.rows.length ? entryFromRow(result.rows[0]) : null;
    } catch {
      throw unavailable();
    }
  }
  async hasUnresolvedOperatorRemoval(
    operatorIds: readonly string[],
  ): Promise<boolean> {
    try {
      const result = await this.pool.query<{ exists: boolean }>(
        "SELECT EXISTS (SELECT 1 FROM management_audit WHERE action IN ('ban','delete') AND outcome IN ('pending','unknown') AND target_id = ANY($1::uuid[])) AS exists",
        [operatorIds],
      );
      return z.boolean().parse(result.rows[0]?.exists);
    } catch {
      throw unavailable();
    }
  }
}
