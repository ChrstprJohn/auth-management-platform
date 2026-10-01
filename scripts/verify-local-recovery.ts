import { readFileSync } from 'node:fs';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { parseEnv } from 'node:util';
import { z } from 'zod';
import { localOperatorConfig } from './local-operator.js';
import { assertMailpitCapture } from './mailpit-capture.js';

// This walkthrough calls supported local GoTrue/Mailpit APIs only. No SQL.
assertMailpitCapture();
const environment = readFileSync(
  new URL('../apps/gotrue-admin-api/.env', import.meta.url),
  'utf8',
);
const config = parseEnv(environment);
const local = localOperatorConfig(environment);
const upstream = parseEnv(
  readFileSync(
    new URL('../infrastructure/local/.env', import.meta.url),
    'utf8',
  ),
);
const callback = (upstream.GOTRUE_URI_ALLOW_LIST ?? '')
  .split(',')
  .find((value) => value === 'http://localhost:5173/auth/callback');
if (!callback || !config.GOTRUE_ADMIN_TOKEN)
  throw new Error('Configure the documented local infrastructure first.');
const email = `recovery-check-${randomUUID()}@example.test`;
const oldPassword = randomBytes(24).toString('base64url');
const newPassword = randomBytes(24).toString('base64url');
const verifier = randomBytes(48).toString('base64url');
const challenge = createHash('sha256').update(verifier).digest('base64url');
let userId: string | undefined;
const messageIds: string[] = [];
const identity = z.object({ id: z.uuid() });
const session = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  user: identity,
});
const mailList = z.object({
  messages: z.array(
    z.object({
      ID: z.string(),
      To: z.array(z.object({ Address: z.string() })),
    }),
  ),
});
async function request(
  url: string,
  method = 'GET',
  body?: object,
  token?: string,
) {
  const response = await fetch(url, {
    method,
    redirect: 'manual',
    signal: AbortSignal.timeout(10000),
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return response;
}
async function json(
  url: string,
  method = 'GET',
  body?: object,
  token?: string,
): Promise<unknown> {
  const response = await request(url, method, body, token);
  if (!response.ok)
    throw new Error(
      `Local recovery check failed (${response.status}). No credentials displayed.`,
    );
  return response.json();
}
async function removeMessage(id: string): Promise<void> {
  const result = await request(
    'http://localhost:8025/api/v1/messages',
    'DELETE',
    { IDs: [id] },
  );
  if (!result.ok) throw new Error('Disposable message cleanup failed.');
}
try {
  const health = z
    .object({ version: z.literal('v2.196.0') })
    .parse(await json(`${local.baseUrl}/health`));
  console.log(`Checking pinned GoTrue ${health.version}.`);
  userId = identity.parse(
    await json(
      `${local.baseUrl}/admin/users`,
      'POST',
      { email, password: oldPassword, email_confirm: true },
      config.GOTRUE_ADMIN_TOKEN,
    ),
  ).id;
  const oldSession = session.parse(
    await json(`${local.baseUrl}/token?grant_type=password`, 'POST', {
      email,
      password: oldPassword,
    }),
  );
  const state = randomBytes(32).toString('base64url');
  const callbackWithState = `${callback}?state=${state}`;
  await json(
    `${local.baseUrl}/recover?redirect_to=${encodeURIComponent(callbackWithState)}`,
    'POST',
    { email, code_challenge: challenge, code_challenge_method: 's256' },
  );
  let messageId: string | undefined;
  for (let attempt = 0; attempt < 10; attempt++) {
    const list = mailList.parse(
      await json('http://localhost:8025/api/v1/messages'),
    );
    messageId = list.messages.find((message) =>
      message.To.some((recipient) => recipient.Address === email),
    )?.ID;
    if (messageId) break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  if (!messageId) throw new Error('Local recovery email did not arrive.');
  messageIds.push(messageId);
  const message = z
    .object({ HTML: z.string() })
    .parse(await json(`http://localhost:8025/api/v1/message/${messageId}`));
  const links = [...message.HTML.matchAll(/href="([^"]+)"/g)]
    .map((match) => match[1]?.replaceAll('&amp;', '&'))
    .filter((value): value is string => !!value);
  const link = links
    .map((value) => new URL(value))
    .find(
      (url) =>
        url.origin === local.baseUrl &&
        url.pathname === '/verify' &&
        url.searchParams.get('type') === 'recovery',
    );
  if (!link) throw new Error('Expected pinned recovery link format.');
  const redirect = await request(link.href);
  const location = redirect.headers.get('location');
  if (redirect.status !== 303 || !location)
    throw new Error('Expected PKCE recovery redirect.');
  const code = new URL(location).searchParams.get('code');
  if (
    !code ||
    new URL(location).origin !== new URL(callback).origin ||
    new URL(location).searchParams.get('state') !== state
  )
    throw new Error(
      'Expected recovery authorization code and preserved state.',
    );
  const recovery = session.parse(
    await json(`${local.baseUrl}/token?grant_type=pkce`, 'POST', {
      auth_code: code,
      code_verifier: verifier,
    }),
  );
  if (recovery.user.id !== userId)
    throw new Error('Recovery identity mismatch.');
  const replay = await request(
    `${local.baseUrl}/token?grant_type=pkce`,
    'POST',
    { auth_code: code, code_verifier: verifier },
  );
  if (replay.ok) throw new Error('Recovery code was reusable.');
  await json(
    `${local.baseUrl}/user`,
    'PUT',
    { password: newPassword },
    recovery.access_token,
  );
  const oldLogin = await request(
    `${local.baseUrl}/token?grant_type=password`,
    'POST',
    { email, password: oldPassword },
  );
  const newLogin = await request(
    `${local.baseUrl}/token?grant_type=password`,
    'POST',
    { email, password: newPassword },
  );
  const oldIdentity = await request(
    `${local.baseUrl}/user`,
    'GET',
    undefined,
    oldSession.access_token,
  );
  const oldRefresh = await request(
    `${local.baseUrl}/token?grant_type=refresh_token`,
    'POST',
    { refresh_token: oldSession.refresh_token },
  );
  const recoveryIdentity = await request(
    `${local.baseUrl}/user`,
    'GET',
    undefined,
    recovery.access_token,
  );
  if (oldLogin.ok || !newLogin.ok || oldRefresh.ok || !recoveryIdentity.ok)
    throw new Error('Unexpected password/reset session behavior.');
  const invalidLink = new URL(link);
  invalidLink.searchParams.set('token', 'invalid');
  const invalidResult = await request(invalidLink.href);
  const invalidLocation = invalidResult.headers.get('location');
  if (!invalidLocation || !invalidLocation.includes('otp_expired'))
    throw new Error('Expected invalid/expired-link rejection.');
  console.log(
    JSON.stringify({
      mailpitRecovery: true,
      pkceExchange: true,
      codeReplayRejected: true,
      passwordChanged: true,
      oldRefreshRejected: true,
      oldAccessTokenAccepted: oldIdentity.ok,
      recoveryAccessTokenAccepted: recoveryIdentity.ok,
      invalidLinkRejected: true,
    }),
  );
} catch {
  console.error(
    'Local recovery verification failed. No credentials or token-bearing links were printed.',
  );
  process.exitCode = 1;
} finally {
  if (userId) {
    try {
      await json(
        `${local.baseUrl}/admin/users/${userId}`,
        'DELETE',
        { should_soft_delete: false },
        config.GOTRUE_ADMIN_TOKEN,
      );
      console.log('Disposable recovery account removed.');
    } catch {
      console.error(
        'Disposable recovery account cleanup awaits manual inspection.',
      );
      process.exitCode = 1;
    }
  }
  for (const id of messageIds) {
    try {
      await removeMessage(id);
    } catch {
      console.error(
        'Disposable Mailpit message cleanup awaits manual inspection.',
      );
      process.exitCode = 1;
    }
  }
}
