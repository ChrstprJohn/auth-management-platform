import { readFile } from 'node:fs/promises';
import { randomBytes, randomUUID } from 'node:crypto';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';
import type { Server } from 'node:http';
import { chromium, type Browser, type Page } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';
import { z } from 'zod';
import { GoTrueAdminClient } from '@auth/gotrue-client';
import { createApp } from '../apps/gotrue-admin-api/src/app.js';
import { loadConfig } from '../apps/gotrue-admin-api/src/config/env.js';
import { localOperatorConfig } from './local-operator.js';
import { assertMailpitCapture } from './mailpit-capture.js';
import { mutationSchema } from '../apps/gotrue-admin-web/src/lib/api/schemas.js';

// Manual foreground browser verification. --live uses only disposable identities
// and ordinary application queries; never schema/setup SQL or infrastructure startup.
const live = process.argv.includes('--live');
const recoveryOnly = process.argv.includes('--recovery-only');
const reviewPort = 5173;
const base = `http://localhost:${reviewPort}`;
const apiBase = 'http://localhost:3101';
let stage = 'initialize';
let web: ViteDevServer | undefined;
let browser: Browser | undefined;
let activePage: Page | undefined;
let server: Server | undefined;
let resource: ReturnType<typeof createApp> | undefined;
let disabledServer: Server | undefined;
let disabledResource: ReturnType<typeof createApp> | undefined;
let admin: GoTrueAdminClient | undefined;
const owned = new Set<string>();
const messages: string[] = [];
const seen = new Set<string>();
const runtimeErrorNames = new Set<string>();
const navigationStatuses: Array<{
  origin: string;
  path: string;
  status: number;
}> = [];
let callbackRouted = false;
function check(condition: boolean, label: string): asserts condition {
  if (!condition) throw new BrowserCheckFailure(label);
}
class BrowserCheckFailure extends Error {}
async function heading(page: Page, text: string) {
  await page.getByRole('heading', { name: text, exact: true }).waitFor();
}
async function navigate(page: Page, path: string, title: string) {
  await page.goto(`${base}${path}`);
  await heading(page, title);
}
async function login(page: Page, email: string, password: string) {
  await navigate(page, '/login', 'Operator sign in');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await heading(page, 'Users');
  await page.getByRole('table').waitFor();
}
async function liveReview(page: Page) {
  assertMailpitCapture();
  stage = 'load loopback-only configuration';
  const environment = await readFile(
    new URL('../apps/gotrue-admin-api/.env', import.meta.url),
    'utf8',
  );
  const values = parseEnv(environment);
  const local = localOperatorConfig(environment);
  check(!!values.GOTRUE_ADMIN_TOKEN, 'Local admin credential configured');
  admin = new GoTrueAdminClient(local.baseUrl, 5000, values.GOTRUE_ADMIN_TOKEN);
  const password = randomBytes(24).toString('base64url');
  const newPassword = randomBytes(24).toString('base64url');
  const email = `web-check-${randomUUID()}@example.test`;
  const identity = await admin.createUser(email, password, true);
  owned.add(identity.id);
  const config = loadConfig({
    ...values,
    HOST: '127.0.0.1',
    PORT: '3101',
    FRONTEND_ORIGINS: base,
    OPERATOR_UUID_ALLOWLIST: identity.id,
    ALLOW_GLOBAL_USER_DELETION: 'true',
    LOG_LEVEL: 'silent',
  });
  resource = createApp(config);
  server = resource.app.listen(3101, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server?.once('listening', resolve);
    server?.once('error', reject);
  });
  if (!recoveryOnly) {
    disabledResource = createApp({
      ...config,
      PORT: 3102,
      ALLOW_GLOBAL_USER_DELETION: false,
    });
    disabledServer = disabledResource.app.listen(3102, '127.0.0.1');
    await new Promise<void>((resolve, reject) => {
      disabledServer?.once('listening', resolve);
      disabledServer?.once('error', reject);
    });
  }
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (response.request().isNavigationRequest())
      navigationStatuses.push({
        origin: url.origin,
        path: url.pathname,
        status: response.status(),
      });
    if (url.origin === apiBase && response.request().method() !== 'OPTIONS')
      seen.add(
        `${response.request().method()} ${url.pathname.replace(/[0-9a-f-]{36}/g, ':id')}`,
      );
  });
  stage = 'live operator login/account/restore';
  await login(page, email, password);
  await page.reload();
  await heading(page, 'Users');
  await navigate(page, '/account', 'Current account');
  await page.getByText(email, { exact: true }).last().waitFor();
  if (!recoveryOnly) {
    stage = 'live last operator refusal';
    await navigate(page, `/users/${identity.id}`, 'Account details');
    await page.getByRole('button', { name: 'Ban user', exact: true }).click();
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Confirm ban' })
      .click();
    await page
      .getByRole('alertdialog')
      .getByText('Technical details', { exact: true })
      .click();
    await page
      .getByRole('alertdialog')
      .getByText(/last usable operator/)
      .waitFor();
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Cancel' })
      .click();
    for (const policy of ['Require verification', 'Operator confirmed']) {
      stage = `live create ${policy}`;
      const targetEmail = `web-target-${randomUUID()}@example.test`;
      await navigate(page, '/users/new', 'Create user');
      await page.getByLabel('Email', { exact: true }).fill(targetEmail);
      await page.getByLabel('Password', { exact: true }).fill(password);
      stage = 'live explicit creation policy';
      await page.getByRole('radio', { name: policy, exact: true }).click();
      const createdResponse = page.waitForResponse(
        (response) =>
          response.url() === `${apiBase}/v1/operator/users` &&
          response.request().method() === 'POST',
      );
      await page
        .getByRole('dialog', { name: 'Create user' })
        .getByRole('button', { name: 'Create user', exact: true })
        .click();
      stage = 'live create response';
      check(
        (await page.locator('[data-slot="field-error"]').count()) === 0,
        'Creation form has no validation errors',
      );
      const creationResponse = await createdResponse;
      check(creationResponse.status() === 201, 'Create returned 201');
      const creationBody: unknown = await creationResponse.json();
      const boundary = mutationSchema.safeParse(creationBody);
      if (!boundary.success) {
        console.log(
          JSON.stringify({
            invalidContractFields: boundary.error.issues.map((issue) =>
              issue.path.join('.'),
            ),
          }),
        );
      }
      const created = z
        .object({ user: z.object({ id: z.uuid() }) })
        .parse(creationBody);
      owned.add(created.user.id);
      check(boundary.success, 'Live creation response matches frontend schema');
      stage = 'live create success UI';
      await page
        .getByRole('dialog', { name: 'Create user' })
        .waitFor({ state: 'hidden' });
      await page
        .locator('[data-sonner-toast]')
        .filter({ hasText: 'User created' })
        .waitFor();
      await navigate(page, `/users/${created.user.id}`, 'Account details');
      stage = 'live created account details';
      await heading(page, 'Account details');
      if (policy === 'Operator confirmed') {
        stage = 'live ordinary-account denial';
        const ordinaryContext = await browser?.newContext();
        check(!!ordinaryContext, 'Ordinary-account browser context');
        try {
          const ordinaryPage = await ordinaryContext.newPage();
          await navigate(ordinaryPage, '/login', 'Operator sign in');
          await ordinaryPage
            .getByLabel('Email', { exact: true })
            .fill(targetEmail);
          await ordinaryPage
            .getByLabel('Password', { exact: true })
            .fill(password);
          await ordinaryPage
            .getByRole('button', { name: 'Sign in', exact: true })
            .click();
          await ordinaryPage.getByRole('alert').waitFor();
          check(
            new URL(ordinaryPage.url()).pathname === '/login',
            'Ordinary account receives no protected route',
          );
        } finally {
          await ordinaryContext.close();
        }
        stage = 'live disabled deletion';
        const deleteUrl = `${apiBase}/v1/operator/users/${created.user.id}`;
        await page.route(deleteUrl, (route) =>
          route.request().method() === 'DELETE'
            ? route.continue({
                url: route
                  .request()
                  .url()
                  .replace(apiBase, 'http://localhost:3102'),
              })
            : route.continue(),
        );
        await page
          .getByRole('button', { name: 'Permanently delete user' })
          .click();
        await page
          .getByRole('alertdialog')
          .getByRole('button', { name: 'Confirm permanent deletion' })
          .click();
        await page
          .getByRole('alertdialog')
          .getByText('Technical details', { exact: true })
          .click();
        await page
          .getByRole('alertdialog')
          .getByText(/disabled/)
          .waitFor();
        await page
          .getByRole('alertdialog')
          .getByRole('button', { name: 'Cancel' })
          .click();
        await page.unroute(deleteUrl);
        check(
          new URL(page.url()).pathname.endsWith(created.user.id),
          'Disabled deletion preserves details',
        );
      }
      for (const [start, confirm, done] of [
        ['Ban user', 'Confirm ban', 'User banned'],
        ['Unban user', 'Confirm unban', 'User unbanned'],
      ]) {
        stage = `live ${done}`;
        await page
          .getByRole('button', { name: start ?? '', exact: true })
          .click();
        await page
          .getByRole('alertdialog')
          .getByRole('button', { name: confirm ?? '', exact: true })
          .click();
        await page.getByText(done ?? '', { exact: true }).waitFor();
      }
      stage = 'live permanent delete';
      await page
        .getByRole('button', { name: 'Permanently delete user' })
        .click();
      await page
        .getByRole('alertdialog')
        .getByRole('button', { name: 'Confirm permanent deletion' })
        .click();
      await heading(page, 'Users');
      await page.getByText('User deleted').waitFor();
      owned.delete(created.user.id);
      await navigate(page, `/users/${created.user.id}`, 'Account not found');
    }
    stage = 'live history and health';
    await navigate(page, '/history', 'Action history');
    await page.getByRole('table').waitFor();
    await navigate(page, '/status', 'Service status');
    await page.getByText('GoTrue version:', { exact: false }).waitFor();
  }
  stage = 'live recovery request';
  await navigate(page, '/forgot-password', 'Recover your password');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByRole('button', { name: 'Request recovery email' }).click();
  await page.getByText('Check your email', { exact: true }).waitFor();
  const mailList = z.object({
    messages: z.array(
      z.object({
        ID: z.string(),
        To: z.array(z.object({ Address: z.string() })),
      }),
    ),
  });
  let messageId: string | undefined;
  for (let attempt = 0; attempt < 10; attempt++) {
    const response = await fetch('http://localhost:8025/api/v1/messages', {
      signal: AbortSignal.timeout(10000),
    });
    messageId = mailList
      .parse(await response.json())
      .messages.find((message) =>
        message.To.some((recipient) => recipient.Address === email),
      )?.ID;
    if (messageId) break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  check(!!messageId, 'Disposable recovery mail received');
  messages.push(messageId);
  const mail = z
    .object({ HTML: z.string() })
    .parse(
      await (
        await fetch(`http://localhost:8025/api/v1/message/${messageId}`)
      ).json(),
    );
  const link = [...mail.HTML.matchAll(/href="([^"]+)"/g)]
    .map((match) => match[1]?.replaceAll('&amp;', '&'))
    .filter((value): value is string => !!value)
    .map((value) => new URL(value))
    .find(
      (url) =>
        url.origin === local.baseUrl &&
        url.pathname === '/verify' &&
        url.searchParams.get('type') === 'recovery',
    );
  check(!!link, 'Recovery link found');
  // Playwright routes only the first request in a redirect chain. Preserve
  // GoTrue's real verification response, rewriting its configured callback
  // origin only in this isolated browser; infrastructure configuration stays put.
  await page.route(link.href, async (route) => {
    const response = await route.fetch({ maxRedirects: 0 });
    const location = response.headers().location;
    check(!!location, 'Verification returned a callback redirect');
    const destination = new URL(location);
    const expected = new URL(config.RECOVERY_CALLBACK_URL);
    check(
      destination.origin === expected.origin &&
        destination.pathname === expected.pathname,
      'Verification redirect matches the configured callback',
    );
    destination.host = new URL(apiBase).host;
    callbackRouted = true;
    await route.fulfill({
      response,
      headers: { ...response.headers(), location: destination.href },
    });
  });
  stage = 'live same-browser callback/reset';
  await page.goto(link.href);
  check(callbackRouted, 'Callback navigation routed to the isolated listener');
  await heading(page, 'Set a new password');
  check(
    new URL(page.url()).search === '' && new URL(page.url()).hash === '',
    'Reset destination contains no recovery values',
  );
  await page.getByLabel('New password', { exact: true }).fill(newPassword);
  await page.getByLabel('Confirm password', { exact: true }).fill(newPassword);
  await page
    .getByRole('button', { name: 'Reset password', exact: true })
    .click();
  await page.getByText('Sign in with your new password').waitFor();
  stage = 'live new-password login/logout';
  await login(page, email, newPassword);
  await navigate(page, '/account', 'Current account');
  await page.getByRole('button', { name: 'Logout', exact: true }).click();
  await heading(page, 'Operator sign in');
  if (!recoveryOnly)
    check(
      seen.size === 16,
      'All fifteen JSON calls and callback navigation covered',
    );
  console.log(
    recoveryOnly
      ? 'Live same-browser recovery/reset/new-login/logout passed.'
      : 'Live login/restore/account, both create policies, ban/unban/delete/missing, last-operator and disabled-deletion refusal, ordinary-account denial, history, health, same-browser recovery/reset/new-login/logout passed. Callback redirect rewritten only in this browser to the isolated listener.',
  );
  console.log(
    JSON.stringify({
      endpointCalls: [...seen].sort(),
      callbackNavigation: true,
    }),
  );
}
// Fixture mode delegates to the current bounded clarity review; historical flags
// no longer run obsolete retained-success or audit-dialog assertions.
if (!live) {
  if (process.argv.includes('--ui-review=confirm'))
    process.argv.push('--confirm');
  await import('./verify-ui-clarity.js');
} else {
  try {
    process.env.VITE_API_BASE_URL = apiBase;
    stage = 'foreground Vite startup';
    web = await createServer({
      root: fileURLToPath(new URL('../apps/gotrue-admin-web', import.meta.url)),
      logLevel: 'silent',
      server: { port: reviewPort },
    });
    await web.listen();
    stage = 'isolated browser startup';
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    activePage = page;
    page.setDefaultTimeout(30000);
    let pageErrors = 0;
    page.on('pageerror', (error) => {
      pageErrors++;
      runtimeErrorNames.add(error.name);
    });
    await liveReview(page);
    check(pageErrors === 0, 'No browser runtime errors');
  } catch (error: unknown) {
    // Never print raw browser/request errors, DOM snapshots, URLs or form values.
    console.error(
      `Browser verification failed during: ${stage}. No credentials displayed.`,
    );
    if (error instanceof BrowserCheckFailure)
      console.error(`Check: ${error.message}`);
    if (live)
      console.log(
        JSON.stringify({ observedMethodsAndPaths: [...seen].sort() }),
      );
    if (live)
      console.log(JSON.stringify({ navigationStatuses, callbackRouted }));
    console.log(
      JSON.stringify({ browserRuntimeErrorTypes: [...runtimeErrorNames] }),
    );
    if (live && activePage)
      console.log(
        JSON.stringify({
          screenHeadings: await activePage.locator('h1').allTextContents(),
          formCount: await activePage.locator('form').count(),
          pendingIndicators: await activePage
            .locator('[data-slot="spinner"]')
            .count(),
        }),
      );
    process.exitCode = 1;
  } finally {
    if (live && server && browser) {
      for (const context of browser.contexts()) {
        await context.request
          .post(`${apiBase}/v1/operator/auth/logout`, {
            headers: { Origin: base, 'X-CSRF-Protection': '1' },
          })
          .catch(() => {
            process.exitCode = 1;
          });
      }
    }
    await browser?.close();
    await web?.close();
    if (server)
      await new Promise<void>((resolve) => server?.close(() => resolve()));
    await resource?.close();
    if (disabledServer)
      await new Promise<void>((resolve) =>
        disabledServer?.close(() => resolve()),
      );
    await disabledResource?.close();
    for (const id of owned) {
      try {
        await admin?.deleteUser(id);
      } catch {
        console.error('Disposable account cleanup could not be confirmed.');
        process.exitCode = 1;
      }
    }
    for (const id of messages) {
      try {
        const response = await fetch('http://localhost:8025/api/v1/messages', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ IDs: [id] }),
          signal: AbortSignal.timeout(10000),
        });
        check(response.ok, 'Mail cleanup');
      } catch {
        console.error('Disposable message cleanup could not be confirmed.');
        process.exitCode = 1;
      }
    }
    console.log(
      'Agent-owned browser and foreground servers closed. Real operator configuration unchanged; durable audit retained.',
    );
  }
}
