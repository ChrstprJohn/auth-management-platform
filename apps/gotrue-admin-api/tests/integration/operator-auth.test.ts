import { afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  UpstreamError,
  type Identity,
  type OperatorIdentityClient,
  type PasswordSession,
} from '@auth/gotrue-client';
import { createApp } from '../../src/app.js';
import { loadConfig } from '../../src/config/env.js';
import type {
  SessionStore,
  StoredSession,
} from '../../src/modules/operator-auth/session.repository.js';
import { unavailable } from '../../src/shared/errors/api-error.js';

const operatorId = '00000000-0000-4000-8000-000000000001';
const otherId = '00000000-0000-4000-8000-000000000002';
const origin = 'http://localhost:5173';
class MemorySessions implements SessionStore {
  readonly rows = new Map<string, StoredSession>();
  fail = false;
  async create(session: StoredSession) {
    if (this.fail) throw unavailable();
    this.rows.set(session.hash, session);
  }
  async find(hash: string) {
    if (this.fail) throw unavailable();
    return this.rows.get(hash) ?? null;
  }
  async delete(hash: string) {
    if (this.fail) throw unavailable();
    this.rows.delete(hash);
  }
  async deleteForOperator(id: string) {
    for (const [hash, row] of this.rows)
      if (row.operatorId === id) this.rows.delete(hash);
  }
  async findForOperator(id: string) {
    return [...this.rows.values()]
      .filter(
        (row) => row.operatorId === id && row.expiresAt.getTime() > Date.now(),
      )
      .slice(0, 5);
  }
}
class FakeGoTrue implements OperatorIdentityClient {
  user: Identity = {
    id: operatorId,
    email: 'operator@example.test',
    email_confirmed_at: '2026-01-01T00:00:00Z',
    banned_until: null,
  };
  error: UpstreamError | undefined;
  expiresAt = Date.now() + 7200000;
  validations = 0;
  async passwordLogin(): Promise<PasswordSession> {
    if (this.error) throw this.error;
    return {
      user: this.user,
      accessToken: 'sensitive-upstream-token',
      expiresAt: this.expiresAt,
    };
  }
  async getIdentity(): Promise<Identity> {
    this.validations++;
    if (this.error) throw this.error;
    return this.user;
  }
  async health() {
    if (this.error) throw this.error;
    return { version: 'v2.196.0' };
  }
}
const resources: Array<ReturnType<typeof createApp>> = [];
afterEach(async () => {
  await Promise.all(resources.splice(0).map((resource) => resource.close()));
});
function setup(production = false) {
  const sessions = new MemorySessions();
  const upstream = new FakeGoTrue();
  const config = loadConfig({
    GOTRUE_ADMIN_TOKEN: 'test-admin-token',
    NODE_ENV: production ? 'production' : 'test',
    GOTRUE_URL: 'http://localhost:8081',
    ADMIN_DATABASE_URL: 'postgresql://unused:unused@localhost/admin_test',
    OPERATOR_UUID_ALLOWLIST: operatorId,
    SESSION_ENCRYPTION_KEY: Buffer.alloc(32, 17).toString('base64'),
    FRONTEND_ORIGINS: production ? 'https://admin.chrbuilds.dev' : origin,
    LOG_LEVEL: 'silent',
  });
  const resource = createApp(config, {
    upstream,
    sessions,
    checkDatabase: async () => {
      if (sessions.fail) throw unavailable();
    },
  });
  resources.push(resource);
  return { ...resource, sessions, upstream, config };
}
async function login(
  app: ReturnType<typeof createApp>['app'],
  selectedOrigin = origin,
) {
  return request(app)
    .post('/v1/operator/auth/login')
    .set('Origin', selectedOrigin)
    .set('X-CSRF-Protection', '1')
    .send({ email: 'operator@example.test', password: 'controlled-password' });
}
function cookieOf(response: Awaited<ReturnType<typeof login>>): string {
  return cookieHeaderOf(response).split(';')[0] ?? '';
}
function cookieHeaderOf(response: Awaited<ReturnType<typeof login>>): string {
  const header: unknown = response.headers['set-cookie'];
  if (!Array.isArray(header) || typeof header[0] !== 'string')
    throw new Error('Expected cookie');
  return header[0];
}

describe('operator HTTP boundary', () => {
  it('protects safe upstream version information behind an operator session', async () => {
    const { app } = setup();
    expect((await request(app).get('/v1/operator/health')).status).toBe(401);
    const cookie = cookieOf(await login(app));
    const response = await request(app)
      .get('/v1/operator/health')
      .set('Cookie', cookie);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'reachable', version: 'v2.196.0' });
  });
  it('stores only a hash/encrypted token, returns safe identity, and revalidates every request', async () => {
    const { app, sessions, upstream } = setup();
    const response = await login(app);
    expect(response.status).toBe(200);
    expect(JSON.stringify(response.body)).not.toContain('token');
    const cookie = cookieOf(response);
    const row = [...sessions.rows.values()][0];
    expect(row?.hash).not.toBe(cookie.split('=')[1]);
    expect(row?.token.ciphertext.toString()).not.toContain(
      'sensitive-upstream-token',
    );
    expect(
      (row?.expiresAt.getTime() ?? 0) - (row?.createdAt.getTime() ?? 0),
    ).toBe(3600000);
    expect(cookieHeaderOf(response)).toContain('HttpOnly');
    expect(cookieHeaderOf(response)).toContain('SameSite=Lax');
    expect(
      (await request(app).get('/v1/operator/auth/me').set('Cookie', cookie))
        .status,
    ).toBe(200);
    expect(
      (await request(app).get('/v1/operator/auth/me').set('Cookie', cookie))
        .status,
    ).toBe(200);
    expect(upstream.validations).toBe(2);
  });
  it('rejects valid ordinary accounts without persisting a session', async () => {
    const { app, upstream, sessions } = setup();
    upstream.user.id = otherId;
    const response = await login(app);
    expect(response.status).toBe(403);
    expect(sessions.rows.size).toBe(0);
    expect(response.headers['set-cookie']).toBeUndefined();
  });
  it('rejects wrong credentials with safe errors and request correlation', async () => {
    const { app, upstream } = setup();
    upstream.error = new UpstreamError('identity');
    const response = await login(app);
    expect(response.status).toBe(401);
    expect(response.body.requestId).toBe(response.headers['x-request-id']);
    expect(response.body.error.code).toBe('AUTHENTICATION_REQUIRED');
  });
  it('rejects absent, malformed, expired and tampered sessions', async () => {
    const { app, sessions } = setup();
    expect((await request(app).get('/v1/operator/auth/me')).status).toBe(401);
    expect(
      (
        await request(app)
          .get('/v1/operator/auth/me')
          .set('Cookie', 'operator_session=bad')
      ).status,
    ).toBe(401);
    const cookie = cookieOf(await login(app));
    const row = [...sessions.rows.values()][0];
    if (!row) throw new Error('Expected session');
    row.expiresAt = new Date(0);
    expect(
      (await request(app).get('/v1/operator/auth/me').set('Cookie', cookie))
        .status,
    ).toBe(401);
    row.expiresAt = new Date(Date.now() + 10000);
    row.token.tag = Buffer.alloc(16);
    expect(
      (await request(app).get('/v1/operator/auth/me').set('Cookie', cookie))
        .status,
    ).toBe(401);
  });
  it('fails closed for removal from allowlist, identity mismatch, bans and upstream outages', async () => {
    const { app, config, upstream } = setup();
    const cookie = cookieOf(await login(app));
    config.OPERATOR_UUID_ALLOWLIST.delete(operatorId);
    expect(
      (await request(app).get('/v1/operator/auth/me').set('Cookie', cookie))
        .status,
    ).toBe(403);
    config.OPERATOR_UUID_ALLOWLIST.add(operatorId);
    upstream.user.id = otherId;
    expect(
      (await request(app).get('/v1/operator/auth/me').set('Cookie', cookie))
        .status,
    ).toBe(401);
    upstream.user.id = operatorId;
    upstream.user.banned_until = new Date(Date.now() + 60000).toISOString();
    expect(
      (await request(app).get('/v1/operator/auth/me').set('Cookie', cookie))
        .status,
    ).toBe(403);
    upstream.error = new UpstreamError('unavailable');
    expect(
      (await request(app).get('/v1/operator/auth/me').set('Cookie', cookie))
        .status,
    ).toBe(503);
  });
  it('caps session expiry by upstream expiry and rejects an already expired token', async () => {
    const { app, upstream } = setup();
    upstream.expiresAt = Date.now() + 30000;
    const response = await login(app);
    expect(Date.parse(response.body.expiresAt)).toBe(upstream.expiresAt);
    upstream.expiresAt = Date.now() - 1000;
    expect((await login(app)).status).toBe(401);
  });
  it('enforces exact Origin, custom CSRF header and credentialed preflight', async () => {
    const { app } = setup();
    expect(
      (
        await request(app)
          .post('/v1/operator/auth/login')
          .send({ email: 'operator@example.test', password: 'password' })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .post('/v1/operator/auth/logout')
          .set('Origin', origin)
      ).status,
    ).toBe(403);
    expect((await login(app, 'http://localhost:5173.evil.test')).status).toBe(
      403,
    );
    const response = await request(app)
      .options('/v1/operator/auth/login')
      .set('Origin', origin)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'Content-Type,X-CSRF-Protection');
    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe(origin);
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });
  it('validates unknown fields, content type, invalid JSON and oversized bodies', async () => {
    const { app } = setup();
    const post = () =>
      request(app)
        .post('/v1/operator/auth/login')
        .set('Origin', origin)
        .set('X-CSRF-Protection', '1');
    expect(
      (
        await post().send({
          email: 'operator@example.test',
          password: 'password',
          role: 'admin',
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await post()
          .type('form')
          .send({ email: 'operator@example.test', password: 'password' })
      ).status,
    ).toBe(415);
    expect(
      (await post().set('Content-Type', 'application/json').send('{')).status,
    ).toBe(400);
    expect(
      (
        await post().send({
          email: 'operator@example.test',
          password: 'a'.repeat(20000),
        })
      ).status,
    ).toBe(413);
  });
  it('logout is idempotent and does not claim success if storage deletion fails', async () => {
    const { app, sessions } = setup();
    const cookie = cookieOf(await login(app));
    const logout = () =>
      request(app)
        .post('/v1/operator/auth/logout')
        .set('Origin', origin)
        .set('X-CSRF-Protection', '1')
        .set('Cookie', cookie);
    sessions.fail = true;
    expect((await logout()).status).toBe(503);
    sessions.fail = false;
    const response = await logout();
    expect(response.status).toBe(204);
    expect(cookieHeaderOf(response)).toContain('Expires=Thu, 01 Jan 1970');
    expect((await logout()).status).toBe(204);
    expect(
      (await request(app).get('/v1/operator/auth/me').set('Cookie', cookie))
        .status,
    ).toBe(401);
  });
  it('liveness survives dependency failure while readiness fails safely', async () => {
    const { app, sessions } = setup();
    expect((await request(app).get('/health/ready')).status).toBe(200);
    sessions.fail = true;
    expect((await request(app).get('/health/live')).status).toBe(200);
    expect((await request(app).get('/health/ready')).body).toEqual({
      status: 'unavailable',
    });
  });
  it('enforces login rate limits', async () => {
    const { app, upstream } = setup();
    upstream.error = new UpstreamError('identity');
    for (let index = 0; index < 10; index++)
      expect((await login(app)).status).toBe(401);
    expect((await login(app)).status).toBe(429);
  });
  it('sets a secure host-only production cookie', async () => {
    const { app } = setup(true);
    const response = await login(app, 'https://admin.chrbuilds.dev');
    const header = cookieHeaderOf(response);
    expect(header).toContain('__Host-operator_session=');
    expect(header).toContain('Secure');
    expect(header).not.toContain('Domain=');
  });
});
