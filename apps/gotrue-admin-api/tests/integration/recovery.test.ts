import { afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { z } from 'zod';
import {
  UpstreamError,
  type Identity,
  type OperatorIdentityClient,
  type RecoveryClient,
} from '@auth/gotrue-client';
import { createApp } from '../../src/app.js';
import { loadConfig } from '../../src/config/env.js';
import type {
  RecoveryContext,
  RecoveryStore,
} from '../../src/modules/recovery/recovery.repository.js';
import { unavailable } from '../../src/shared/errors/api-error.js';

const operatorId = '11111111-1111-4111-8111-111111111111';
const code = '22222222-2222-4222-8222-222222222222';
const origin = 'http://localhost:5173';
class MemoryRecovery implements RecoveryStore {
  rows = new Map<string, { context: RecoveryContext; phase: string }>();
  fail = false;
  failComplete = false;
  invalidations = 0;
  async create(context: RecoveryContext) {
    if (this.fail) throw unavailable();
    this.rows.set(context.hash, { context, phase: 'pending' });
  }
  private claim(hash: string, before: string, after: string) {
    if (this.fail) throw unavailable();
    const row = this.rows.get(hash);
    if (
      !row ||
      row.phase !== before ||
      row.context.expiresAt.getTime() <= Date.now()
    )
      return null;
    row.phase = after;
    return row.context;
  }
  async claimCallback(hash: string) {
    return this.claim(hash, 'pending', 'exchanging');
  }
  async ready(
    hash: string,
    operatorId: string,
    secret: RecoveryContext['secret'],
    expiresAt: Date,
  ) {
    if (this.fail) throw unavailable();
    const row = this.rows.get(hash);
    if (!row || row.phase !== 'exchanging') throw unavailable();
    row.context = { ...row.context, operatorId, secret, expiresAt };
    row.phase = 'ready';
  }
  async claimReset(hash: string) {
    const context = this.claim(hash, 'ready', 'resetting');
    if (context) this.invalidations++;
    return context;
  }
  async complete(hash: string, operatorId: string) {
    if (this.failComplete) throw unavailable();
    this.invalidations++;
    this.rows.delete(hash);
    for (const [key, row] of this.rows)
      if (row.context.operatorId === operatorId) this.rows.delete(key);
  }
}
class FakeRecovery implements RecoveryClient, OperatorIdentityClient {
  user: Identity = {
    id: operatorId,
    email: 'operator@example.test',
    email_confirmed_at: '2026-01-01T00:00:00Z',
  };
  sendError: UpstreamError | undefined;
  exchangeError: UpstreamError | undefined;
  updateError: UpstreamError | undefined;
  callback = '';
  challenge = '';
  exchangeCalls = 0;
  updates = 0;
  expiresAt = Date.now() + 3600000;
  async sendRecovery(_email: string, challenge: string, callback: string) {
    this.callback = callback;
    this.challenge = challenge;
    if (this.sendError) throw this.sendError;
  }
  async exchangeRecovery() {
    this.exchangeCalls++;
    if (this.exchangeError) throw this.exchangeError;
    return {
      user: this.user,
      accessToken: 'upstream-recovery-secret',
      expiresAt: this.expiresAt,
    };
  }
  async updatePassword() {
    this.updates++;
    if (this.updateError) throw this.updateError;
  }
  async getIdentity() {
    return this.user;
  }
  async passwordLogin() {
    return {
      user: this.user,
      accessToken: 'ordinary-login-secret',
      expiresAt: this.expiresAt,
    };
  }
  async health() {
    return { version: 'v2.196.0' };
  }
}
const resources: Array<ReturnType<typeof createApp>> = [];
afterEach(async () => {
  await Promise.all(resources.splice(0).map((resource) => resource.close()));
});
function setup(production = false) {
  const upstream = new FakeRecovery();
  const store = new MemoryRecovery();
  const config = loadConfig({
    NODE_ENV: production ? 'production' : 'test',
    GOTRUE_ADMIN_TOKEN: 'test-admin',
    GOTRUE_URL: 'http://localhost:8081',
    ADMIN_DATABASE_URL: 'postgresql://unused:unused@localhost/test',
    OPERATOR_UUID_ALLOWLIST: operatorId,
    SESSION_ENCRYPTION_KEY: Buffer.alloc(32, 8).toString('base64'),
    FRONTEND_ORIGINS: production ? 'https://admin.chrbuilds.dev' : origin,
    RECOVERY_CALLBACK_URL: production
      ? 'https://admin-api.chrbuilds.dev/v1/operator/auth/recovery/callback'
      : 'http://localhost:3100/v1/operator/auth/recovery/callback',
    RECOVERY_RESET_URL: production
      ? 'https://admin.chrbuilds.dev/reset-password'
      : `${origin}/reset-password`,
    LOG_LEVEL: 'silent',
  });
  const resource = createApp(config, {
    upstream,
    recovery: upstream,
    recoveryStore: store,
    checkDatabase: async () => {},
  });
  resources.push(resource);
  return { ...resource, upstream, store, config };
}
async function start(app: ReturnType<typeof createApp>['app']) {
  const response = await request(app)
    .post('/v1/operator/auth/forgot-password')
    .set('Origin', origin)
    .set('X-CSRF-Protection', '1')
    .send({ email: 'operator@example.test' });
  expect(response.status).toBe(202);
  const cookie = responseCookies(response)[0];
  if (typeof cookie !== 'string') throw new Error('Expected recovery cookie');
  const pair = cookie.split(';')[0];
  const state = pair?.split('=')[1];
  if (!pair || !state) throw new Error('Expected recovery state');
  return { response, pair, state };
}
function responseCookies(response: {
  headers: Record<string, unknown>;
}): string[] {
  return z.array(z.string()).parse(response.headers['set-cookie'] ?? []);
}
async function ready(resource: ReturnType<typeof setup>) {
  const context = await start(resource.app);
  const response = await request(resource.app)
    .get('/v1/operator/auth/recovery/callback')
    .query({ code, state: context.state })
    .set('Cookie', context.pair);
  expect(response.status).toBe(303);
  return context;
}
function reset(app: ReturnType<typeof createApp>['app'], cookie: string) {
  return request(app)
    .post('/v1/operator/auth/reset-password')
    .set('Origin', origin)
    .set('X-CSRF-Protection', '1')
    .set('Cookie', cookie)
    .send({ password: 'new-controlled-password' });
}
describe('operator recovery boundaries', () => {
  it('returns the same generic response for absent accounts and upstream send errors', async () => {
    const resource = setup();
    const first = await start(resource.app);
    resource.upstream.sendError = new UpstreamError('unavailable', true);
    const second = await start(resource.app);
    expect(second.response.body).toEqual(first.response.body);
    expect(JSON.stringify(second.response.body)).not.toContain(
      'operator@example.test',
    );
    expect(resource.upstream.challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(new URL(resource.upstream.callback).pathname).toBe(
      '/v1/operator/auth/recovery/callback',
    );
  });
  it('uses encrypted, hashed storage and separate HttpOnly cookies without operator sessions', async () => {
    const resource = setup();
    const context = await start(resource.app);
    expect(responseCookies(context.response)[0]).toContain('HttpOnly');
    expect(responseCookies(context.response)[0]).toContain('SameSite=Lax');
    const row = [...resource.store.rows.values()][0];
    expect(row?.context.hash).not.toBe(context.state);
    expect(row?.context.secret.nonce).toHaveLength(12);
    expect(row?.context.operatorId).toBeNull();
    expect(JSON.stringify(context.response.body)).not.toContain(context.state);
  });
  it('requires CSRF, exact Origin, JSON and allowed fields for both POSTs', async () => {
    const { app } = setup();
    for (const route of ['forgot-password', 'reset-password']) {
      expect(
        (await request(app).post(`/v1/operator/auth/${route}`).send({})).status,
      ).toBe(403);
      expect(
        (
          await request(app)
            .post(`/v1/operator/auth/${route}`)
            .set('Origin', 'http://evil.test')
            .set('X-CSRF-Protection', '1')
            .send({})
        ).status,
      ).toBe(403);
      expect(
        (
          await request(app)
            .post(`/v1/operator/auth/${route}`)
            .set('Origin', origin)
            .set('X-CSRF-Protection', '1')
            .type('form')
            .send({})
        ).status,
      ).toBe(415);
    }
    expect(
      (
        await request(app)
          .post('/v1/operator/auth/forgot-password')
          .set('Origin', origin)
          .set('X-CSRF-Protection', '1')
          .send({
            email: 'operator@example.test',
            redirect: 'http://evil.test',
          })
      ).status,
    ).toBe(400);
  });
  it('rate-limits recovery requests without identity-dependent responses', async () => {
    const { app } = setup();
    for (let attempt = 0; attempt < 5; attempt++) await start(app);
    const sixth = await request(app)
      .post('/v1/operator/auth/forgot-password')
      .set('Origin', origin)
      .set('X-CSRF-Protection', '1')
      .send({ email: 'absent@example.test' });
    expect(sixth.status).toBe(429);
    expect(sixth.headers['retry-after']).toBeDefined();
  });
  it('requires the same browser and matching state before consuming any code', async () => {
    const resource = setup();
    const context = await start(resource.app);
    const path = '/v1/operator/auth/recovery/callback';
    expect(
      (
        await request(resource.app)
          .get(path)
          .query({ code, state: context.state })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(resource.app)
          .get(path)
          .query({ code, state: 'a'.repeat(43) })
          .set('Cookie', context.pair)
      ).status,
    ).toBe(400);
    expect(resource.upstream.exchangeCalls).toBe(0);
  });
  it('redirects to the fixed reset page, caps expiry and rejects callback replay', async () => {
    const resource = setup();
    const context = await ready(resource);
    const row = [...resource.store.rows.values()][0];
    expect(row?.context.expiresAt.getTime()).toBeLessThanOrEqual(
      Date.now() + 600000,
    );
    const replay = await request(resource.app)
      .get('/v1/operator/auth/recovery/callback')
      .query({ code, state: context.state })
      .set('Cookie', context.pair);
    expect(replay.status).toBe(400);
    expect(resource.upstream.exchangeCalls).toBe(1);
  });
  it('rejects ordinary accounts and mismatched emails without a reset grant', async () => {
    for (const override of [
      { id: '33333333-3333-4333-8333-333333333333' },
      { email: 'other@example.test' },
      { banned_until: '2099-01-01T00:00:00Z' },
    ]) {
      const resource = setup();
      const context = await start(resource.app);
      resource.upstream.user = { ...resource.upstream.user, ...override };
      const result = await request(resource.app)
        .get('/v1/operator/auth/recovery/callback')
        .query({ code, state: context.state })
        .set('Cookie', context.pair);
      expect(result.status).toBe(400);
      expect((await reset(resource.app, context.pair)).status).toBe(400);
      expect(resource.upstream.updates).toBe(0);
    }
  });
  it('rejects expired, pending and ordinary operator cookies as reset authority', async () => {
    const resource = setup();
    const context = await start(resource.app);
    expect((await reset(resource.app, context.pair)).status).toBe(400);
    expect(
      (await reset(resource.app, `operator_session=${context.state}`)).status,
    ).toBe(400);
    for (const row of resource.store.rows.values())
      row.context.expiresAt = new Date(0);
    expect(
      (
        await request(resource.app)
          .get('/v1/operator/auth/recovery/callback')
          .query({ code, state: context.state })
          .set('Cookie', context.pair)
      ).status,
    ).toBe(400);
  });
  it('invalidates sessions before and after update, clears cookies and never signs in', async () => {
    const resource = setup();
    const context = await ready(resource);
    const response = await reset(resource.app, context.pair);
    expect(response.status).toBe(204);
    expect(resource.store.invalidations).toBe(2);
    expect(resource.upstream.updates).toBe(1);
    expect(responseCookies(response).join(';')).toContain('operator_session=;');
    expect((await reset(resource.app, context.pair)).status).toBe(400);
  });
  it('serializes concurrent use of a reset context', async () => {
    const resource = setup();
    const context = await ready(resource);
    const responses = await Promise.all([
      reset(resource.app, context.pair),
      reset(resource.app, context.pair),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([
      204, 400,
    ]);
    expect(resource.upstream.updates).toBe(1);
  });
  it('rechecks operator eligibility at reset', async () => {
    const resource = setup();
    const context = await ready(resource);
    resource.config.OPERATOR_UUID_ALLOWLIST.clear();
    expect((await reset(resource.app, context.pair)).status).toBe(400);
    expect(resource.upstream.updates).toBe(0);
  });
  it('blocks upstream changes on storage failure and consumes uncertain outcomes', async () => {
    const resource = setup();
    const context = await ready(resource);
    resource.store.fail = true;
    expect((await reset(resource.app, context.pair)).status).toBe(503);
    expect(resource.upstream.updates).toBe(0);
    resource.store.fail = false;
    resource.upstream.updateError = new UpstreamError('unavailable', true);
    const response = await reset(resource.app, context.pair);
    expect(response.body.error.code).toBe('PASSWORD_RESET_OUTCOME_UNKNOWN');
    expect((await reset(resource.app, context.pair)).status).toBe(400);
    expect(resource.upstream.updates).toBe(1);
  });
  it('reports password-applied cleanup failure honestly', async () => {
    const resource = setup();
    const context = await ready(resource);
    resource.store.failComplete = true;
    const response = await reset(resource.app, context.pair);
    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe('PASSWORD_RESET_COMPLETION_FAILED');
    expect(resource.store.invalidations).toBe(1);
    expect((await reset(resource.app, context.pair)).status).toBe(400);
  });
  it('rejects extra reset fields and oversized UTF-8 passwords before consuming context', async () => {
    const resource = setup();
    const context = await ready(resource);
    const response = await request(resource.app)
      .post('/v1/operator/auth/reset-password')
      .set('Origin', origin)
      .set('X-CSRF-Protection', '1')
      .set('Cookie', context.pair)
      .send({ password: '😀'.repeat(19), access_token: 'arbitrary' });
    expect(response.status).toBe(400);
    expect(resource.upstream.updates).toBe(0);
    expect((await reset(resource.app, context.pair)).status).toBe(204);
  });
  it('sets a secure host-only recovery cookie in production', async () => {
    const { app } = setup(true);
    const response = await request(app)
      .post('/v1/operator/auth/forgot-password')
      .set('Origin', 'https://admin.chrbuilds.dev')
      .set('X-CSRF-Protection', '1')
      .send({ email: 'operator@example.test' });
    expect(response.status).toBe(202);
    expect(responseCookies(response)[0]).toContain('__Host-operator_recovery=');
    expect(responseCookies(response)[0]).toContain('Secure');
    expect(responseCookies(response)[0]).not.toContain('Domain=');
  });
});
