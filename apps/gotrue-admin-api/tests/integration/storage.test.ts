import { readFile } from 'node:fs/promises';
import { Client, Pool } from 'pg';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SessionRepository } from '../../src/modules/operator-auth/session.repository.js';
import { AuditRepository } from '../../src/modules/audit/audit.repository.js';
import { MutationLockRepository } from '../../src/modules/users/mutation-lock.repository.js';

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
    expect(normalize(full)).toBe(normalize(initial + '\n' + audit));
  });
});
