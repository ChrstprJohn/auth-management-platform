import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import type { EncryptedToken } from '../operator-auth/session-crypto.js';
import { unavailable } from '../../shared/errors/api-error.js';

export interface RecoveryContext {
  hash: string;
  emailHash: string;
  operatorId: string | null;
  createdAt: Date;
  expiresAt: Date;
  secret: EncryptedToken;
}
export interface RecoveryStore {
  create(context: RecoveryContext): Promise<void>;
  claimCallback(hash: string): Promise<RecoveryContext | null>;
  ready(
    hash: string,
    operatorId: string,
    secret: EncryptedToken,
    expiresAt: Date,
  ): Promise<void>;
  claimReset(hash: string): Promise<RecoveryContext | null>;
  complete(hash: string, operatorId: string): Promise<void>;
}
const rowSchema = z.object({
  recovery_hash: z.string().regex(/^[0-9a-f]{64}$/),
  email_hash: z.string().regex(/^[0-9a-f]{64}$/),
  operator_id: z.uuid().nullable(),
  created_at: z.date(),
  expires_at: z.date(),
  secret_ciphertext: z.instanceof(Buffer),
  secret_nonce: z.instanceof(Buffer),
  secret_tag: z.instanceof(Buffer),
});
function parseRow(value: unknown): RecoveryContext {
  const row = rowSchema.parse(value);
  return {
    hash: row.recovery_hash,
    emailHash: row.email_hash,
    operatorId: row.operator_id,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    secret: {
      ciphertext: row.secret_ciphertext,
      nonce: row.secret_nonce,
      tag: row.secret_tag,
    },
  };
}
export class RecoveryRepository implements RecoveryStore {
  constructor(private readonly pool: Pool) {}
  async create(context: RecoveryContext): Promise<void> {
    try {
      await this.pool.query(
        'INSERT INTO operator_recovery (recovery_hash,email_hash,created_at,expires_at,secret_ciphertext,secret_nonce,secret_tag) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [
          context.hash,
          context.emailHash,
          context.createdAt,
          context.expiresAt,
          context.secret.ciphertext,
          context.secret.nonce,
          context.secret.tag,
        ],
      );
    } catch {
      throw unavailable();
    }
  }
  async claimCallback(hash: string): Promise<RecoveryContext | null> {
    try {
      const result = await this.pool.query<Record<string, unknown>>(
        "UPDATE operator_recovery SET phase='exchanging' WHERE recovery_hash=$1 AND phase='pending' AND expires_at>CURRENT_TIMESTAMP RETURNING *",
        [hash],
      );
      return result.rows[0] ? parseRow(result.rows[0]) : null;
    } catch {
      throw unavailable();
    }
  }
  async ready(
    hash: string,
    operatorId: string,
    secret: EncryptedToken,
    expiresAt: Date,
  ): Promise<void> {
    try {
      const result = await this.pool.query(
        "UPDATE operator_recovery SET phase='ready',operator_id=$2,secret_ciphertext=$3,secret_nonce=$4,secret_tag=$5,expires_at=LEAST(expires_at,$6) WHERE recovery_hash=$1 AND phase='exchanging' AND expires_at>CURRENT_TIMESTAMP",
        [
          hash,
          operatorId,
          secret.ciphertext,
          secret.nonce,
          secret.tag,
          expiresAt,
        ],
      );
      if (result.rowCount !== 1) throw unavailable();
    } catch {
      throw unavailable();
    }
  }
  private async transaction<T>(
    operation: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    let client: PoolClient | undefined;
    let destroy = false;
    try {
      client = await this.pool.connect();
      await client.query('BEGIN');
      const result = await operation(client);
      await client.query('COMMIT');
      return result;
    } catch {
      if (client) {
        try {
          await client.query('ROLLBACK');
        } catch {
          destroy = true;
        }
      }
      throw unavailable();
    } finally {
      client?.release(destroy);
    }
  }
  async claimReset(hash: string): Promise<RecoveryContext | null> {
    return this.transaction(async (client) => {
      const result = await client.query<Record<string, unknown>>(
        "UPDATE operator_recovery SET phase='resetting' WHERE recovery_hash=$1 AND phase='ready' AND expires_at>CURRENT_TIMESTAMP RETURNING *",
        [hash],
      );
      if (!result.rows[0]) return null;
      const context = parseRow(result.rows[0]);
      if (!context.operatorId) throw unavailable();
      // Invalidate old dashboard sessions durably before an ambiguous password mutation.
      await client.query('DELETE FROM operator_sessions WHERE operator_id=$1', [
        context.operatorId,
      ]);
      return context;
    });
  }
  async complete(hash: string, operatorId: string): Promise<void> {
    await this.transaction(async (client) => {
      await client.query('DELETE FROM operator_sessions WHERE operator_id=$1', [
        operatorId,
      ]);
      const result = await client.query(
        "DELETE FROM operator_recovery WHERE recovery_hash=$1 AND operator_id=$2 AND phase='resetting'",
        [hash, operatorId],
      );
      if (result.rowCount !== 1) throw unavailable();
      await client.query('DELETE FROM operator_recovery WHERE operator_id=$1', [
        operatorId,
      ]);
    });
  }
}
