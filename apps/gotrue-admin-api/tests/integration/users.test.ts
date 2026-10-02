import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { AuditAction, AuditEntry, AuditOutcome } from '@auth/contracts';
import {
  UpstreamError,
  type AdminUser,
  type AdminUsersClient,
  type EmailClient,
  type OperatorIdentityClient,
} from '@auth/gotrue-client';
import { createApp } from '../../src/app.js';
import { loadConfig } from '../../src/config/env.js';
import { ApiError, unavailable } from '../../src/shared/errors/api-error.js';
import type {
  SessionStore,
  StoredSession,
} from '../../src/modules/operator-auth/session.repository.js';
import type { AuditStore } from '../../src/modules/audit/audit.repository.js';
import type { MutationLock } from '../../src/modules/users/mutation-lock.repository.js';

const first = '00000000-0000-4000-8000-000000000001';
const second = '00000000-0000-4000-8000-000000000002';
const ordinary = '00000000-0000-4000-8000-000000000003';
const origin = 'http://localhost:5173';
function user(id: string): AdminUser {
  return {
    id,
    email: `${id}@example.test`,
    email_confirmed_at: '2026-01-01T00:00:00Z',
    created_at: '2026-01-01T00:00:00Z',
  };
}
class Sessions implements SessionStore {
  readonly rows = new Map<string, StoredSession>();
  async create(row: StoredSession) {
    this.rows.set(row.hash, row);
  }
  async find(hash: string) {
    return this.rows.get(hash) ?? null;
  }
  async delete(hash: string) {
    this.rows.delete(hash);
  }
  async deleteForOperator(id: string) {
    for (const [hash, row] of this.rows)
      if (row.operatorId === id) this.rows.delete(hash);
  }
  async findForOperator(id: string) {
    return [...this.rows.values()].filter(
      (row) => row.operatorId === id && row.expiresAt.getTime() > Date.now(),
    );
  }
}
class Audit implements AuditStore {
  readonly rows: AuditEntry[] = [];
  failIntent = false;
  failCompletion = false;
  failLookup = false;
  async find(id: string) {
    if (this.failLookup) throw unavailable();
    return this.rows.find((entry) => entry.id === id) ?? null;
  }
  async intent(
    actorId: string,
    targetId: string | null,
    action: AuditAction,
    requestId: string,
  ) {
    if (this.failIntent) throw unavailable();
    const id = randomUUID();
    this.rows.unshift({
      id,
      actorId,
      targetId,
      action,
      requestId,
      outcome: 'pending',
      createdAt: new Date().toISOString(),
      completedAt: null,
    });
    return id;
  }
  async complete(
    id: string,
    outcome: Exclude<AuditOutcome, 'pending'>,
    targetId: string | null,
  ) {
    if (this.failCompletion) throw unavailable();
    const row = this.rows.find((entry) => entry.id === id);
    if (!row) throw unavailable();
    row.outcome = outcome;
    row.targetId = targetId;
    row.completedAt = new Date().toISOString();
  }
  async list(page: number, perPage: number) {
    return this.rows.slice(
      (page - 1) * perPage,
      (page - 1) * perPage + perPage + 1,
    );
  }
  async hasUnresolvedOperatorRemoval(ids: readonly string[]) {
    return this.rows.some(
      (row) =>
        row.targetId &&
        ids.includes(row.targetId) &&
        ['ban', 'delete'].includes(row.action) &&
        ['pending', 'unknown'].includes(row.outcome),
    );
  }
}
class Lock implements MutationLock {
  private busy = false;
  async run<T>(operation: (assertHeld: () => void) => Promise<T>): Promise<T> {
    if (this.busy) throw new ApiError(409, 'MUTATION_IN_PROGRESS', 'Busy');
    this.busy = true;
    try {
      return await operation(() => {});
    } finally {
      this.busy = false;
    }
  }
}
class Upstream
  implements OperatorIdentityClient, AdminUsersClient, EmailClient
{
  readonly users = new Map<string, AdminUser>(
    [first, second, ordinary].map((id) => [id, user(id)]),
  );
  mutations = 0;
  error: UpstreamError | undefined;
  pause: (() => Promise<void>) | undefined;
  createConfirmed: boolean | undefined;
  async passwordLogin(email: string) {
    const identity = [...this.users.values()].find(
      (entry) => entry.email === email,
    );
    if (!identity?.email) throw new UpstreamError('identity');
    return {
      accessToken: identity.id,
      expiresAt: Date.now() + 3600000,
      user: { ...identity, email: identity.email },
    };
  }
  async getIdentity(token: string) {
    const identity = this.users.get(token);
    if (!identity?.email) throw new UpstreamError('identity');
    return { ...identity, email: identity.email };
  }
  async health() {
    return { version: 'v2.196.0' };
  }
  async listUsers(page: number, perPage: number) {
    return [...this.users.values()].slice((page - 1) * perPage, page * perPage);
  }
  async getUser(id: string) {
    const result = this.users.get(id);
    if (!result) throw new UpstreamError('not_found');
    return result;
  }
  async beforeMutation() {
    this.mutations++;
    if (this.error) throw this.error;
    if (this.pause) await this.pause();
  }
  async createUser(email: string, _password: string, confirmed: boolean) {
    await this.beforeMutation();
    this.createConfirmed = confirmed;
    const result = {
      ...user(randomUUID()),
      email,
      email_confirmed_at: confirmed ? '2026-01-01T00:00:00Z' : null,
    };
    this.users.set(result.id, result);
    return result;
  }
  async invite(email: string) {
    await this.beforeMutation();
    const result = [...this.users.values()].find(
      (entry) => entry.email === email,
    ) ?? { ...user(randomUUID()), email, email_confirmed_at: null };
    result.invited_at = '2026-01-01T00:00:00Z';
    this.users.set(result.id, result);
    return result;
  }
  async sendVerification(_email: string) {
    await this.beforeMutation();
  }
  async verify(): Promise<never> {
    throw new UpstreamError('identity');
  }
  async discardSession() {}
  async setBan(id: string, duration: string) {
    await this.beforeMutation();
    const result = await this.getUser(id);
    result.banned_until =
      duration === 'none'
        ? null
        : new Date(
            Date.now() + Number.parseInt(duration) * 3600000,
          ).toISOString();
    return result;
  }
  async deleteUser(id: string) {
    await this.beforeMutation();
    await this.getUser(id);
    this.users.delete(id);
  }
}
const resources: ReturnType<typeof createApp>[] = [];
afterEach(async () => {
  await Promise.all(resources.splice(0).map((resource) => resource.close()));
});
async function setup(deletionAllowed = true) {
  const upstream = new Upstream();
  const sessions = new Sessions();
  const audit = new Audit();
  const config = loadConfig({
    NODE_ENV: 'test',
    GOTRUE_URL: 'http://localhost:8081',
    GOTRUE_ADMIN_TOKEN: 'test-admin-token',
    ADMIN_DATABASE_URL: 'postgresql://unused:unused@localhost/admin_test',
    OPERATOR_UUID_ALLOWLIST: `${first},${second}`,
    SESSION_ENCRYPTION_KEY: Buffer.alloc(32, 19).toString('base64'),
    FRONTEND_ORIGINS: origin,
    LOG_LEVEL: 'silent',
    ALLOW_GLOBAL_USER_DELETION: deletionAllowed ? 'true' : 'false',
  });
  const resource = createApp(config, {
    upstream,
    sessions,
    admin: upstream,
    email: upstream,
    audit,
    mutationLock: new Lock(),
    checkDatabase: async () => {},
  });
  resources.push(resource);
  const login = async (id: string) => {
    const response = await request(resource.app)
      .post('/v1/operator/auth/login')
      .set('Origin', origin)
      .set('X-CSRF-Protection', '1')
      .send({ email: user(id).email, password: 'controlled-password' });
    const header: unknown = response.headers['set-cookie'];
    if (!Array.isArray(header) || typeof header[0] !== 'string')
      throw new Error('Expected login cookie');
    return header[0].split(';')[0] ?? '';
  };
  const cookie = await login(first);
  const mutation = (
    path: string,
    body: object,
    method: 'post' | 'delete' = 'post',
    selectedCookie = cookie,
  ) => {
    const agent = request(resource.app);
    return agent[method](path)
      .set('Origin', origin)
      .set('X-CSRF-Protection', '1')
      .set('Cookie', selectedCookie)
      .send(body);
  };
  return { ...resource, upstream, audit, sessions, cookie, login, mutation };
}
describe('user management and audit HTTP boundaries', () => {
  it('loads one authoritative audit record with UUID validation, missing and dependency errors', async () => {
    const { app, audit, cookie, upstream } = await setup();
    const id = await audit.intent(first, null, 'invite', randomUUID());
    const read = (path: string) => request(app).get(path).set('Cookie', cookie);
    const response = await read(`/v1/operator/audit/${id.toUpperCase()}`);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ entry: audit.rows[0] });
    expect(response.headers['cache-control']).toBe('no-store');
    expect(upstream.mutations).toBe(0);
    expect((await read('/v1/operator/audit/not-a-uuid')).status).toBe(400);
    expect((await read(`/v1/operator/audit/${id}?extra=1`)).status).toBe(400);
    const missing = await read(`/v1/operator/audit/${randomUUID()}`);
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('AUDIT_NOT_FOUND');
    audit.failLookup = true;
    const unavailable = await read(`/v1/operator/audit/${id}`);
    expect(unavailable.status).toBe(503);
    expect(unavailable.body.error.code).toBe('DEPENDENCY_UNAVAILABLE');
    expect(audit.rows).toHaveLength(1);
  });
  it('requires the eligible cookie identity for audit lookup on every request', async () => {
    const { app, cookie, audit, upstream } = await setup();
    const id = await audit.intent(first, ordinary, 'ban', randomUUID());
    expect((await request(app).get(`/v1/operator/audit/${id}`)).status).toBe(
      401,
    );
    expect(
      (
        await request(app)
          .get(`/v1/operator/audit/${id}`)
          .set('Authorization', 'Bearer project-credential')
      ).status,
    ).toBe(401);
    upstream.users.set(first, { ...user(first), email_confirmed_at: null });
    expect(
      (await request(app).get(`/v1/operator/audit/${id}`).set('Cookie', cookie))
        .status,
    ).toBe(403);
  });
  it('audits invitation acceptance and rejects email sends before upstream on invalid targets', async () => {
    const { mutation, audit, upstream } = await setup();
    const invited = await mutation('/v1/operator/users/invitations', {
      email: 'invited@example.test',
      confirmation: 'SEND_INVITATION',
    });
    expect(invited.status).toBe(202);
    expect(audit.rows[0]).toMatchObject({
      action: 'invite',
      outcome: 'succeeded',
      targetId: invited.body.user.id,
    });
    expect(JSON.stringify(invited.body)).not.toContain('access_token');
    expect(
      (
        await mutation(`/v1/operator/users/${ordinary}/send-verification`, {
          targetId: ordinary,
          confirmation: 'SEND_VERIFICATION_EMAIL',
        })
      ).status,
    ).toBe(409);
    expect(upstream.mutations).toBe(1);
    expect(audit.rows[0]).toMatchObject({
      action: 'send_verification',
      outcome: 'failed',
    });
    expect(
      (
        await mutation(`/v1/operator/users/${ordinary}/send-verification`, {
          targetId: second,
          confirmation: 'SEND_VERIFICATION_EMAIL',
        })
      ).status,
    ).toBe(400);
    expect(upstream.mutations).toBe(1);
  });
  it('sends verification only for eligible unconfirmed accounts and reinvites the bound account', async () => {
    const { mutation, upstream, audit } = await setup();
    const target = upstream.users.get(ordinary);
    if (!target) throw new Error('Fixture missing');
    target.email_confirmed_at = null;
    expect(
      (
        await mutation(`/v1/operator/users/${ordinary}/send-verification`, {
          targetId: ordinary,
          confirmation: 'SEND_VERIFICATION_EMAIL',
        })
      ).status,
    ).toBe(202);
    target.invited_at = '2026-01-01T00:00:00Z';
    expect(
      (
        await mutation(`/v1/operator/users/${ordinary}/send-verification`, {
          targetId: ordinary,
          confirmation: 'SEND_VERIFICATION_EMAIL',
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await mutation(`/v1/operator/users/${ordinary}/resend-invitation`, {
          targetId: ordinary,
          confirmation: 'RESEND_INVITATION',
        })
      ).status,
    ).toBe(202);
    expect(upstream.mutations).toBe(2);
    expect(audit.rows[0]).toMatchObject({
      action: 'invite',
      targetId: ordinary,
      outcome: 'succeeded',
    });
  });
  it('fails closed before sending without durable audit and retains uncertain email outcomes without retry', async () => {
    const { mutation, audit, upstream } = await setup();
    audit.failIntent = true;
    expect(
      (
        await mutation('/v1/operator/users/invitations', {
          email: 'invited@example.test',
          confirmation: 'SEND_INVITATION',
        })
      ).status,
    ).toBe(503);
    expect(upstream.mutations).toBe(0);
    audit.failIntent = false;
    upstream.error = new UpstreamError('unavailable', true);
    const response = await mutation('/v1/operator/users/invitations', {
      email: 'invited@example.test',
      confirmation: 'SEND_INVITATION',
    });
    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({
      outcome: 'unknown',
      auditId: audit.rows[0]?.id,
    });
    expect(upstream.mutations).toBe(1);
    expect(audit.rows[0]).toMatchObject({
      action: 'invite',
      outcome: 'unknown',
    });
  });
  it('requires operator sessions for list, details, mutation and audit', async () => {
    const { app } = await setup();
    for (const path of [
      '/v1/operator/users',
      `/v1/operator/users/${ordinary}`,
      '/v1/operator/audit',
    ])
      expect(
        (
          await request(app)
            .get(path)
            .set('Authorization', 'Bearer platform-token')
        ).status,
      ).toBe(401);
    expect(
      (await request(app).post('/v1/operator/users').send({})).status,
    ).toBe(401);
  });
  it('returns safe fields, bounded pagination, not-found and unknown-field errors', async () => {
    const { app, cookie } = await setup();
    const response = await request(app)
      .get('/v1/operator/users?perPage=2')
      .set('Cookie', cookie);
    expect(response.status).toBe(200);
    expect(response.body.users).toHaveLength(2);
    expect(response.body.hasNextPage).toBe(true);
    expect(Object.keys(response.body.users[0]).sort()).toEqual(
      [
        'bannedUntil',
        'createdAt',
        'email',
        'emailConfirmedAt',
        'id',
        'invitedAt',
        'isBanned',
        'lastSignInAt',
      ].sort(),
    );
    expect(
      (
        await request(app)
          .get('/v1/operator/users?perPage=101')
          .set('Cookie', cookie)
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .get('/v1/operator/users?filter=secret')
          .set('Cookie', cookie)
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .get('/v1/operator/users/not-a-uuid')
          .set('Cookie', cookie)
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .get(`/v1/operator/users/${randomUUID()}`)
          .set('Cookie', cookie)
      ).status,
    ).toBe(404);
  });
  it('creates only explicitly confirmed-policy accounts, records target, and never stores password', async () => {
    const { mutation, upstream, audit } = await setup();
    const response = await mutation('/v1/operator/users', {
      email: 'controlled@example.test',
      password: 'controlled-password',
      confirmation: 'require_verification',
    });
    expect(response.status).toBe(201);
    expect(upstream.createConfirmed).toBe(false);
    expect(audit.rows[0]?.outcome).toBe('succeeded');
    expect(audit.rows[0]?.targetId).toBe(response.body.user.id);
    expect(JSON.stringify(audit.rows)).not.toContain('password');
    expect(JSON.stringify(response.body)).not.toContain('password');
    expect(
      (
        await mutation('/v1/operator/users', {
          email: 'controlled@example.test',
          password: 'controlled-password',
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await mutation('/v1/operator/users', {
          email: 'controlled@example.test',
          password: 'é'.repeat(40),
          confirmation: 'operator_confirmed',
        })
      ).status,
    ).toBe(400);
  });
  it('blocks upstream if intent storage fails', async () => {
    const { mutation, audit, upstream } = await setup();
    audit.failIntent = true;
    expect(
      (
        await mutation('/v1/operator/users', {
          email: 'controlled@example.test',
          password: 'controlled-password',
          confirmation: 'operator_confirmed',
        })
      ).status,
    ).toBe(503);
    expect(upstream.mutations).toBe(0);
  });
  it('records known rejection and duplicate safely', async () => {
    const { mutation, audit, upstream } = await setup();
    upstream.error = new UpstreamError('conflict');
    const response = await mutation('/v1/operator/users', {
      email: 'controlled@example.test',
      password: 'controlled-password',
      confirmation: 'operator_confirmed',
    });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('USER_EXISTS');
    expect(audit.rows[0]?.outcome).toBe('failed');
  });
  it('records ambiguous upstream outcomes without retrying', async () => {
    const { mutation, audit, upstream } = await setup();
    upstream.error = new UpstreamError('unavailable', true);
    const response = await mutation(`/v1/operator/users/${ordinary}/ban`, {
      targetId: ordinary,
      confirmation: 'BAN_GLOBAL_USER',
      durationHours: 24,
    });
    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe('UPSTREAM_OUTCOME_UNKNOWN');
    expect(response.body.auditId).toBe(audit.rows[0]?.id);
    expect(audit.rows[0]?.outcome).toBe('unknown');
    expect(upstream.mutations).toBe(1);
  });
  it('returns an honest partial outcome when completion storage fails after success', async () => {
    const { mutation, audit, upstream } = await setup();
    audit.failCompletion = true;
    const response = await mutation(`/v1/operator/users/${ordinary}/ban`, {
      targetId: ordinary,
      confirmation: 'BAN_GLOBAL_USER',
      durationHours: 1,
    });
    expect(response.status).toBe(503);
    expect(response.body.outcome).toBe('succeeded');
    expect(response.body.error.code).toBe('AUDIT_COMPLETION_FAILED');
    expect(audit.rows[0]?.outcome).toBe('pending');
    expect(upstream.users.get(ordinary)?.banned_until).toBeTruthy();
  });
  it('requires explicit matching target and bounds the ban duration before intent', async () => {
    const { mutation, audit } = await setup();
    for (const body of [
      {
        targetId: ordinary,
        confirmation: 'BAN_GLOBAL_USER',
        durationHours: 8761,
      },
      { targetId: first, confirmation: 'BAN_GLOBAL_USER', durationHours: 1 },
      {
        targetId: ordinary,
        confirmation: 'BAN_GLOBAL_USER',
        durationHours: 1,
        role: 'admin',
      },
    ])
      expect(
        (await mutation(`/v1/operator/users/${ordinary}/ban`, body)).status,
      ).toBe(400);
    expect(audit.rows).toHaveLength(0);
  });
  it('protects last operator and refuses to count an allowlist UUID without usable password-session proof', async () => {
    const { mutation, audit, upstream } = await setup();
    const response = await mutation(`/v1/operator/users/${first}/ban`, {
      targetId: first,
      confirmation: 'BAN_GLOBAL_USER',
      durationHours: 1,
    });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('LAST_USABLE_OPERATOR');
    expect(upstream.mutations).toBe(0);
    expect(audit.rows[0]?.outcome).toBe('failed');
  });
  it('allows removal with another signed-in operator and then protects the remaining operator', async () => {
    const { mutation, login } = await setup();
    const secondCookie = await login(second);
    expect(
      (
        await mutation(`/v1/operator/users/${first}/ban`, {
          targetId: first,
          confirmation: 'BAN_GLOBAL_USER',
          durationHours: 1,
        })
      ).status,
    ).toBe(200);
    const response = await mutation(
      `/v1/operator/users/${second}`,
      { targetId: second, confirmation: 'DELETE_GLOBAL_USER_PERMANENTLY' },
      'delete',
      secondCookie,
    );
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('LAST_USABLE_OPERATOR');
  });
  it('does not count missing, banned or unverified alternatives', async () => {
    const { mutation, login, upstream } = await setup();
    await login(second);
    const candidate = await upstream.getUser(second);
    candidate.email_confirmed_at = null;
    expect(
      (
        await mutation(`/v1/operator/users/${first}/ban`, {
          targetId: first,
          confirmation: 'BAN_GLOBAL_USER',
          durationHours: 1,
        })
      ).status,
    ).toBe(409);
    upstream.users.delete(second);
    expect(
      (
        await mutation(`/v1/operator/users/${first}/ban`, {
          targetId: first,
          confirmation: 'BAN_GLOBAL_USER',
          durationHours: 1,
        })
      ).status,
    ).toBe(409);
  });
  it('prevents simultaneous operator removals', async () => {
    const { mutation, login, upstream } = await setup();
    const secondCookie = await login(second);
    let signalStarted: (() => void) | undefined;
    let signalRelease: (() => void) | undefined;
    const started = new Promise<void>((resolve) => {
      signalStarted = resolve;
    });
    const release = new Promise<void>((resolve) => {
      signalRelease = resolve;
    });
    upstream.pause = async () => {
      signalStarted?.();
      await release;
    };
    const firstAction = mutation(`/v1/operator/users/${first}/ban`, {
      targetId: first,
      confirmation: 'BAN_GLOBAL_USER',
      durationHours: 1,
    }).then((response) => response);
    await started;
    const secondAction = await mutation(
      `/v1/operator/users/${second}/ban`,
      { targetId: second, confirmation: 'BAN_GLOBAL_USER', durationHours: 1 },
      'post',
      secondCookie,
    );
    expect(secondAction.status).toBe(409);
    expect(secondAction.body.error.code).toBe('MUTATION_IN_PROGRESS');
    signalRelease?.();
    expect((await firstAction).status).toBe(200);
    expect(upstream.mutations).toBe(1);
  });
  it('fails closed for unresolved pending/unknown destructive operator intent', async () => {
    const { mutation, login, audit, upstream } = await setup();
    await login(second);
    await audit.intent(second, second, 'ban', randomUUID());
    const response = await mutation(`/v1/operator/users/${first}/ban`, {
      targetId: first,
      confirmation: 'BAN_GLOBAL_USER',
      durationHours: 1,
    });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('RECONCILIATION_REQUIRED');
    expect(upstream.mutations).toBe(0);
  });
  it('unbans and permanently deletes controlled ordinary users with audit outcomes', async () => {
    const { mutation, audit, upstream } = await setup();
    expect(
      (
        await mutation(`/v1/operator/users/${ordinary}/unban`, {
          targetId: ordinary,
          confirmation: 'UNBAN_GLOBAL_USER',
        })
      ).status,
    ).toBe(200);
    const response = await mutation(
      `/v1/operator/users/${ordinary}`,
      { targetId: ordinary, confirmation: 'DELETE_GLOBAL_USER_PERMANENTLY' },
      'delete',
    );
    expect(response.status).toBe(200);
    expect(response.body.deleted).toBe(true);
    expect(upstream.users.has(ordinary)).toBe(false);
    expect(audit.rows[0]?.outcome).toBe('succeeded');
    expect(
      (
        await mutation(
          `/v1/operator/users/${ordinary}`,
          {
            targetId: ordinary,
            confirmation: 'DELETE_GLOBAL_USER_PERMANENTLY',
          },
          'delete',
        )
      ).status,
    ).toBe(404);
  });
  it('disables permanent deletion until explicitly configured', async () => {
    const { mutation, upstream } = await setup(false);
    const response = await mutation(
      `/v1/operator/users/${ordinary}`,
      { targetId: ordinary, confirmation: 'DELETE_GLOBAL_USER_PERMANENTLY' },
      'delete',
    );
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('DELETION_DISABLED');
    expect(upstream.mutations).toBe(0);
  });
  it('returns bounded audit history with request correlation and no credentials', async () => {
    const { app, cookie, mutation } = await setup();
    const response = await mutation(`/v1/operator/users/${ordinary}/unban`, {
      targetId: ordinary,
      confirmation: 'UNBAN_GLOBAL_USER',
    });
    const history = await request(app)
      .get('/v1/operator/audit?perPage=1')
      .set('Cookie', cookie);
    expect(history.status).toBe(200);
    expect(history.body.entries[0].requestId).toBe(
      response.headers['x-request-id'],
    );
    expect(history.body.entries[0].outcome).toBe('succeeded');
    expect(JSON.stringify(history.body)).not.toContain('token');
    expect(
      (
        await request(app)
          .get('/v1/operator/audit?perPage=101')
          .set('Cookie', cookie)
      ).status,
    ).toBe(400);
  });
  it('enforces CSRF on management mutations', async () => {
    const { app, cookie, upstream } = await setup();
    expect(
      (
        await request(app)
          .post('/v1/operator/users')
          .set('Cookie', cookie)
          .send({})
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .delete(`/v1/operator/users/${ordinary}`)
          .set('Cookie', cookie)
          .set('Origin', 'https://evil.example')
          .send({})
      ).status,
    ).toBe(403);
    expect(upstream.mutations).toBe(0);
  });
});
