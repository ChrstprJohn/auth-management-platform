import { readFileSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import { parseEnv } from 'node:util';
import request from 'supertest';
import { z } from 'zod';
import { GoTrueRecoveryClient } from '@auth/gotrue-client';
import { createApp } from '../apps/gotrue-admin-api/src/app.js';
import { loadConfig } from '../apps/gotrue-admin-api/src/config/env.js';
import { localOperatorConfig } from './local-operator.js';
import { assertMailpitCapture } from './mailpit-capture.js';

// Manual API walkthrough only: no DDL, migrations, seeds or infrastructure startup.
assertMailpitCapture();
const environment = readFileSync(
  new URL('../apps/gotrue-admin-api/.env', import.meta.url),
  'utf8',
);
const values = parseEnv(environment);
const local = localOperatorConfig(environment);
const verifyExpiry = process.argv.includes('--expiry');
class ShortRecoveryGoTrue extends GoTrueRecoveryClient {
  override async exchangeRecovery(code: string, verifier: string) {
    const result = await super.exchangeRecovery(code, verifier);
    return {
      ...result,
      expiresAt: Math.min(result.expiresAt, Date.now() + 2000),
    };
  }
}
const email = `gateway-recovery-check-${randomUUID()}@example.test`;
const password = randomBytes(24).toString('base64url');
const newPassword = randomBytes(24).toString('base64url');
let userId: string | undefined;
let resource: ReturnType<typeof createApp> | undefined;
let loginCookie: string | undefined;
const messageIds: string[] = [];
const messagesSchema = z.object({
  messages: z.array(
    z.object({
      ID: z.string(),
      To: z.array(z.object({ Address: z.string() })),
    }),
  ),
});
function cookie(
  response: { headers: Record<string, unknown> },
  name: string,
): string {
  const cookies = z.array(z.string()).parse(response.headers['set-cookie']);
  const pair = cookies
    .find((value) => value.startsWith(`${name}=`))
    ?.split(';')[0];
  if (!pair) throw new Error('Expected cookie');
  return pair;
}
async function upstream(
  url: string,
  method = 'GET',
  body?: object,
  admin = false,
): Promise<Response> {
  return fetch(url, {
    method,
    redirect: 'manual',
    signal: AbortSignal.timeout(10000),
    headers: {
      'Content-Type': 'application/json',
      ...(admin && values.GOTRUE_ADMIN_TOKEN
        ? { Authorization: `Bearer ${values.GOTRUE_ADMIN_TOKEN}` }
        : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
async function removeMessage(id: string): Promise<void> {
  const response = await upstream(
    'http://localhost:8025/api/v1/messages',
    'DELETE',
    { IDs: [id] },
  );
  if (!response.ok) throw new Error('Message cleanup failed');
}
try {
  const created = await upstream(
    `${local.baseUrl}/admin/users`,
    'POST',
    { email, password, email_confirm: true },
    true,
  );
  if (!created.ok) throw new Error('Disposable user creation failed');
  userId = z.object({ id: z.uuid() }).parse(await created.json()).id;
  // Temporary eligibility exists only in this process, never the real backend .env.
  const config = loadConfig({
    ...values,
    OPERATOR_UUID_ALLOWLIST: [...local.allowlist, userId].join(','),
    LOG_LEVEL: 'silent',
  });
  const origin = config.FRONTEND_ORIGINS[0];
  if (!origin) throw new Error('Expected configured origin');
  resource = createApp(
    config,
    verifyExpiry
      ? {
          recovery: new ShortRecoveryGoTrue(
            local.baseUrl,
            config.UPSTREAM_TIMEOUT_MS,
          ),
        }
      : {},
  );
  const login = await request(resource.app)
    .post('/v1/operator/auth/login')
    .set('Origin', origin)
    .set('X-CSRF-Protection', '1')
    .send({ email, password });
  if (login.status !== 200) throw new Error('Gateway login failed');
  loginCookie = cookie(login, 'operator_session');
  const requested = await request(resource.app)
    .post('/v1/operator/auth/forgot-password')
    .set('Origin', origin)
    .set('X-CSRF-Protection', '1')
    .send({ email });
  if (requested.status !== 202)
    throw new Error('Gateway recovery request failed');
  const recoveryCookie = cookie(requested, 'operator_recovery');
  let messageId: string | undefined;
  for (let attempt = 0; attempt < 10; attempt++) {
    const response = await upstream('http://localhost:8025/api/v1/messages');
    const messages = messagesSchema.parse(await response.json());
    messageId = messages.messages.find((message) =>
      message.To.some((recipient) => recipient.Address === email),
    )?.ID;
    if (messageId) break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  if (!messageId) throw new Error('Expected local recovery message');
  messageIds.push(messageId);
  const messageResponse = await upstream(
    `http://localhost:8025/api/v1/message/${messageId}`,
  );
  const message = z
    .object({ HTML: z.string() })
    .parse(await messageResponse.json());
  const link = [...message.HTML.matchAll(/href="([^"]+)"/g)]
    .map((match) => match[1]?.replaceAll('&amp;', '&'))
    .filter((value): value is string => !!value)
    .map((value) => new URL(value))
    .find(
      (url) =>
        url.origin === local.baseUrl &&
        url.pathname === '/verify' &&
        url.searchParams.get('type') === 'recovery',
    );
  if (!link) throw new Error('Expected recovery link');
  const redirect = await upstream(link.href);
  const location = redirect.headers.get('location');
  if (!location) throw new Error('Expected callback redirect');
  const callback = new URL(location);
  const expected = new URL(config.RECOVERY_CALLBACK_URL);
  if (
    callback.origin !== expected.origin ||
    callback.pathname !== expected.pathname
  )
    throw new Error('GoTrue callback allowlist is not loaded');
  const callbackPath = callback.pathname + callback.search;
  const invalidCallbacks = [
    await request(resource.app).get(callbackPath),
    await request(resource.app)
      .get(callbackPath)
      .set(
        'Cookie',
        `operator_recovery=${randomBytes(32).toString('base64url')}`,
      ),
    await request(resource.app)
      .get(callbackPath + '&redirect_to=https%3A%2F%2Funtrusted.example')
      .set('Cookie', recoveryCookie),
  ];
  if (
    invalidCallbacks.some(
      (response) => response.status !== 400 || response.headers.location,
    )
  )
    throw new Error('Invalid recovery browser/state/redirect was accepted');
  const premature = await request(resource.app)
    .post('/v1/operator/auth/reset-password')
    .set('Origin', origin)
    .set('X-CSRF-Protection', '1')
    .set('Cookie', recoveryCookie)
    .send({ password: newPassword });
  if (premature.status !== 400)
    throw new Error('Pending recovery reset accepted');
  const accepted = await request(resource.app)
    .get(callbackPath)
    .set('Cookie', recoveryCookie);
  if (
    accepted.status !== 303 ||
    accepted.headers.location !== config.RECOVERY_RESET_URL
  )
    throw new Error('Gateway callback failed');
  const callbackReplay = await request(resource.app)
    .get(callbackPath)
    .set('Cookie', recoveryCookie);
  if (callbackReplay.status !== 400)
    throw new Error('Callback replay accepted');
  const noManagementSession = await request(resource.app)
    .get('/v1/operator/auth/me')
    .set('Cookie', recoveryCookie);
  if (noManagementSession.status !== 401)
    throw new Error('Recovery granted a management session');
  const csrfFailures = [
    await request(resource.app)
      .post('/v1/operator/auth/reset-password')
      .set('Origin', origin)
      .set('Cookie', recoveryCookie)
      .send({ password: newPassword }),
    await request(resource.app)
      .post('/v1/operator/auth/reset-password')
      .set('Origin', 'https://untrusted.example')
      .set('X-CSRF-Protection', '1')
      .set('Cookie', recoveryCookie)
      .send({ password: newPassword }),
  ];
  if (csrfFailures.some((response) => response.status !== 403))
    throw new Error('Recovery CSRF boundary failed');
  // Rebuild the gateway before reset to prove recovery context persists in PostgreSQL.
  await resource.close();
  resource = createApp(config);
  const resetApp = resource.app;
  const resetAttempt = () =>
    request(resetApp)
      .post('/v1/operator/auth/reset-password')
      .set('Origin', origin)
      .set('X-CSRF-Protection', '1')
      .set('Cookie', recoveryCookie)
      .send({ password: newPassword });
  if (verifyExpiry) {
    // Only this probe's upstream lifetime is capped; the configured policy is unchanged.
    await new Promise((resolve) => setTimeout(resolve, 2200));
    const expired = await resetAttempt();
    const stillSignedIn = await request(resetApp)
      .get('/v1/operator/auth/me')
      .set('Cookie', loginCookie);
    const unchangedPassword = await upstream(
      `${local.baseUrl}/token?grant_type=password`,
      'POST',
      { email, password },
    );
    if (
      expired.status !== 400 ||
      expired.body.error.code !== 'INVALID_RECOVERY' ||
      stillSignedIn.status !== 200 ||
      unchangedPassword.status !== 200
    )
      throw new Error('Expired recovery context changed password/session');
    console.log(
      'Live recovery expiry passed: persisted ready context expires across gateway restart; reset is rejected before password/session mutation. Browser/state/redirect, replay, CSRF and management-session boundaries also passed.',
    );
  } else {
    // Deliberate contention test on a disposable account, never an automatic retry.
    const resetResponses = await Promise.all([resetAttempt(), resetAttempt()]);
    if (
      resetResponses
        .map((response) => response.status)
        .sort()
        .join(',') !== '204,400'
    )
      throw new Error('Gateway concurrent reset failed; no automatic retry');
    const oldSession = await request(resource.app)
      .get('/v1/operator/auth/me')
      .set('Cookie', loginCookie);
    const replay = await request(resource.app)
      .post('/v1/operator/auth/reset-password')
      .set('Origin', origin)
      .set('X-CSRF-Protection', '1')
      .set('Cookie', recoveryCookie)
      .send({ password: randomBytes(24).toString('base64url') });
    const oldLogin = await request(resource.app)
      .post('/v1/operator/auth/login')
      .set('Origin', origin)
      .set('X-CSRF-Protection', '1')
      .send({ email, password });
    const newLogin = await request(resource.app)
      .post('/v1/operator/auth/login')
      .set('Origin', origin)
      .set('X-CSRF-Protection', '1')
      .send({ email, password: newPassword });
    if (
      oldSession.status !== 401 ||
      replay.status !== 400 ||
      oldLogin.status !== 401 ||
      newLogin.status !== 200
    )
      throw new Error('Gateway post-reset checks failed');
    loginCookie = cookie(newLogin, 'operator_session');
    const logout = await request(resource.app)
      .post('/v1/operator/auth/logout')
      .set('Origin', origin)
      .set('X-CSRF-Protection', '1')
      .set('Cookie', loginCookie);
    if (logout.status !== 204)
      throw new Error('Disposable gateway session cleanup failed');
    loginCookie = undefined;
    console.log(
      'Live gateway recovery passed: PostgreSQL context survives gateway restart, Mailpit callback succeeds, concurrent reset admits one winner, old session/password fail, and normal new-password login/logout succeed.',
    );
  }
} catch {
  console.error(
    'Live gateway recovery could not be confirmed. Check migration/grants and loaded GoTrue callback configuration. No credentials or email links were displayed; no reset mutation was automatically retried.',
  );
  process.exitCode = 1;
} finally {
  if (resource && loginCookie) {
    try {
      const config = loadConfig(values);
      const origin = config.FRONTEND_ORIGINS[0];
      if (origin)
        await request(resource.app)
          .post('/v1/operator/auth/logout')
          .set('Origin', origin)
          .set('X-CSRF-Protection', '1')
          .set('Cookie', loginCookie);
    } catch {
      console.error('Disposable local session cleanup could not be confirmed.');
    }
  }
  if (resource) await resource.close();
  if (userId) {
    try {
      const removed = await upstream(
        `${local.baseUrl}/admin/users/${userId}`,
        'DELETE',
        { should_soft_delete: false },
        true,
      );
      if (!removed.ok) process.exitCode = 1;
      else console.log('Disposable gateway recovery account removed.');
    } catch {
      console.error(
        'Disposable gateway account cleanup could not be confirmed.',
      );
      process.exitCode = 1;
    }
  }
  for (const id of messageIds) {
    try {
      await removeMessage(id);
    } catch {
      console.error(
        'Disposable gateway recovery message cleanup could not be confirmed.',
      );
      process.exitCode = 1;
    }
  }
}
