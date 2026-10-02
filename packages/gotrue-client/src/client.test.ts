import {
  createServer,
  type Server,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { GoTrueClient, GoTrueAdminClient, UpstreamError } from './client.js';
import { GoTrueRecoveryClient } from './recovery.js';
import { GoTrueEmailClient } from './email.js';

const id = '00000000-0000-4000-8000-000000000001';
const user = {
  id,
  email: 'controlled@example.test',
  created_at: '2026-01-01T00:00:00Z',
};
const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.closeAllConnections();
          server.close((error) => (error ? reject(error) : resolve()));
        }),
    ),
  );
});
async function fixture(
  handler: (req: IncomingMessage, res: ServerResponse) => void,
) {
  const server = createServer(handler);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('Expected address');
  return `http://127.0.0.1:${address.port}`;
}
function json(res: ServerResponse, body: unknown, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}
describe('bounded GoTrue adapter', () => {
  it('uses server-only invitation/resend authentication and discards proof sessions', async () => {
    const calls: Array<{
      path: string | undefined;
      body: unknown;
      authorization: string | undefined;
    }> = [];
    const invited = {
      ...user,
      invited_at: '2026-01-01T00:00:00Z',
      email_confirmed_at: '2026-01-01T00:00:00Z',
    };
    const url = await fixture((req, res) => {
      let body = '';
      req.setEncoding('utf8');
      req.on('data', (chunk: string) => {
        body += chunk;
      });
      req.on('end', () => {
        calls.push({
          path: req.url,
          body: body ? JSON.parse(body) : undefined,
          authorization: req.headers.authorization,
        });
        if (req.url === '/invite') json(res, invited);
        else if (req.url === '/verify')
          json(res, {
            user: invited,
            access_token: 'proof-secret',
            refresh_token: 'discard-me',
            expires_in: 300,
          });
        else json(res, {});
      });
    });
    const client = new GoTrueEmailClient(url, 1000, 'server-admin');
    await client.invite(user.email);
    await client.sendVerification(user.email);
    const session = await client.verify(user.email, '123456', 'invite');
    await client.discardSession(session.accessToken);
    expect(calls).toEqual([
      {
        path: '/invite',
        body: { email: user.email },
        authorization: 'Bearer server-admin',
      },
      {
        path: '/resend',
        body: { email: user.email, type: 'signup' },
        authorization: 'Bearer server-admin',
      },
      {
        path: '/verify',
        body: { email: user.email, token: '123456', type: 'invite' },
        authorization: undefined,
      },
      {
        path: '/logout?scope=local',
        body: undefined,
        authorization: 'Bearer proof-secret',
      },
    ]);
    expect(JSON.stringify(session)).not.toContain('discard-me');
  });
  it('rejects mismatched proof identity and non-invited password setup, and maps sending limits', async () => {
    const url = await fixture((_req, res) =>
      json(res, {
        user: { ...user, email_confirmed_at: '2026-01-01T00:00:00Z' },
        access_token: 'proof-secret',
        expires_in: 300,
      }),
    );
    const client = new GoTrueEmailClient(url, 1000, 'server-admin');
    await expect(
      client.verify('other@example.test', '123456', 'signup'),
    ).rejects.toMatchObject({ ambiguous: true });
    await expect(
      client.verify(user.email, '123456', 'invite'),
    ).rejects.toMatchObject({ ambiguous: true });
    const limited = await fixture((_req, res) =>
      json(res, { message: 'private' }, 429),
    );
    await expect(
      new GoTrueEmailClient(limited, 1000, 'server-admin').sendVerification(
        user.email,
      ),
    ).rejects.toMatchObject({ kind: 'rate_limited', ambiguous: false });
  });
  it('uses purpose-bound recovery PKCE payloads and sends only password on update', async () => {
    const calls: Array<{
      path: string | undefined;
      body: unknown;
      authorization: string | undefined;
    }> = [];
    const expiry = Math.floor(Date.now() / 1000) + 30;
    const url = await fixture((req, res) => {
      let body = '';
      req.setEncoding('utf8');
      req.on('data', (chunk: string) => {
        body += chunk;
      });
      req.on('end', () => {
        calls.push({
          path: req.url,
          body: JSON.parse(body),
          authorization: req.headers.authorization,
        });
        json(
          res,
          req.url?.startsWith('/token')
            ? {
                user,
                access_token: 'access-secret',
                refresh_token: 'discard-me',
                expires_in: 3600,
                expires_at: expiry,
              }
            : req.url === '/user'
              ? user
              : {},
        );
      });
    });
    const client = new GoTrueRecoveryClient(url, 1000);
    await client.sendRecovery(
      user.email,
      'challenge',
      'http://localhost:3100/v1/operator/auth/recovery/callback?state=state',
    );
    const session = await client.exchangeRecovery(
      'one-time-code',
      'server-verifier',
    );
    await client.updatePassword(session.accessToken, 'new-password', id);
    expect(calls).toEqual([
      {
        path: expect.stringContaining('/recover?redirect_to='),
        body: {
          email: user.email,
          code_challenge: 'challenge',
          code_challenge_method: 's256',
        },
        authorization: undefined,
      },
      {
        path: '/token?grant_type=pkce',
        body: { auth_code: 'one-time-code', code_verifier: 'server-verifier' },
        authorization: undefined,
      },
      {
        path: '/user',
        body: { password: 'new-password' },
        authorization: 'Bearer access-secret',
      },
    ]);
    expect(session.expiresAt).toBe(expiry * 1000);
    expect(JSON.stringify(session)).not.toContain('discard-me');
  });
  it('treats malformed password-update success as uncertain and hides upstream failure payloads', async () => {
    const url = await fixture((_req, res) =>
      json(res, { ...user, id: '33333333-3333-4333-8333-333333333333' }),
    );
    await expect(
      new GoTrueRecoveryClient(url, 1000).updatePassword(
        'token',
        'password',
        id,
      ),
    ).rejects.toMatchObject({ kind: 'unavailable', ambiguous: true });
    const rejected = await fixture((_req, res) =>
      json(res, { message: 'private upstream detail' }, 422),
    );
    await expect(
      new GoTrueRecoveryClient(rejected, 1000).updatePassword(
        'token',
        'password',
        id,
      ),
    ).rejects.toMatchObject({
      kind: 'identity',
      message: 'GoTrue request failed',
    });
  });
  it('rejects mismatched user identities and marks mutation responses uncertain', async () => {
    const url = await fixture((_req, res) =>
      json(res, { ...user, id: '00000000-0000-4000-8000-000000000002' }),
    );
    const client = new GoTrueAdminClient(url, 1000, 'server-secret');
    await expect(client.getUser(id)).rejects.toMatchObject({
      kind: 'unavailable',
      ambiguous: false,
    });
    await expect(client.setBan(id, '1h')).rejects.toMatchObject({
      kind: 'unavailable',
      ambiguous: true,
    });
  });
  it('uses exact bounded admin pagination and strips raw upstream secrets', async () => {
    const url = await fixture((req, res) => {
      expect(req.url).toBe('/admin/users?page=2&per_page=20');
      expect(req.headers.authorization).toBe('Bearer server-secret');
      json(res, {
        users: [
          {
            ...user,
            recovery_token: 'secret',
            user_metadata: { role: 'admin' },
          },
        ],
      });
    });
    const result = await new GoTrueAdminClient(
      url,
      1000,
      'server-secret',
    ).listUsers(2, 20);
    expect(result).toEqual([user]);
  });
  it('sends only allowed create/ban/delete fields and explicit permanent deletion', async () => {
    const calls: Array<{
      method: string | undefined;
      path: string | undefined;
      body: unknown;
    }> = [];
    const url = await fixture((req, res) => {
      let body = '';
      req.setEncoding('utf8');
      req.on('data', (chunk: string) => {
        body += chunk;
      });
      req.on('end', () => {
        calls.push({
          method: req.method,
          path: req.url,
          body: JSON.parse(body),
        });
        json(res, req.method === 'DELETE' ? {} : user);
      });
    });
    const client = new GoTrueAdminClient(url, 1000, 'server-secret');
    await client.createUser(user.email, 'controlled-password', false);
    await client.setBan(id, '24h');
    await client.setBan(id, 'none');
    await client.deleteUser(id);
    expect(calls.map((call) => call.body)).toEqual([
      {
        email: user.email,
        password: 'controlled-password',
        email_confirm: false,
      },
      { ban_duration: '24h' },
      { ban_duration: 'none' },
      { should_soft_delete: false },
    ]);
    expect(calls[3]?.method).toBe('DELETE');
  });
  it('treats 5xx/invalid success responses as uncertain mutations and never retries', async () => {
    let calls = 0;
    const url = await fixture((_req, res) => {
      calls++;
      json(res, { internal: 'secret' }, 500);
    });
    const client = new GoTrueAdminClient(url, 1000, 'server-secret');
    await expect(client.setBan(id, '1h')).rejects.toMatchObject({
      kind: 'unavailable',
      ambiguous: true,
    });
    expect(calls).toBe(1);
    const malformed = await fixture((_req, res) =>
      json(res, { token: 'secret' }),
    );
    await expect(
      new GoTrueAdminClient(malformed, 1000, 'server-secret').createUser(
        user.email,
        'password',
        true,
      ),
    ).rejects.toMatchObject({ ambiguous: true });
  });
  it('maps duplicate/not-found/admin authentication errors without returning raw payloads', async () => {
    const url = await fixture((req, res) => {
      if (req.method === 'POST')
        json(res, { code: 'email_exists', message: 'secret' }, 422);
      else json(res, { raw: 'secret' }, req.url?.endsWith(id) ? 404 : 401);
    });
    const client = new GoTrueAdminClient(url, 1000, 'server-secret');
    await expect(
      client.createUser(user.email, 'password', true),
    ).rejects.toMatchObject({
      kind: 'conflict',
      message: 'GoTrue request failed',
    });
    await expect(client.getUser(id)).rejects.toMatchObject({
      kind: 'not_found',
    });
    await expect(client.listUsers(1, 20)).rejects.toMatchObject({
      kind: 'unavailable',
    });
  });
  it('bounds upstream requests and rejects redirects without leaking server tokens', async () => {
    let calls = 0;
    const url = await fixture((_req, res) => {
      calls++;
      res.writeHead(302, { Location: 'http://127.0.0.1:1/' });
      res.end();
    });
    await expect(
      new GoTrueAdminClient(url, 100, 'server-secret').deleteUser(id),
    ).rejects.toMatchObject({ ambiguous: true });
    expect(calls).toBe(1);
    const stalled = await fixture(() => {});
    await expect(
      new GoTrueAdminClient(stalled, 100, 'server-secret').setBan(id, '1h'),
    ).rejects.toMatchObject({ ambiguous: true });
  });
  it('password responses retain no refresh token and enforce both expiry bounds', async () => {
    const started = Date.now();
    const expiresAt = Math.floor((started + 60000) / 1000);
    const url = await fixture((_req, res) =>
      json(res, {
        access_token: 'access-secret',
        refresh_token: 'refresh-secret',
        expires_in: 3600,
        expires_at: expiresAt,
        user,
      }),
    );
    const result = await new GoTrueClient(url, 1000).passwordLogin(
      user.email,
      'controlled-password',
    );
    expect(result.expiresAt).toBe(expiresAt * 1000);
    expect(JSON.stringify(result)).not.toContain('refresh-secret');
    const invalid = await fixture((_req, res) =>
      json(res, { msg: 'bad credentials' }, 400),
    );
    await expect(
      new GoTrueClient(invalid, 1000).passwordLogin(user.email, 'password'),
    ).rejects.toBeInstanceOf(UpstreamError);
  });
});
