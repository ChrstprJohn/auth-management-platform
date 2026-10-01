import type { Pool } from 'pg';
import { z } from 'zod';
import type { EncryptedToken } from './session-crypto.js';
import { unavailable } from '../../shared/errors/api-error.js';

export interface StoredSession {
  hash: string;
  operatorId: string;
  createdAt: Date;
  expiresAt: Date;
  token: EncryptedToken;
}
export interface SessionStore {
  create(session: StoredSession): Promise<void>;
  find(hash: string): Promise<StoredSession | null>;
  delete(hash: string): Promise<void>;
  deleteForOperator(operatorId: string): Promise<void>;
  findForOperator(operatorId: string): Promise<StoredSession[]>;
}
const rowSchema = z.object({
  session_hash: z.string(),
  operator_id: z.uuid(),
  created_at: z.date(),
  expires_at: z.date(),
  token_ciphertext: z.instanceof(Buffer),
  token_nonce: z.instanceof(Buffer),
  token_tag: z.instanceof(Buffer),
});

export class SessionRepository implements SessionStore {
  constructor(private readonly pool: Pool) {}
  async findForOperator(operatorId: string): Promise<StoredSession[]> {
    try {
      const result = await this.pool.query<Record<string, unknown>>(
        'SELECT session_hash, operator_id, created_at, expires_at, token_ciphertext, token_nonce, token_tag FROM operator_sessions WHERE operator_id=$1 AND expires_at > CURRENT_TIMESTAMP ORDER BY created_at DESC LIMIT 5',
        [operatorId],
      );
      return result.rows.map((value) => {
        const row = rowSchema.parse(value);
        return {
          hash: row.session_hash,
          operatorId: row.operator_id,
          createdAt: row.created_at,
          expiresAt: row.expires_at,
          token: {
            ciphertext: row.token_ciphertext,
            nonce: row.token_nonce,
            tag: row.token_tag,
          },
        };
      });
    } catch {
      throw unavailable();
    }
  }
  async create(session: StoredSession): Promise<void> {
    try {
      await this.pool.query(
        'INSERT INTO operator_sessions (session_hash, operator_id, created_at, expires_at, token_ciphertext, token_nonce, token_tag) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [
          session.hash,
          session.operatorId,
          session.createdAt,
          session.expiresAt,
          session.token.ciphertext,
          session.token.nonce,
          session.token.tag,
        ],
      );
    } catch {
      throw unavailable();
    }
  }
  async find(hash: string): Promise<StoredSession | null> {
    try {
      const result = await this.pool.query<Record<string, unknown>>(
        'SELECT session_hash, operator_id, created_at, expires_at, token_ciphertext, token_nonce, token_tag FROM operator_sessions WHERE session_hash=$1 AND expires_at > CURRENT_TIMESTAMP',
        [hash],
      );
      if (!result.rows[0]) return null;
      const row = rowSchema.parse(result.rows[0]);
      return {
        hash: row.session_hash,
        operatorId: row.operator_id,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
        token: {
          ciphertext: row.token_ciphertext,
          nonce: row.token_nonce,
          tag: row.token_tag,
        },
      };
    } catch {
      throw unavailable();
    }
  }
  async delete(hash: string): Promise<void> {
    try {
      await this.pool.query(
        'DELETE FROM operator_sessions WHERE session_hash=$1',
        [hash],
      );
    } catch {
      throw unavailable();
    }
  }
  async deleteForOperator(operatorId: string): Promise<void> {
    try {
      await this.pool.query(
        'DELETE FROM operator_sessions WHERE operator_id=$1',
        [operatorId],
      );
    } catch {
      throw unavailable();
    }
  }
}
