import { readFileSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import { parseEnv } from 'node:util';
import request from 'supertest';
import { z } from 'zod';
import {
  GoTrueAdminClient,
  GoTrueClient,
  UpstreamError,
} from '@auth/gotrue-client';
import { createApp } from '../apps/gotrue-admin-api/src/app.js';
import { loadConfig } from '../apps/gotrue-admin-api/src/config/env.js';
import { localOperatorConfig } from './local-operator.js';

// Manual controlled-account application queries only. No schema/setup SQL.
const environment = readFileSync(
  new URL('../apps/gotrue-admin-api/.env', import.meta.url),
  'utf8',
);
const values = parseEnv(environment);
const local = localOperatorConfig(environment);
if (!values.GOTRUE_ADMIN_TOKEN)
  throw new Error('Configure local admin credentials first.');
const admin = new GoTrueAdminClient(
  local.baseUrl,
  5000,
  values.GOTRUE_ADMIN_TOKEN,
);
const identities = new GoTrueClient(local.baseUrl, 5000);
const password = randomBytes(24).toString('base64url');
const prefix = `management-check-${randomUUID()}`;
const owned = new Set<string>();
const resources: Array<ReturnType<typeof createApp>> = [];
const closed = new Set<ReturnType<typeof createApp>>();
async function closeResource(resource: ReturnType<typeof createApp>) {
  if (closed.has(resource)) return;
  await resource.close();
  closed.add(resource);
}
const sessions: Array<{
  resource: ReturnType<typeof createApp>;
  cookie: string;
}> = [];
const safeUserSchema = z.strictObject({
  id: z.uuid(),
  email: z.string().nullable(),
  createdAt: z.string().nullable(),
  emailConfirmedAt: z.string().nullable(),
  lastSignInAt: z.string().nullable(),
  bannedUntil: z.string().nullable(),
  isBanned: z.boolean().nullable(),
});
const userResult = z.object({
  user: safeUserSchema,
  auditId: z.uuid().optional(),
});
const auditSchema = z.strictObject({
  id: z.uuid(),
  actorId: z.uuid(),
  targetId: z.uuid().nullable(),
  action: z.enum(['create', 'ban', 'unban', 'delete']),
  outcome: z.enum(['pending', 'succeeded', 'failed', 'unknown']),
  createdAt: z.string(),
  completedAt: z.string().nullable(),
  requestId: z.uuid(),
});
const auditIds = new Set<string>();
function check(condition: boolean, label: string): asserts condition {
  if (!condition) throw new LocalManagementCheckError(label);
}
class LocalManagementCheckError extends Error {}
function cookie(response: { headers: Record<string, unknown> }): string {
  const value = z
    .array(z.string())
    .parse(response.headers['set-cookie'])
    .find((entry) => entry.startsWith('operator_session='))
    ?.split(';')[0];
  if (!value) throw new Error('Expected dashboard cookie');
  return value;
}
function recordAudit(response: { body: unknown }): void {
  const result = z
    .object({ auditId: z.uuid().optional() })
    .parse(response.body);
  if (result.auditId) auditIds.add(result.auditId);
}
async function fixture(label: string) {
  const email = `${prefix}-${label}@example.test`;
  const user = await admin.createUser(email, password, true);
  owned.add(user.id);
  return { id: user.id, email };
}
try {
  const first = await fixture('operator-a');
  const second = await fixture('operator-b');
  const operators = new Set([first.id, second.id]);
  const config = loadConfig({
    ...values,
    OPERATOR_UUID_ALLOWLIST: [...operators].join(','),
    ALLOW_GLOBAL_USER_DELETION: 'true',
    LOG_LEVEL: 'silent',
  });
  const origin = config.FRONTEND_ORIGINS[0];
  if (!origin) throw new Error('Expected local frontend origin');
  let resource = createApp(config);
  resources.push(resource);
  const mutate = (
    method: 'post' | 'delete',
    path: string,
    session: string,
    body: object,
  ) => {
    const endpoint = request(resource.app);
    const operation =
      method === 'post' ? endpoint.post(path) : endpoint.delete(path);
    return operation
      .set('Origin', origin)
      .set('X-CSRF-Protection', '1')
      .set('Cookie', session)
      .send(body);
  };
  const login = async (account: { email: string }) => {
    const response = await request(resource.app)
      .post('/v1/operator/auth/login')
      .set('Origin', origin)
      .set('X-CSRF-Protection', '1')
      .send({ email: account.email, password });
    check(response.status === 200, 'Operator login');
    const value = cookie(response);
    sessions.push({ resource, cookie: value });
    return value;
  };
  const a = await login(first);
  check(
    (await request(resource.app).get('/v1/operator/auth/me').set('Cookie', a))
      .status === 200,
    'Current operator',
  );
  const lastBan = await mutate(
    'post',
    `/v1/operator/users/${first.id}/ban`,
    a,
    { targetId: first.id, confirmation: 'BAN_GLOBAL_USER', durationHours: 1 },
  );
  check(
    lastBan.status === 409 &&
      lastBan.body.error.code === 'LAST_USABLE_OPERATOR',
    'Configured UUID alone is insufficient proof',
  );
  const b = await login(second);
  const health = await request(resource.app)
    .get('/v1/operator/health')
    .set('Cookie', a);
  check(
    health.status === 200 && health.body.version === 'v2.196.0',
    'Protected health version',
  );
  const ready = await request(resource.app).get('/health/ready');
  check(ready.status === 200, 'Readiness');
  const list = await request(resource.app)
    .get('/v1/operator/users?page=1&perPage=1')
    .set('Cookie', a);
  check(
    list.status === 200 &&
      list.body.users.length === 1 &&
      list.body.hasNextPage === true,
    'Bounded pagination',
  );
  z.array(safeUserSchema).parse(list.body.users);
  check(
    (
      await request(resource.app)
        .get('/v1/operator/users?perPage=101')
        .set('Cookie', a)
    ).status === 400,
    'Pagination limit',
  );
  const targetEmail = `${prefix}-ordinary@example.test`;
  const created = await mutate('post', '/v1/operator/users', a, {
    email: targetEmail,
    password,
    confirmation: 'operator_confirmed',
  });
  check(created.status === 201, 'Confirmed create');
  const target = userResult.parse(created.body).user;
  owned.add(target.id);
  recordAudit(created);
  check(target.emailConfirmedAt !== null, 'Explicit confirmation');
  const ordinary = await request(resource.app)
    .post('/v1/operator/auth/login')
    .set('Origin', origin)
    .set('X-CSRF-Protection', '1')
    .send({ email: targetEmail, password });
  check(
    ordinary.status === 403 && ordinary.headers['set-cookie'] === undefined,
    'Ordinary account rejection',
  );
  const invalid = await request(resource.app)
    .post('/v1/operator/auth/login')
    .set('Origin', origin)
    .set('X-CSRF-Protection', '1')
    .send({ email: first.email, password: 'wrong-controlled-password' });
  check(invalid.status === 401, 'Wrong credentials');
  const duplicate = await mutate('post', '/v1/operator/users', a, {
    email: targetEmail,
    password,
    confirmation: 'operator_confirmed',
  });
  check(
    duplicate.status === 409 && duplicate.body.error.code === 'USER_EXISTS',
    'Duplicate create',
  );
  const unconfirmedEmail = `${prefix}-unconfirmed@example.test`;
  const unconfirmed = await mutate('post', '/v1/operator/users', a, {
    email: unconfirmedEmail,
    password,
    confirmation: 'require_verification',
  });
  check(unconfirmed.status === 201, 'Unconfirmed create');
  const unconfirmedUser = userResult.parse(unconfirmed.body).user;
  owned.add(unconfirmedUser.id);
  recordAudit(unconfirmed);
  check(unconfirmedUser.emailConfirmedAt === null, 'No invented confirmation');
  const unconfirmedLogin = await request(resource.app)
    .post('/v1/operator/auth/login')
    .set('Origin', origin)
    .set('X-CSRF-Protection', '1')
    .send({ email: unconfirmedEmail, password });
  check(unconfirmedLogin.status === 401, 'Unconfirmed login rejected');
  await new Promise((resolve) => setTimeout(resolve, 1000));
  const mailResponse = await fetch('http://localhost:8025/api/v1/messages', {
    signal: AbortSignal.timeout(5000),
  });
  const mail = z
    .object({
      messages: z.array(
        z.object({ To: z.array(z.object({ Address: z.string() })) }),
      ),
    })
    .parse(await mailResponse.json());
  check(
    !mail.messages.some((message) =>
      message.To.some((recipient) =>
        [targetEmail, unconfirmedEmail].includes(recipient.Address),
      ),
    ),
    'Admin create is not an email invitation',
  );
  const detail = await request(resource.app)
    .get(`/v1/operator/users/${target.id}`)
    .set('Cookie', a);
  check(
    detail.status === 200 &&
      userResult.parse(detail.body).user.id === target.id,
    'Safe details',
  );
  const prior = await identities.passwordLogin(targetEmail, password);
  const ban = await mutate('post', `/v1/operator/users/${target.id}/ban`, a, {
    targetId: target.id,
    confirmation: 'BAN_GLOBAL_USER',
    durationHours: 24,
  });
  check(ban.status === 200, 'Ban');
  const banned = userResult.parse(ban.body).user;
  recordAudit(ban);
  check(
    banned.isBanned === true &&
      banned.bannedUntil !== null &&
      Math.abs(Date.parse(banned.bannedUntil) - Date.now() - 86400000) < 60000,
    '24-hour ban expiry',
  );
  let oldTokenAccepted = true;
  try {
    await identities.getIdentity(prior.accessToken);
  } catch (error) {
    if (error instanceof UpstreamError && error.kind === 'identity')
      oldTokenAccepted = false;
    else throw error;
  }
  const bannedLogin = await request(resource.app)
    .post('/v1/operator/auth/login')
    .set('Origin', origin)
    .set('X-CSRF-Protection', '1')
    .send({ email: targetEmail, password });
  check(bannedLogin.status === 401, 'Banned login');
  const unban = await mutate(
    'post',
    `/v1/operator/users/${target.id}/unban`,
    a,
    { targetId: target.id, confirmation: 'UNBAN_GLOBAL_USER' },
  );
  check(
    unban.status === 200 &&
      userResult.parse(unban.body).user.isBanned === false,
    'Unban',
  );
  recordAudit(unban);
  await identities.passwordLogin(targetEmail, password);
  const deleted = await mutate('delete', `/v1/operator/users/${target.id}`, a, {
    targetId: target.id,
    confirmation: 'DELETE_GLOBAL_USER_PERMANENTLY',
  });
  check(
    deleted.status === 200 && deleted.body.deleted === true,
    'Permanent delete',
  );
  recordAudit(deleted);
  owned.delete(target.id);
  check(
    (
      await request(resource.app)
        .get(`/v1/operator/users/${target.id}`)
        .set('Cookie', a)
    ).status === 404,
    'Deleted user not found',
  );
  try {
    await admin.getUser(target.id);
    throw new Error('Deleted upstream user still exists');
  } catch (error) {
    if (!(error instanceof UpstreamError && error.kind === 'not_found'))
      throw error;
  }
  const deleteAgain = await mutate(
    'delete',
    `/v1/operator/users/${target.id}`,
    a,
    { targetId: target.id, confirmation: 'DELETE_GLOBAL_USER_PERMANENTLY' },
  );
  check(deleteAgain.status === 404, 'Already-applied delete is not success');
  const deleteUnconfirmed = await mutate(
    'delete',
    `/v1/operator/users/${unconfirmedUser.id}`,
    a,
    {
      targetId: unconfirmedUser.id,
      confirmation: 'DELETE_GLOBAL_USER_PERMANENTLY',
    },
  );
  check(deleteUnconfirmed.status === 200, 'Unconfirmed fixture delete');
  owned.delete(unconfirmedUser.id);
  // Two API instances share the real PostgreSQL advisory lock, not an in-memory mutex.
  const concurrentInstance = createApp(config);
  resources.push(concurrentInstance);
  const responses = await Promise.all([
    mutate('delete', `/v1/operator/users/${second.id}`, a, {
      targetId: second.id,
      confirmation: 'DELETE_GLOBAL_USER_PERMANENTLY',
    }),
    request(concurrentInstance.app)
      .delete(`/v1/operator/users/${first.id}`)
      .set('Origin', origin)
      .set('X-CSRF-Protection', '1')
      .set('Cookie', b)
      .send({
        targetId: first.id,
        confirmation: 'DELETE_GLOBAL_USER_PERMANENTLY',
      }),
  ]);
  check(
    responses.filter((response) => response.status === 200).length === 1,
    'Concurrent removal admits exactly one winner',
  );
  check(
    responses.some(
      (response) =>
        response.status === 409 &&
        ['MUTATION_IN_PROGRESS', 'LAST_USABLE_OPERATOR'].includes(
          response.body.error.code,
        ),
    ),
    'Concurrent losing removal rejected',
  );
  const removedIndex = responses[0]?.status === 200 ? 1 : 0;
  const removed = removedIndex === 1 ? second : first;
  const remaining = removedIndex === 1 ? first : second;
  owned.delete(removed.id);
  const remainingCookie = await login(remaining);
  const lastDelete = await mutate(
    'delete',
    `/v1/operator/users/${remaining.id}`,
    remainingCookie,
    { targetId: remaining.id, confirmation: 'DELETE_GLOBAL_USER_PERMANENTLY' },
  );
  check(
    lastDelete.status === 409 &&
      lastDelete.body.error.code === 'LAST_USABLE_OPERATOR',
    'Final operator cannot be deleted',
  );
  const finalBan = await mutate(
    'post',
    `/v1/operator/users/${remaining.id}/ban`,
    remainingCookie,
    {
      targetId: remaining.id,
      confirmation: 'BAN_GLOBAL_USER',
      durationHours: 1,
    },
  );
  check(
    finalBan.status === 409 &&
      finalBan.body.error.code === 'LAST_USABLE_OPERATOR',
    'Final operator cannot be banned',
  );
  // Reconstruct the gateway; persisted sessions/audit must still work.
  await closeResource(resource);
  resource = createApp(config);
  resources.push(resource);
  check(
    (
      await request(resource.app)
        .get('/v1/operator/auth/me')
        .set('Cookie', remainingCookie)
    ).status === 200,
    'Session survives restart',
  );
  const audit = await request(resource.app)
    .get('/v1/operator/audit?perPage=100')
    .set('Cookie', remainingCookie);
  check(audit.status === 200, 'Audit survives restart');
  const entries = z
    .object({ entries: z.array(auditSchema) })
    .parse(audit.body).entries;
  const ownEntries = entries.filter((entry) => operators.has(entry.actorId));
  check(
    [...auditIds].every((id) =>
      ownEntries.some(
        (entry) => entry.id === id && entry.outcome === 'succeeded',
      ),
    ),
    'Persisted mutation completion',
  );
  check(
    ownEntries.some(
      (entry) => entry.action === 'create' && entry.outcome === 'failed',
    ) &&
      ownEntries.some(
        (entry) => entry.action === 'delete' && entry.outcome === 'failed',
      ),
    'Failed attempts retained',
  );
  check(
    !JSON.stringify(audit.body).includes(password) &&
      !JSON.stringify(audit.body).includes(values.GOTRUE_ADMIN_TOKEN),
    'Safe audit response',
  );
  config.OPERATOR_UUID_ALLOWLIST.delete(remaining.id);
  check(
    (
      await request(resource.app)
        .get('/v1/operator/auth/me')
        .set('Cookie', remainingCookie)
    ).status === 403,
    'Eligibility rechecked',
  );
  config.OPERATOR_UUID_ALLOWLIST.add(remaining.id);
  const logout = await mutate(
    'post',
    '/v1/operator/auth/logout',
    remainingCookie,
    {},
  );
  check(
    logout.status === 204 &&
      (
        await request(resource.app)
          .get('/v1/operator/auth/me')
          .set('Cookie', remainingCookie)
      ).status === 401,
    'Logout persists',
  );
  console.log(
    JSON.stringify({
      liveManagement: true,
      safePaginationDetails: true,
      ordinaryAccountRejected: true,
      confirmedAndUnconfirmedCreation: true,
      createSendsNoInvitation: true,
      banDurationVerified: true,
      oldAccessTokenAcceptedDuringBan: oldTokenAccepted,
      permanentDeleteVerified: true,
      auditAndSessionsSurviveRestart: true,
      twoInstanceLastOperatorProtection: true,
      eligibilityAndLogoutVerified: true,
    }),
  );
} catch (error: unknown) {
  // Only own fixed assertion labels are printed, never raw adapter/database errors.
  console.error(
    error instanceof UpstreamError
      ? 'Controlled upstream verification failed.'
      : error instanceof LocalManagementCheckError
        ? `Local management check failed: ${error.message}`
        : 'Local management check failed. No credentials displayed.',
  );
  process.exitCode = 1;
} finally {
  for (const session of sessions) {
    try {
      const origin = loadConfig(values).FRONTEND_ORIGINS[0];
      const cleanupResource = resources.find((value) => !closed.has(value));
      if (origin && cleanupResource)
        await request(cleanupResource.app)
          .post('/v1/operator/auth/logout')
          .set('Origin', origin)
          .set('X-CSRF-Protection', '1')
          .set('Cookie', session.cookie);
    } catch {
      console.error('Disposable session cleanup could not be confirmed.');
    }
  }
  for (const resource of resources) {
    await closeResource(resource);
  }
  for (const id of owned) {
    try {
      await admin.deleteUser(id);
    } catch {
      console.error('Disposable account cleanup could not be confirmed.');
      process.exitCode = 1;
    }
  }
  console.log(
    'Disposable accounts removed where confirmed; audit history retained. Real operator configuration unchanged.',
  );
}
