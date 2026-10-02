import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type Page } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';

// Bounded foreground review. All API responses are fixtures: no SQL, real users,
// infrastructure startup, external mail or credential-bearing captures.
const pass = process.argv.includes('--confirm') ? 'confirm' : 'after';
const focused = process.argv.includes('--deletion-focus-only');
const base = 'http://localhost:5175';
const apiBase = 'http://localhost:3105';
const output = fileURLToPath(
  new URL(`../artifacts/web-review/clarity-${pass}/`, import.meta.url),
);
const id = '00000000-0000-4000-8000-000000000003';
const actor = '00000000-0000-4000-8000-000000000001';
const session = {
  operator: { id: actor, email: 'controlled@example.test' },
  expiresAt: new Date(Date.now() + 3600000).toISOString(),
};
const user = {
  id,
  email: 'long-account-name-for-responsive-review@example.test',
  createdAt: '2026-10-02T01:15:00Z',
  emailConfirmedAt: null,
  invitedAt: null,
  lastSignInAt: '2026-10-01T01:15:00Z',
  bannedUntil: null,
  isBanned: false,
};
const entry = {
  id,
  actorId: actor,
  targetId: id,
  action: 'send_verification',
  outcome: 'unknown',
  createdAt: user.createdAt,
  completedAt: null,
  requestId: id,
};
type Outcome = 'success' | 'pending' | 'unknown' | 'failure';
let outcome: Outcome = 'success';
let sessionState: 'valid' | 'expired' | 'denied' | 'unavailable' = 'valid';
let historyMissing = false;
let targetMissing = false;
let listEmpty = false;
let invited = false;
let release: (() => void) | undefined;
let mutationCalls = 0;
let listReads = 0;
let stage = 'initialize';
let web: ViteDevServer | undefined;
let browser: Browser | undefined;
let activePage: Page | undefined;
const captures: string[] = [];
const runtimeErrors: string[] = [];

function check(value: boolean, label: string): asserts value {
  if (!value) throw new Error(label);
}
async function navigate(page: Page, route: string, heading: string) {
  await page.goto(base + route, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.getByRole('heading', { name: heading, exact: true }).waitFor();
}
async function capture(page: Page, name: string) {
  await page.evaluate(() => document.fonts.ready);
  check(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
    `${name}: viewport overflow`,
  );
  const dialog = page.locator(
    '[data-slot="dialog-content"], [data-slot="alert-dialog-content"]',
  );
  if (await dialog.count()) {
    check(
      await dialog.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return (
          rect.left >= 0 &&
          rect.right <= window.innerWidth + 1 &&
          rect.top >= 0 &&
          rect.bottom <= window.innerHeight + 1
        );
      }),
      `${name}: dialog exceeds viewport`,
    );
  }
  await page.screenshot({ path: `${output}/${name}.png`, fullPage: true });
  captures.push(name);
}
async function focusInside(page: Page, role: 'dialog' | 'alertdialog') {
  const dialog = page.getByRole(role);
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('Tab');
    check(
      await dialog.evaluate((element) =>
        element.contains(document.activeElement),
      ),
      `${role}: keyboard focus stays inside`,
    );
  }
}
async function toastOnce(page: Page, message: string) {
  const toast = page
    .locator('[data-sonner-toast]')
    .filter({ hasText: message });
  await toast.waitFor();
  check((await toast.count()) === 1, `${message}: one notification`);
  check(
    !(await toast.textContent())?.includes(id),
    `${message}: no support IDs`,
  );
}
async function fillCreate(page: Page) {
  await page.getByLabel('Email', { exact: true }).fill('new@example.test');
  await page.getByLabel('Password', { exact: true }).fill('fixture-password');
  await page
    .getByRole('radio', { name: 'Operator confirmed', exact: true })
    .click();
}
try {
  process.env.VITE_API_BASE_URL = apiBase;
  await mkdir(output, { recursive: true });
  web = await createServer({
    root: fileURLToPath(new URL('../apps/gotrue-admin-web', import.meta.url)),
    logLevel: 'silent',
    server: { port: 5175, strictPort: true },
  });
  await web.listen();
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
    timezoneId: 'Asia/Manila',
  });
  const page = await context.newPage();
  activePage = page;
  page.setDefaultTimeout(20000);
  page.on('pageerror', (error) => runtimeErrors.push(error.name));
  await page.route(`${apiBase}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const headers = {
      'access-control-allow-origin': base,
      'access-control-allow-credentials': 'true',
      'access-control-allow-headers': 'Content-Type,X-CSRF-Protection',
      'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS',
    };
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }
    let body: unknown;
    let status = 200;
    const failure = (code: string) => ({
      error: { code, message: 'Fixture response' },
      requestId: id,
    });
    if (request.method() !== 'GET') {
      check(
        request.headers()['x-csrf-protection'] === '1',
        'Credentialed mutation includes CSRF',
      );
      mutationCalls++;
      if (outcome === 'pending')
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      if (outcome === 'unknown') {
        status = 503;
        body = {
          ...failure('AUDIT_COMPLETION_FAILED'),
          auditId: id,
          outcome: 'succeeded',
        };
      } else if (outcome === 'failure') {
        status = 409;
        body = failure('USER_EXISTS');
      } else if (path.endsWith('/login')) body = session;
      else if (path.endsWith('/forgot-password')) {
        status = 202;
        body = { message: 'Fixture acknowledgement' };
      } else if (
        path.endsWith('/logout') ||
        path.endsWith('/reset-password') ||
        path.startsWith('/v1/email/')
      ) {
        await route.fulfill({ status: 204, headers });
        return;
      } else if (request.method() === 'DELETE')
        body = { deleted: true, targetId: id, auditId: id };
      else {
        status =
          path.endsWith('/invitations') ||
          path.endsWith('/send-verification') ||
          path.endsWith('/resend-invitation')
            ? 202
            : path === '/v1/operator/users'
              ? 201
              : 200;
        body = {
          user: { ...user, invitedAt: invited ? user.createdAt : null },
          auditId: id,
        };
      }
    } else if (path.endsWith('/me')) {
      if (sessionState !== 'valid') {
        status =
          sessionState === 'expired'
            ? 401
            : sessionState === 'denied'
              ? 403
              : 503;
        body = failure(
          sessionState === 'expired'
            ? 'AUTHENTICATION_REQUIRED'
            : sessionState === 'denied'
              ? 'ACCESS_DENIED'
              : 'DEPENDENCY_UNAVAILABLE',
        );
      } else body = session;
    } else if (path === '/v1/operator/users') {
      listReads++;
      body = {
        users: listEmpty
          ? []
          : [{ ...user, invitedAt: invited ? user.createdAt : null }],
        page: Number(url.searchParams.get('page') ?? 1),
        perPage: Number(url.searchParams.get('perPage') ?? 20),
        hasNextPage: false,
      };
    } else if (path === '/v1/operator/audit')
      body = {
        entries: [
          entry,
          {
            ...entry,
            id: '00000000-0000-4000-8000-000000000004',
            action: 'invite',
            outcome: 'succeeded',
            targetId: null,
            completedAt: entry.createdAt,
          },
        ],
        page: Number(url.searchParams.get('page') ?? 1),
        perPage: Number(url.searchParams.get('perPage') ?? 20),
        hasNextPage: false,
      };
    else if (path.startsWith('/v1/operator/audit/')) {
      status = historyMissing ? 404 : 200;
      body = historyMissing ? failure('AUDIT_NOT_FOUND') : { entry };
    } else if (path.startsWith('/v1/operator/users/')) {
      status = targetMissing ? 404 : 200;
      body = targetMissing
        ? failure('USER_NOT_FOUND')
        : { user: { ...user, invitedAt: invited ? user.createdAt : null } };
    } else if (path === '/health/live') body = { status: 'ok' };
    else if (path === '/health/ready') body = { status: 'ready' };
    else if (path === '/v1/operator/health')
      body = { status: 'reachable', version: 'fixture-v2.196.0' };
    else {
      status = 404;
      body = failure('USER_NOT_FOUND');
    }
    await route.fulfill({ status, headers, json: body });
  });
  for (const width of [1440, 320]) {
    const device = width === 1440 ? 'desktop' : 'mobile';
    console.log(`Reviewing ${device} pages and interactions.`);
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 760 });
    outcome = 'success';
    sessionState = 'valid';
    targetMissing = false;
    historyMissing = false;
    listEmpty = false;
    if (focused) {
      await navigate(page, `/users/${id}`, 'Account details');
      await page
        .getByRole('button', { name: 'Permanently delete user' })
        .click();
      await page
        .getByRole('alertdialog')
        .getByRole('button', { name: 'Confirm permanent deletion' })
        .click();
      await page.getByRole('heading', { name: 'Users', exact: true }).waitFor();
      await page.waitForFunction(() => document.activeElement?.id === 'main');
      await toastOnce(page, 'User deleted');
      console.log(`${device}: deleted account returns focus to Users.`);
      continue;
    }
    for (const [route, title, name] of [
      ['/dashboard', 'Dashboard', 'dashboard'],
      ['/users?page=3&perPage=50', 'Users', 'users'],
      [`/users/${id}`, 'Account details', 'account-details'],
      ['/history?page=3&perPage=50', 'Action history', 'history'],
      [`/history/${id}?page=3&perPage=50`, 'Action details', 'history-details'],
      ['/status', 'Service status', 'status'],
      ['/account', 'Current account', 'current-account'],
      ['/login', 'Operator sign in', 'login'],
      ['/forgot-password', 'Recover your password', 'forgot'],
      ['/reset-password', 'Set a new password', 'reset'],
      ['/confirm-email', 'Confirm your email', 'confirm-email'],
      ['/accept-invitation', 'Accept your invitation', 'accept-invitation'],
      ['/auth/callback', 'Email link result', 'callback'],
      ['/not-found', 'Page not found', 'missing-route'],
    ] as const) {
      stage = `${device}: ${name}`;
      await navigate(page, route ?? '', title ?? '');
      if (name === 'dashboard')
        await page.getByRole('heading', { name: 'Recent attempts' }).waitFor();
      if (name === 'users' || name === 'history')
        await page.getByRole('table').waitFor();
      if (name === 'history-details')
        await page.getByRole('link', { name: user.email }).waitFor();
      await capture(page, `${device}-${name}`);
    }
    stage = `${device}: invite lifecycle`;
    await navigate(page, '/users/invite?page=3&perPage=50', 'Invite user');
    stage = `${device}: legacy invitation opens`;
    const invite = page.getByRole('dialog', {
      name: 'Invite user',
      exact: true,
    });
    await invite.waitFor();
    check(
      new URL(page.url()).search === '?page=3&perPage=50',
      'Invite preserves pagination',
    );
    await focusInside(page, 'dialog');
    await invite.getByRole('button', { name: 'Send invitation' }).click();
    check(
      await page
        .getByLabel('Recipient email')
        .evaluate((element) => element === document.activeElement),
      'Invite focuses first invalid field',
    );
    await capture(page, `${device}-invite-validation`);
    await page.keyboard.press('Escape');
    await invite.waitFor({ state: 'hidden' });
    check(
      await page
        .getByRole('button', { name: 'Invite user', exact: true })
        .evaluate((element) => element === document.activeElement),
      'Invite returns idle focus',
    );
    await page
      .getByRole('button', { name: 'Invite user', exact: true })
      .click();
    await page.getByLabel('Recipient email').fill('invite@example.test');
    const callsBeforeInvite = mutationCalls;
    const readsBeforeInvite = listReads;
    await invite.getByRole('button', { name: 'Send invitation' }).dblclick();
    stage = `${device}: accepted invitation closes`;
    await invite.waitFor({ state: 'hidden' });
    await toastOnce(page, 'Invitation requested');
    check(
      mutationCalls === callsBeforeInvite + 1,
      'Invite suppresses duplicate submits',
    );
    await page.waitForFunction(
      () => document.activeElement?.textContent?.trim() === 'Invite user',
    );
    check(listReads > readsBeforeInvite, 'Invite refreshes Users');
    await page
      .getByRole('button', { name: 'Invite user', exact: true })
      .click();
    check(
      (await page.getByLabel('Recipient email').inputValue()) === '',
      'Invite reopens fresh',
    );
    await toastOnce(page, 'Invitation requested');
    await page.keyboard.press('Escape');
    stage = `${device}: creation pending and success`;
    await navigate(page, '/users/new?page=3&perPage=50', 'Create user');
    const create = page.getByRole('dialog', {
      name: 'Create user',
      exact: true,
    });
    await create.waitFor();
    await focusInside(page, 'dialog');
    await fillCreate(page);
    outcome = 'pending';
    const callsBeforeCreate = mutationCalls;
    await create
      .getByRole('button', { name: 'Create user', exact: true })
      .dblclick();
    await create.getByRole('button', { name: /Creating user/ }).waitFor();
    await page.keyboard.press('Escape');
    await page
      .locator('[data-slot="dialog-overlay"]')
      .click({ position: { x: 2, y: 2 }, force: true });
    check(await create.isVisible(), 'Pending create resists Escape/backdrop');
    check(
      await create.getByRole('button', { name: 'Cancel' }).isDisabled(),
      'Pending create blocks Cancel',
    );
    check(
      (await page.getByLabel('Password', { exact: true }).inputValue()) === '',
      'Creation releases password',
    );
    await capture(page, `${device}-create-pending`);
    check(
      mutationCalls === callsBeforeCreate + 1,
      'Create suppresses duplicate submits',
    );
    outcome = 'success';
    release?.();
    release = undefined;
    await create.waitFor({ state: 'hidden' });
    await toastOnce(page, 'User created');
    await page.waitForFunction(
      () => document.activeElement?.textContent?.trim() === 'Create user',
    );
    await page
      .getByRole('button', { name: 'Create user', exact: true })
      .click();
    check(
      (await page.getByLabel('Email', { exact: true }).inputValue()) === '',
      'Create reopens fresh',
    );
    await capture(page, `${device}-create-fresh`);
    await page.keyboard.press('Escape');
    stage = `${device}: management confirmations`;
    for (const [start, confirm, message] of [
      ['Ban user', 'Confirm ban', 'User banned'],
      ['Unban user', 'Confirm unban', 'User unbanned'],
      [
        'Send verification email',
        'Send verification email',
        'Verification requested',
      ],
      ['Permanently delete user', 'Confirm permanent deletion', 'User deleted'],
    ] as const) {
      await navigate(page, `/users/${id}`, 'Account details');
      await page.getByRole('button', { name: start, exact: true }).click();
      const dialog = page.getByRole('alertdialog');
      await focusInside(page, 'alertdialog');
      if (start === 'Permanently delete user')
        await capture(page, `${device}-delete-confirmation`);
      await dialog.getByRole('button', { name: confirm, exact: true }).click();
      await dialog.waitFor({ state: 'hidden' });
      await toastOnce(page, message ?? '');
      await page.waitForFunction(
        (label) =>
          document.activeElement?.textContent?.trim() === label ||
          document.activeElement?.id === 'main',
        start,
      );
    }
    invited = true;
    await navigate(page, `/users/${id}`, 'Account details');
    await page
      .getByRole('button', { name: 'Resend invitation', exact: true })
      .click();
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Resend invitation', exact: true })
      .click();
    await page.getByRole('alertdialog').waitFor({ state: 'hidden' });
    await toastOnce(page, 'Invitation requested');
    invited = false;
    stage = `${device}: uncertain invitation and history`;
    await navigate(page, '/users', 'Users');
    outcome = 'unknown';
    await page
      .getByRole('button', { name: 'Invite user', exact: true })
      .click();
    await page.getByLabel('Recipient email').fill('uncertain@example.test');
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Send invitation' })
      .click();
    await page.getByRole('alert').waitFor();
    check(
      await page.getByRole('button', { name: 'Send invitation' }).isDisabled(),
      'Unknown invite blocks repetition',
    );
    await capture(page, `${device}-invite-unknown`);
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    check(
      await page.getByRole('alert').isVisible(),
      'Unknown persists outside dialog',
    );
    await page.getByRole('link', { name: 'View history', exact: true }).click();
    await page
      .getByRole('heading', { name: 'Action details', exact: true })
      .waitFor();
    await page
      .getByRole('link', { name: 'Back to history', exact: true })
      .click();
    await page.getByRole('table').waitFor();
    await page
      .getByRole('button', { name: `Actions for action ${id}` })
      .click();
    check(
      (await page
        .getByRole('menuitem', { name: `View Send verification ${id}` })
        .textContent()) === 'View',
      'History menu label is View',
    );
    await page
      .getByRole('menuitem', { name: `View Send verification ${id}` })
      .click();
    await page
      .getByRole('heading', { name: 'Action details', exact: true })
      .waitFor();
    await page.reload();
    await page.getByRole('link', { name: user.email }).waitFor();
    await page.getByText('Technical details', { exact: true }).click();
    await capture(page, `${device}-history-technical`);
    targetMissing = true;
    await navigate(page, `/history/${id}`, 'Action details');
    await page
      .getByText('Account is unavailable or has since been deleted.')
      .waitFor();
    await capture(page, `${device}-history-target-missing`);
    historyMissing = true;
    await navigate(page, `/history/${id}`, 'Action details');
    await page.getByText('Action not found', { exact: true }).waitFor();
    await capture(page, `${device}-history-missing`);
    historyMissing = false;
    targetMissing = false;
    outcome = 'success';
    listEmpty = true;
    await navigate(page, '/users', 'Users');
    await page.getByText('No users on this page', { exact: true }).waitFor();
    await capture(page, `${device}-users-empty`);
    listEmpty = false;
    for (const [state, title] of [
      ['denied', 'Access denied'],
      ['unavailable', 'Session check unavailable'],
      ['expired', 'Operator sign in'],
    ] as const) {
      sessionState = state;
      await navigate(page, `/history/${id}`, title);
      await capture(page, `${device}-session-${state}`);
    }
    sessionState = 'valid';
    if (width === 320) {
      await navigate(page, '/users', 'Users');
      await page.getByRole('button', { name: 'Toggle Sidebar' }).click();
      await page.getByRole('dialog').waitFor();
      await capture(page, 'mobile-navigation');
      await page.keyboard.press('Escape');
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
    }
  }
  check(runtimeErrors.length === 0, 'No browser runtime errors');
  if (!focused)
    await writeFile(
      `${output}/evidence.json`,
      JSON.stringify(
        {
          pass,
          viewports: [1440, 320],
          captures,
          fixtureOnly: true,
          mutationCalls,
          runtimeErrors,
        },
        null,
        2,
      ),
    );
  console.log(
    focused
      ? 'Focused deletion check passed at desktop/320px: destination focus and one notification; no new visual captures.'
      : `UI clarity ${pass} review passed: ${captures.length} desktop/mobile captures, keyboard/focus, modal outcomes, direct history refresh and critical states.`,
  );
} catch (error) {
  if (activePage) {
    await activePage.screenshot({
      path: `${output}/fixture-failure.png`,
      fullPage: true,
    });
    console.log(
      JSON.stringify({
        path: new URL(activePage.url()).pathname,
        headings: await activePage.getByRole('heading').allTextContents(),
        dialogs: await activePage.getByRole('dialog').count(),
        alerts: await activePage.getByRole('alert').allTextContents(),
        runtimeErrors,
      }),
    );
  }
  console.error(
    `UI clarity review failed at ${stage}: ${error instanceof Error ? error.message.split('\n')[0] : 'Unknown fixture failure'}`,
  );
  process.exitCode = 1;
} finally {
  release?.();
  await browser?.close();
  await web?.close();
  console.log('Owned foreground browser and Vite resources closed.');
}
