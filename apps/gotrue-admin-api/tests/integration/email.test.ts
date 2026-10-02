import { afterEach, describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import {
  UpstreamError,
  type EmailClient,
  type RecoveryClient,
} from '@auth/gotrue-client';
import { createApp } from '../../src/app.js';
import { loadConfig } from '../../src/config/env.js';
import { EmailService } from '../../src/modules/email/email.service.js';

const id = '00000000-0000-4000-8000-000000000001';
const origin = 'http://localhost:5173';
const resources: ReturnType<typeof createApp>[] = [];
afterEach(async () => {
  await Promise.all(resources.splice(0).map((r) => r.close()));
});
function clients() {
  const email: EmailClient = {
    invite: vi.fn(),
    sendVerification: vi.fn(),
    verify: vi.fn(async () => ({
      accessToken: 'private-token',
      expiresAt: Date.now() + 60000,
      user: {
        id,
        email: 'recipient@example.test',
        email_confirmed_at: new Date().toISOString(),
      },
    })),
    discardSession: vi.fn(async () => {}),
  };
  const passwords: RecoveryClient = {
    sendRecovery: vi.fn(),
    exchangeRecovery: vi.fn(),
    updatePassword: vi.fn(async () => {}),
  };
  return { email, passwords };
}
function setup() {
  const { email, passwords } = clients();
  const config = loadConfig({
    NODE_ENV: 'test',
    GOTRUE_URL: 'http://localhost:8081',
    GOTRUE_ADMIN_TOKEN: 'fixture',
    ADMIN_DATABASE_URL: 'postgres://unused:unused@localhost/unused',
    OPERATOR_UUID_ALLOWLIST: id,
    SESSION_ENCRYPTION_KEY: Buffer.alloc(32, 3).toString('base64'),
    FRONTEND_ORIGINS: origin,
    LOG_LEVEL: 'silent',
  });
  const resource = createApp(config, {
    email,
    recovery: passwords,
    checkDatabase: async () => {},
  });
  resources.push(resource);
  const send = (path: string, body: object) =>
    request(resource.app)
      .post(`/v1/email/${path}`)
      .set('Origin', origin)
      .set('X-CSRF-Protection', '1')
      .send(body);
  return { ...resource, email, passwords, send };
}
describe('recipient email verification', () => {
  it('requires trusted Origin/CSRF and strictly validates before consuming any code', async () => {
    const { app, send, email } = setup();
    const proof = { email: 'recipient@example.test', code: '123456' };
    expect(
      (await request(app).post('/v1/email/confirm').send(proof)).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .post('/v1/email/confirm')
          .set('Origin', 'https://untrusted.example')
          .set('X-CSRF-Protection', '1')
          .send(proof)
      ).status,
    ).toBe(403);
    expect(
      (await send('confirm', { ...proof, token: 'not-allowed' })).status,
    ).toBe(400);
    expect(
      (await send('accept-invitation', { ...proof, password: 'é'.repeat(37) }))
        .status,
    ).toBe(400);
    expect(email.verify).not.toHaveBeenCalled();
  });
  it('verifies the exact signup purpose, returns 204 without tokens or operator cookies', async () => {
    const { send, email, passwords } = setup();
    const response = await send('confirm', {
      email: 'recipient@example.test',
      code: '123456',
    });
    expect(response.status).toBe(204);
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(response.text).toBe('');
    expect(email.verify).toHaveBeenCalledWith(
      'recipient@example.test',
      '123456',
      'signup',
    );
    expect(email.discardSession).toHaveBeenCalledWith('private-token');
    expect(passwords.updatePassword).not.toHaveBeenCalled();
  });
  it('accepts an invitation without granting operator authority; sends only verified identity/password', async () => {
    const { send, email, passwords } = setup();
    const response = await send('accept-invitation', {
      email: 'recipient@example.test',
      code: '123456',
      password: 'new-password-fixture',
    });
    expect(response.status).toBe(204);
    expect(email.verify).toHaveBeenCalledWith(
      'recipient@example.test',
      '123456',
      'invite',
    );
    expect(passwords.updatePassword).toHaveBeenCalledWith(
      'private-token',
      'new-password-fixture',
      id,
    );
    expect(response.headers['set-cookie']).toBeUndefined();
  });
  it('never updates a password after invalid proof and maps rate limits safely', async () => {
    const { email, passwords } = clients();
    const service = new EmailService(email, passwords);
    vi.mocked(email.verify).mockRejectedValue(new UpstreamError('identity'));
    await expect(
      service.acceptInvitation('recipient@example.test', '123456', 'password'),
    ).rejects.toMatchObject({ code: 'INVALID_EMAIL_CODE' });
    expect(passwords.updatePassword).not.toHaveBeenCalled();
    vi.mocked(email.verify).mockRejectedValue(
      new UpstreamError('rate_limited'),
    );
    await expect(
      service.confirm('recipient@example.test', '123456'),
    ).rejects.toMatchObject({ status: 429 });
  });
  it('reports consumed proof and ambiguous password outcome without retrying, and discards the session', async () => {
    const { email, passwords } = clients();
    vi.mocked(passwords.updatePassword).mockRejectedValue(
      new UpstreamError('unavailable', true),
    );
    await expect(
      new EmailService(email, passwords).acceptInvitation(
        'recipient@example.test',
        '123456',
        'password',
      ),
    ).rejects.toMatchObject({ code: 'INVITATION_OUTCOME_UNKNOWN' });
    expect(passwords.updatePassword).toHaveBeenCalledTimes(1);
    expect(email.discardSession).toHaveBeenCalledTimes(1);
  });
});
