import { readFile } from 'node:fs/promises';
import { Client, Pool } from 'pg';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SessionRepository } from '../../src/modules/operator-auth/session.repository.js';
import { AuditRepository } from '../../src/modules/audit/audit.repository.js';
import { MutationLockRepository } from '../../src/modules/users/mutation-lock.repository.js';
import { RecoveryRepository } from '../../src/modules/recovery/recovery.repository.js';

const pools: Pool[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(pools.splice(0).map((pool) => pool.end()));
});
function pool() {
  const value = new Pool();
  pools.push(value);
  return value;
}
const result = { command: 'SELECT', rowCount: 1, oid: 0, fields: [], rows: [] };
describe('owned storage boundaries (mocked pg, no executed SQL)', () => {
  const recoveryRow = {
    recovery_hash: 'a'.repeat(64),
    email_hash: 'b'.repeat(64),
    operator_id: '11111111-1111-4111-8111-111111111111',
    created_at: new Date(),
    expires_at: new Date(Date.now() + 600000),
    secret_ciphertext: Buffer.from('encrypted'),
    secret_nonce: Buffer.alloc(12),
    secret_tag: Buffer.alloc(16),
  };
  it('claims recovery callback atomically with phase and expiry guards', async () => {
    const database = pool();
    const query = vi.spyOn(database, 'query').mockImplementation(async () => ({
      ...result,
      rows: [{ ...recoveryRow, operator_id: null }],
    }));
    const context = await new RecoveryRepository(database).claimCallback(
      recoveryRow.recovery_hash,
    );
    expect(context?.operatorId).toBeNull();
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining(
        "phase='pending' AND expires_at>CURRENT_TIMESTAMP",
      ),
      [recoveryRow.recovery_hash],
    );
    query.mockImplementation(async () => ({ ...result, rows: [] }));
    expect(
      await new RecoveryRepository(database).claimCallback(
        recoveryRow.recovery_hash,
      ),
    ).toBeNull();
  });
  it('claims reset and invalidates local sessions in one transaction before returning', async () => {
    const database = pool();
    const client = Object.assign(new Client(), { release: vi.fn() });
    vi.spyOn(database, 'connect').mockImplementation(async () => client);
    const query = vi
      .spyOn(client, 'query')
      .mockImplementation(async () => ({ ...result, rows: [recoveryRow] }));
    const context = await new RecoveryRepository(database).claimReset(
      recoveryRow.recovery_hash,
    );
    expect(context?.operatorId).toBe(recoveryRow.operator_id);
    expect(query.mock.calls.map((call) => call[0])).toEqual([
      'BEGIN',
      expect.stringContaining("phase='ready' AND expires_at>CURRENT_TIMESTAMP"),
      'DELETE FROM operator_sessions WHERE operator_id=$1',
      'COMMIT',
    ]);
    expect(query).toHaveBeenCalledWith(
      'DELETE FROM operator_sessions WHERE operator_id=$1',
      [recoveryRow.operator_id],
    );
    expect(client.release).toHaveBeenCalledWith(false);
  });
  it('rolls reset claim back when session invalidation fails and discards a broken connection', async () => {
    const database = pool();
    const client = Object.assign(new Client(), { release: vi.fn() });
    vi.spyOn(database, 'connect').mockImplementation(async () => client);
    const query = vi
      .spyOn(client, 'query')
      .mockImplementation(async () => ({ ...result, rows: [recoveryRow] }));
    query
      .mockImplementationOnce(async () => result)
      .mockImplementationOnce(async () => ({ ...result, rows: [recoveryRow] }))
      .mockRejectedValueOnce(new Error('private DB failure'))
      .mockRejectedValueOnce(new Error('rollback failed'));
    await expect(
      new RecoveryRepository(database).claimReset(recoveryRow.recovery_hash),
    ).rejects.toMatchObject({ code: 'DEPENDENCY_UNAVAILABLE' });
    expect(query).toHaveBeenCalledWith('ROLLBACK');
    expect(query).not.toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalledWith(true);
  });
  it('requires a claimed context for completion and bounds ready expiry with LEAST', async () => {
    const database = pool();
    const query = vi
      .spyOn(database, 'query')
      .mockImplementation(async () => ({ ...result, rowCount: 0 }));
    await expect(
      new RecoveryRepository(database).ready(
        'hash',
        recoveryRow.operator_id,
        {
          ciphertext: Buffer.from('secret'),
          nonce: Buffer.alloc(12),
          tag: Buffer.alloc(16),
        },
        recoveryRow.expires_at,
      ),
    ).rejects.toMatchObject({ code: 'DEPENDENCY_UNAVAILABLE' });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('expires_at=LEAST(expires_at,$6)'),
      expect.any(Array),
    );
    const client = Object.assign(new Client(), { release: vi.fn() });
    vi.spyOn(database, 'connect').mockImplementation(async () => client);
    const transactionQuery = vi
      .spyOn(client, 'query')
      .mockImplementation(async () => ({ ...result, rowCount: 0 }));
    await expect(
      new RecoveryRepository(database).complete(
        'hash',
        recoveryRow.operator_id,
      ),
    ).rejects.toMatchObject({ code: 'DEPENDENCY_UNAVAILABLE' });
    expect(transactionQuery).toHaveBeenCalledWith('ROLLBACK');
    expect(transactionQuery).not.toHaveBeenCalledWith('COMMIT');
  });
  it('binds session values and encrypted buffers instead of embedding them in SQL', async () => {
    const database = pool();
    const query = vi
      .spyOn(database, 'query')
      .mockImplementation(async () => result);
    const row = {
      hash: 'a'.repeat(64),
      operatorId: '00000000-0000-4000-8000-000000000001',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 1000),
      token: {
        ciphertext: Buffer.from('encrypted'),
        nonce: Buffer.alloc(12),
        tag: Buffer.alloc(16),
      },
    };
    await new SessionRepository(database).create(row);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('VALUES ($1,$2,$3,$4,$5,$6,$7)'),
      [
        row.hash,
        row.operatorId,
        row.createdAt,
        row.expiresAt,
        row.token.ciphertext,
        row.token.nonce,
        row.token.tag,
      ],
    );
  });
  it('does not authorize from corrupt/unavailable session storage', async () => {
    const database = pool();
    const query = vi.spyOn(database, 'query').mockImplementation(async () => ({
      ...result,
      rows: [{ session_hash: 'bad' }],
    }));
    await expect(
      new SessionRepository(database).find('hash'),
    ).rejects.toMatchObject({ code: 'DEPENDENCY_UNAVAILABLE' });
    query.mockRejectedValue(new Error('secret database details'));
    await expect(
      new SessionRepository(database).find('hash'),
    ).rejects.toMatchObject({ message: 'A required service is unavailable.' });
  });
  it('requires an actual pending-intent row to complete and bounds history in SQL', async () => {
    const database = pool();
    const query = vi
      .spyOn(database, 'query')
      .mockImplementation(async () => ({ ...result, rowCount: 0 }));
    const repository = new AuditRepository(database);
    await expect(
      repository.complete('id', 'succeeded', null),
    ).rejects.toMatchObject({ code: 'DEPENDENCY_UNAVAILABLE' });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("AND outcome='pending'"),
      ['id', 'succeeded', null],
    );
    await repository.list(2, 20);
    expect(query).toHaveBeenLastCalledWith(
      expect.stringContaining('LIMIT $1 OFFSET $2'),
      [21, 20],
    );
  });
  it('retains pending/unknown as unresolved and does not default storage failure to safe', async () => {
    const database = pool();
    const query = vi.spyOn(database, 'query').mockImplementation(async () => ({
      ...result,
      rows: [{ exists: true }],
    }));
    const repository = new AuditRepository(database);
    expect(await repository.hasUnresolvedOperatorRemoval(['operator'])).toBe(
      true,
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("outcome IN ('pending','unknown')"),
      [['operator']],
    );
    query.mockRejectedValue(new Error('secret'));
    await expect(
      repository.hasUnresolvedOperatorRemoval(['operator']),
    ).rejects.toMatchObject({ code: 'DEPENDENCY_UNAVAILABLE' });
  });
  it('holds the dedicated advisory-lock connection and destroys it on release', async () => {
    const database = pool();
    const client = Object.assign(new Client(), { release: vi.fn() });
    vi.spyOn(database, 'connect').mockImplementation(async () => client);
    const query = vi.spyOn(client, 'query').mockImplementation(async () => ({
      ...result,
      rows: [{ locked: true }],
    }));
    const action = vi.fn(async () => {
      expect(client.release).not.toHaveBeenCalled();
      return 'completed';
    });
    expect(await new MutationLockRepository(database).run(action)).toBe(
      'completed',
    );
    expect(query).toHaveBeenCalledWith(
      'SELECT pg_try_advisory_lock(1960, 1) AS locked',
    );
    expect(client.release).toHaveBeenCalledWith(true);
  });
  it('fails closed if the lock connection is lost during eligibility checks', async () => {
    const database = pool();
    const client = Object.assign(new Client(), { release: vi.fn() });
    vi.spyOn(database, 'connect').mockImplementation(async () => client);
    vi.spyOn(client, 'query').mockImplementation(async () => ({
      ...result,
      rows: [{ locked: true }],
    }));
    const mutate = vi.fn();
    await expect(
      new MutationLockRepository(database).run(async (assertHeld) => {
        client.emit('error', new Error('connection lost'));
        assertHeld();
        mutate();
      }),
    ).rejects.toMatchObject({ code: 'DEPENDENCY_UNAVAILABLE' });
    expect(mutate).not.toHaveBeenCalled();
    expect(client.release).toHaveBeenCalledWith(true);
  });
  it('refuses to treat missing unresolved-intent query data as safe', async () => {
    const database = pool();
    vi.spyOn(database, 'query').mockImplementation(async () => result);
    await expect(
      new AuditRepository(database).hasUnresolvedOperatorRemoval(['operator']),
    ).rejects.toMatchObject({ code: 'DEPENDENCY_UNAVAILABLE' });
  });
  it('blocks mutation when lock is busy or its connection fails', async () => {
    const database = pool();
    const client = Object.assign(new Client(), { release: vi.fn() });
    vi.spyOn(database, 'connect').mockImplementation(async () => client);
    const query = vi.spyOn(client, 'query').mockImplementation(async () => ({
      ...result,
      rows: [{ locked: false }],
    }));
    const action = vi.fn(async () => 'should not run');
    const lock = new MutationLockRepository(database);
    await expect(lock.run(action)).rejects.toMatchObject({
      code: 'MUTATION_IN_PROGRESS',
    });
    expect(action).not.toHaveBeenCalled();
    expect(client.release).toHaveBeenCalledWith(true);
    query.mockRejectedValue(new Error('secret'));
    await expect(lock.run(action)).rejects.toMatchObject({
      code: 'DEPENDENCY_UNAVAILABLE',
    });
    expect(action).not.toHaveBeenCalled();
  });
  it('keeps the authoritative full schema equal to the ordered prepared migrations', async () => {
    const base = new URL(
      '../../../../packages/database/admin/',
      import.meta.url,
    );
    const normalize = (sql: string) =>
      sql
        .replace(/--[^\n]*/g, '')
        .replace(/\b(BEGIN|COMMIT);/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    const full = await readFile(new URL('schema.sql', base), 'utf8');
    const initial = await readFile(
      new URL('migrations/0001_operator_sessions.sql', base),
      'utf8',
    );
    const audit = await readFile(
      new URL('migrations/0002_management_audit.sql', base),
      'utf8',
    );
    const recovery = await readFile(
      new URL('migrations/0003_operator_recovery.sql', base),
      'utf8',
    );
    expect(normalize(full)).toBe(
      normalize(initial + '\n' + audit + '\n' + recovery),
    );
  });
});
