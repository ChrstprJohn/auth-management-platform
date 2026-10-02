import { mkdir, readFile } from 'node:fs/promises';
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
const layoutReview = process.argv.includes('--layout-review');
const createReview = process.argv.includes('--create-review');
const emailReview = process.argv.includes('--email-review');
const uiReview = process.argv
  .find((argument) => argument.startsWith('--ui-review='))
  ?.split('=')[1];
if (uiReview && !['before', 'after', 'confirm'].includes(uiReview))
  throw new Error('Invalid UI review label');
const reviewPort = process.argv.includes('--review-port=5174') ? 5174 : 5173;
if (live && reviewPort !== 5173)
  throw new Error(
    'Live recovery review uses the configured trusted frontend port',
  );
const base = `http://localhost:${reviewPort}`;
const apiBase = 'http://localhost:3101';
const output = fileURLToPath(
  new URL(
    `../artifacts/web-review/${uiReview ? `${emailReview ? 'email' : createReview ? 'create' : layoutReview ? 'layout' : 'polish'}-${uiReview}/` : ''}`,
    import.meta.url,
  ),
);
const fixtureId = '00000000-0000-4000-8000-000000000003';
const fixtureSession = {
  operator: { id: fixtureId, email: 'controlled@example.test' },
  expiresAt: new Date(Date.now() + 3600000).toISOString(),
};
const fixtureUser = {
  id: fixtureId,
  email: 'disposable@example.test',
  createdAt: '2026-10-01T08:00:00Z',
  emailConfirmedAt: null,
  lastSignInAt: null,
  bannedUntil: null,
  isBanned: null,
};
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
async function screenshot(page: Page, name: string) {
  if (process.argv.includes('--behavior-only')) return;
  if (
    process.argv.includes('--table-review') &&
    ![
      'desktop-users',
      'desktop-history',
      'desktop-dashboard',
      'mobile-users',
      'mobile-history',
      'mobile-dashboard',
      'mobile-action-details',
      'desktop-user-actions',
      'desktop-action-menu',
      'desktop-action-details',
      'mobile-action-menu',
    ].includes(name)
  )
    return;
  // Fixture-only captures: no real identities, passwords, cookies or mail links.
  check(!live, 'Screenshots require fixtures');
  await page.screenshot({ path: `${output}/${name}.png`, fullPage: true });
}
async function fixtureReview(page: Page) {
  let scenario = 'data';
  let createCalls = 0;
  let releaseCreation: (() => void) | undefined;
  await page.route(`${apiBase}/**`, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
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
    if (path.endsWith('/me')) {
      if (scenario === 'denied' || scenario === 'session-error') {
        status = scenario === 'denied' ? 403 : 503;
        body = {
          error: {
            code:
              scenario === 'denied'
                ? 'ACCESS_DENIED'
                : 'DEPENDENCY_UNAVAILABLE',
            message: 'Fixture',
          },
          requestId: fixtureId,
        };
      } else body = fixtureSession;
    } else if (emailReview && path.startsWith('/v1/email/')) {
      check(
        request.headers()['x-csrf-protection'] === '1',
        'Email proof includes CSRF',
      );
      await route.fulfill({ status: 204, headers });
      return;
    } else if (
      emailReview &&
      (path.endsWith('/invitations') ||
        path.endsWith('/send-verification') ||
        path.endsWith('/resend-invitation'))
    ) {
      createCalls++;
      check(
        request.headers()['x-csrf-protection'] === '1',
        'Email send includes CSRF',
      );
      status = scenario === 'email-unknown' ? 503 : 202;
      body =
        scenario === 'email-unknown'
          ? {
              error: { code: 'UPSTREAM_OUTCOME_UNKNOWN', message: 'Fixture' },
              requestId: fixtureId,
              auditId: fixtureId,
              outcome: 'unknown',
            }
          : { user: { ...fixtureUser, isBanned: false }, auditId: fixtureId };
    } else if (path === '/v1/operator/users' && request.method() === 'POST') {
      createCalls++;
      check(
        request.headers()['x-csrf-protection'] === '1',
        'Creation includes CSRF header',
      );
      if (scenario === 'create-pending')
        await new Promise<void>((resolve) => {
          releaseCreation = resolve;
        });
      if (scenario === 'create-unknown') {
        status = 503;
        body = {
          error: { code: 'UPSTREAM_OUTCOME_UNKNOWN', message: 'Fixture' },
          requestId: fixtureId,
          auditId: fixtureId,
          outcome: 'unknown',
        };
      } else {
        status = 201;
        body = {
          user: {
            ...fixtureUser,
            email: `${'long-'.repeat(20)}address@example.test`,
          },
          auditId: fixtureId,
        };
      }
    } else if (path === '/v1/operator/users') {
      if (scenario === 'error') {
        status = 503;
        body = {
          error: { code: 'DEPENDENCY_UNAVAILABLE', message: 'Fixture' },
          requestId: fixtureId,
        };
      } else
        body = {
          users:
            scenario === 'empty'
              ? []
              : [
                  fixtureUser,
                  {
                    ...fixtureUser,
                    id: '00000000-0000-4000-8000-000000000011',
                    email: 'confirmed@example.test',
                    emailConfirmedAt: fixtureUser.createdAt,
                    isBanned: false,
                  },
                  {
                    ...fixtureUser,
                    id: '00000000-0000-4000-8000-000000000012',
                    email: 'long-address-for-responsive-review@example.test',
                    isBanned: true,
                    bannedUntil: '2026-10-02T08:00:00Z',
                  },
                ],
          page: 1,
          perPage: 20,
          hasNextPage: false,
        };
    } else if (
      path === `/v1/operator/users/${fixtureId}` &&
      scenario === 'missing'
    ) {
      status = 404;
      body = {
        error: { code: 'USER_NOT_FOUND', message: 'Fixture' },
        requestId: fixtureId,
      };
    } else if (path === '/v1/operator/audit')
      body = {
        entries: (['pending', 'succeeded', 'failed', 'unknown'] as const).map(
          (outcome, i) => ({
            id: `00000000-0000-4000-8000-00000000000${i + 4}`,
            actorId: fixtureId,
            targetId: fixtureId,
            action: (['create', 'ban', 'unban', 'delete'] as const)[i] ?? 'ban',
            outcome,
            createdAt: `2026-10-0${i + 1}T08:00:00Z`,
            completedAt: null,
            requestId: fixtureId,
          }),
        ),
        page: 1,
        perPage: 20,
        hasNextPage: false,
      };
    else if (path === '/health/live') body = { status: 'ok' };
    else if (path === '/health/ready') {
      status = 503;
      body = { status: 'unavailable' };
    } else if (path === '/v1/operator/health')
      body = { status: 'reachable', version: 'v2.196.0' };
    else if (path.endsWith('/ban')) {
      status = 503;
      body = {
        error: { code: 'UPSTREAM_OUTCOME_UNKNOWN', message: 'Fixture' },
        requestId: fixtureId,
        auditId: fixtureId,
        outcome: 'unknown',
      };
    } else
      body = {
        user: {
          ...fixtureUser,
          isBanned: emailReview ? false : fixtureUser.isBanned,
        },
      };
    await route.fulfill({
      status,
      headers,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
  await mkdir(output, { recursive: true });
  if (emailReview) {
    for (const width of [1440, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const [path, title] of [
        ['/users/invite', 'Invite a user'],
        ['/confirm-email', 'Confirm your email'],
        ['/accept-invitation', 'Accept your invitation'],
      ] as const) {
        await navigate(page, path, title);
        await screenshot(
          page,
          `${width}-${path.slice(1).replaceAll('/', '-')}`,
        );
        check(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
          'Email form fits viewport',
        );
      }
      await page
        .getByLabel('Email', { exact: true })
        .fill('invited@example.test');
      stage = 'email fixture proof submission';
      await page.getByLabel('Email code').fill('123456');
      await page
        .getByLabel('New password', { exact: true })
        .fill('fixture-password');
      await page
        .getByLabel('Confirm new password', { exact: true })
        .fill('fixture-password');
      await page
        .getByRole('button', { name: 'Verify email and set password' })
        .click();
      await page.getByText('Email verified and password set').waitFor();
      stage = 'email fixture account actions';
      await navigate(page, `/users/${fixtureId}`, 'Account details');
      await page
        .getByRole('button', { name: 'Send verification email', exact: true })
        .click();
      const dialog = page.getByRole('alertdialog');
      await dialog.waitFor();
      await screenshot(page, `${width}-verification-dialog`);
      check(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        'Verification dialog fits viewport',
      );
      await dialog.getByRole('button', { name: 'Cancel' }).click();
      await navigate(page, '/users/invite', 'Invite a user');
      const another = page.getByRole('button', { name: 'Invite another user' });
      if (await another.count()) await another.click();
      await page.getByLabel('Recipient email').fill('invited@example.test');
      await page
        .getByRole('button', { name: 'Send invitation', exact: true })
        .click();
      await page.getByRole('button', { name: 'Invite another user' }).waitFor();
    }
    check(
      createCalls === 2,
      'One invitation request per intentional submission',
    );
    await navigate(page, `/users/${fixtureId}`, 'Account details');
    scenario = 'email-unknown';
    await page
      .getByRole('button', { name: 'Send verification email', exact: true })
      .click();
    const dialog = page.getByRole('alertdialog');
    await dialog
      .getByRole('button', { name: 'Send verification email', exact: true })
      .click();
    await dialog.getByRole('alert').waitFor();
    await screenshot(page, '320-verification-unknown');
    check(
      await dialog.evaluate(
        (element) =>
          element.getBoundingClientRect().height <= window.innerHeight - 20,
      ),
      'Unknown email dialog remains inside mobile viewport',
    );
    console.log(
      'Email fixture review passed at desktop and 320px: recipient forms, invitation acceptance, confirmation dialog and invitation sends. No real email sent.',
    );
    return;
  }
  if (createReview) {
    const dialog = page.getByRole('dialog', { name: 'Create a global user' });
    const trigger = page.getByRole('button', {
      name: 'Create user',
      exact: true,
    });
    for (const width of [1440, 390, 320]) {
      stage = `create dialog ${width} form and keyboard`;
      await page.setViewportSize({
        width,
        height: width === 1440 ? 1000 : 844,
      });
      await navigate(page, '/users?page=3&perPage=50', 'Users');
      await page.getByRole('table').waitFor();
      await trigger.focus();
      await page.keyboard.press('Enter');
      await dialog.waitFor();
      await page.evaluate(() => document.fonts.ready);
      check(
        new URL(page.url()).search === '?page=3&perPage=50',
        'Modal preserves pagination URL',
      );
      check(
        await dialog
          .getByLabel('Email', { exact: true })
          .evaluate((element) => element === document.activeElement),
        'Dialog initially focuses email',
      );
      check(
        await dialog.evaluate((element) => {
          const bounds = element.getBoundingClientRect();
          return (
            bounds.top >= 0 &&
            bounds.bottom <= innerHeight &&
            element.scrollWidth <= element.clientWidth + 1
          );
        }),
        'Dialog fits viewport and long content',
      );
      await screenshot(page, `${width}-create-form`);
      await dialog
        .getByRole('button', { name: 'Create user', exact: true })
        .click();
      await dialog
        .getByText('Enter a valid email address.', { exact: true })
        .waitFor();
      check(
        await dialog
          .getByLabel('Email', { exact: true })
          .evaluate((element) => element === document.activeElement),
        'First invalid field focused',
      );
      await screenshot(page, `${width}-create-invalid`);
      await dialog.getByRole('button', { name: 'Cancel' }).focus();
      await page.keyboard.press('Tab');
      check(
        await dialog.evaluate((element) =>
          element.contains(document.activeElement),
        ),
        'Forward Tab stays in dialog',
      );
      await dialog.getByLabel('Email', { exact: true }).focus();
      await page.keyboard.press('Shift+Tab');
      check(
        await dialog.evaluate((element) =>
          element.contains(document.activeElement),
        ),
        'Backward Tab stays in dialog',
      );
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'detached' });
      check(
        await trigger.evaluate((element) => element === document.activeElement),
        'Escape returns focus to trigger',
      );
      await trigger.click();
      await dialog.waitFor();
      await page
        .locator('[data-slot="dialog-overlay"]')
        .click({ position: { x: 2, y: 2 } });
      await dialog.waitFor({ state: 'detached' });
      scenario = 'create-pending';
      await trigger.click();
      await dialog.getByLabel('Email', { exact: true }).fill(fixtureUser.email);
      await dialog
        .getByLabel('Password', { exact: true })
        .fill('fixture-password');
      await dialog
        .getByRole('radio', { name: 'Operator confirmed', exact: true })
        .click();
      await dialog
        .getByRole('button', { name: 'Create user', exact: true })
        .click();
      await dialog.getByRole('button', { name: /Creating user/ }).waitFor();
      check(
        await dialog.getByRole('button', { name: 'Cancel' }).isDisabled(),
        'Pending cancel disabled',
      );
      check(
        (await dialog.getByLabel('Password', { exact: true }).inputValue()) ===
          '',
        'Pending password cleared',
      );
      await page.keyboard.press('Escape');
      await page
        .locator('[data-slot="dialog-overlay"]')
        .click({ position: { x: 2, y: 2 } });
      check(await dialog.isVisible(), 'Pending Escape/backdrop cannot close');
      check(
        createCalls === [1440, 390, 320].indexOf(width) + 1,
        'One create request per explicit submit',
      );
      releaseCreation?.();
      await dialog.getByText('Account creation confirmed').waitFor();
      check(
        await dialog.evaluate(
          (element) => element.scrollWidth <= element.clientWidth + 1,
        ),
        'Long success email wraps',
      );
      await dialog
        .getByRole('button', { name: 'Close', exact: true })
        .scrollIntoViewIfNeeded();
      await screenshot(page, `${width}-create-success`);
      await dialog.getByRole('button', { name: 'Close', exact: true }).click();
      await dialog.waitFor({ state: 'detached' });
      await trigger.click();
      await dialog.getByText('Account creation confirmed').waitFor();
      await dialog.getByRole('button', { name: 'Create another user' }).click();
      check(
        (await dialog.getByLabel('Password', { exact: true }).inputValue()) ===
          '',
        'Intentional another clears password',
      );
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'detached' });
      scenario = 'data';
    }
    stage = 'legacy create redirect and unknown navigation';
    await navigate(
      page,
      '/users/new?page=2&perPage=50',
      'Create a global user',
    );
    check(
      new URL(page.url()).pathname === '/users' &&
        new URL(page.url()).search === '?page=2&perPage=50',
      'Legacy redirect preserves pagination',
    );
    scenario = 'create-unknown';
    await dialog.getByLabel('Email', { exact: true }).fill(fixtureUser.email);
    await dialog
      .getByLabel('Password', { exact: true })
      .fill('fixture-password');
    await dialog
      .getByRole('radio', { name: 'Require verification', exact: true })
      .click();
    await dialog
      .getByRole('button', { name: 'Create user', exact: true })
      .click();
    await dialog.getByRole('alert').waitFor();
    await screenshot(page, '320-create-unknown');
    await dialog.getByRole('link', { name: 'Inspect action history' }).click();
    await heading(page, 'Action history');
    await page.getByRole('button', { name: 'Toggle Sidebar' }).click();
    await page.getByRole('link', { name: 'Users', exact: true }).click();
    await heading(page, 'Users');
    await trigger.click();
    check(
      await dialog
        .getByRole('button', { name: 'Create user', exact: true })
        .isDisabled(),
      'Unknown stays blocked after navigation',
    );
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'detached' });
    await navigate(page, '/forgot-password', 'Recover your password');
    check(
      (await page
        .getByRole('link', { name: 'Mailpit', exact: true })
        .count()) === 0,
      'Recovery copy is provider-neutral',
    );
    console.log(
      'Create-dialog fixture review passed at 1440/390/320px: keyboard/focus trap and return, Escape/backdrop, pending protection, password cleanup, long success, legacy redirect and uncertainty across navigation. No email or infrastructure used.',
    );
    return;
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  if (uiReview === 'before') {
    for (const name of ['login-03', 'sidebar-07']) {
      stage = `official shadcn reference ${name}`;
      const response = await page.goto(
        `https://ui.shadcn.com/view/new-york-v4/${name}`,
      );
      check(response?.ok() ?? false, 'Official block preview available');
      await page.evaluate(() => document.fonts.ready);
      await screenshot(page, `reference-${name}`);
    }
  }
  for (const [path, title, name] of [
    ['/login', 'Operator sign in', 'desktop-login'],
    ['/forgot-password', 'Recover your password', 'desktop-recovery'],
    ['/reset-password', 'Set a new password', 'desktop-reset'],
    ['/users', 'Users', 'desktop-users'],
    ['/dashboard', 'Dashboard', 'desktop-dashboard'],
    ['/users/new', 'Create a global user', 'desktop-create'],
    ['/history', 'Action history', 'desktop-history'],
    ['/status', 'Service status', 'desktop-status'],
    ['/account', 'Current account', 'desktop-account'],
  ]) {
    stage = `fixture ${name}`;
    await navigate(page, path ?? '', title ?? '');
    await page.locator('[data-slot="skeleton"]').waitFor({ state: 'detached' });
    if (path === '/dashboard')
      await page
        .getByRole('heading', { name: 'Activity by day', exact: true })
        .waitFor();
    await screenshot(page, name ?? 'fixture');
    if (path === '/users') {
      await page
        .getByRole('button', {
          name: 'Actions for disposable@example.test',
          exact: true,
        })
        .click();
      await page.getByRole('menuitem', { name: 'View account' }).waitFor();
      await screenshot(page, 'desktop-user-actions');
      await page.getByRole('menuitem', { name: 'View account' }).click();
      await heading(page, 'Account details');
    }
    if (path === '/history') {
      await page
        .getByRole('button', {
          name: 'Actions for action 00000000-0000-4000-8000-000000000004',
          exact: true,
        })
        .click();
      await page.getByRole('menuitem', { name: 'View details' }).waitFor();
      await screenshot(page, 'desktop-action-menu');
      await page.getByRole('menuitem', { name: 'View details' }).click();
      await page.getByRole('dialog', { name: 'Action details' }).waitFor();
      await screenshot(page, 'desktop-action-details');
      await page.keyboard.press('Escape');
      await page.getByRole('dialog').waitFor({ state: 'detached' });
    }
  }
  stage = 'fixture desktop detail and dialog';
  await navigate(page, `/users/${fixtureId}`, 'Account details');
  await screenshot(page, 'desktop-details');
  await page.getByRole('button', { name: 'Ban user', exact: true }).click();
  const dialog = page.getByRole('alertdialog');
  await dialog.waitFor();
  await screenshot(page, 'desktop-ban-dialog');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await dialog.waitFor({ state: 'detached' });
  check(
    await page
      .getByRole('button', { name: 'Ban user', exact: true })
      .evaluate((element) => element === document.activeElement),
    'Dialog returns focus to opener',
  );
  await page.getByRole('button', { name: 'Ban user', exact: true }).click();
  await dialog
    .getByRole('button', { name: 'Confirm ban', exact: true })
    .click();
  await dialog.getByRole('alert').waitFor();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('link', { name: 'Action history', exact: true }).click();
  await heading(page, 'Action history');
  check(
    (await page.getByRole('alert').count()) === 1,
    'Uncertain result survives navigation',
  );
  await screenshot(page, 'desktop-unknown-outcome');
  stage = 'fixture mobile review';
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [path, title, name] of [
    ['/login', 'Operator sign in', 'mobile-login'],
    ['/users', 'Users', 'mobile-users'],
    ['/dashboard', 'Dashboard', 'mobile-dashboard'],
    ['/users/new', 'Create a global user', 'mobile-create'],
    ['/history', 'Action history', 'mobile-history'],
    ['/forgot-password', 'Recover your password', 'mobile-recovery'],
    ['/reset-password', 'Set a new password', 'mobile-reset'],
    [`/users/${fixtureId}`, 'Account details', 'mobile-details'],
    ['/account', 'Current account', 'mobile-account'],
    ['/status', 'Service status', 'mobile-status'],
  ]) {
    await navigate(page, path ?? '', title ?? '');
    await page.locator('[data-slot="skeleton"]').waitFor({ state: 'detached' });
    if (path === '/dashboard')
      await page
        .getByRole('heading', { name: 'Activity by day', exact: true })
        .waitFor();
    check(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
      'Page width fits mobile',
    );
    await screenshot(page, name ?? 'mobile');
    if (path === '/history') {
      stage = 'fixture mobile action details';
      await page
        .getByRole('button', {
          name: `Actions for action 00000000-0000-4000-8000-000000000004`,
        })
        .click();
      await page.getByRole('menuitem', { name: 'View details' }).waitFor();
      await screenshot(page, 'mobile-action-menu');
      await page.getByRole('menuitem', { name: 'View details' }).click();
      await page.getByRole('dialog', { name: 'Action details' }).waitFor();
      await screenshot(page, 'mobile-action-details');
      await page.keyboard.press('Escape');
      await page.getByRole('dialog').waitFor({ state: 'detached' });
    }
    if (path === '/users' || path === '/history' || path === '/dashboard') {
      check(
        await page
          .locator('[data-slot="table-container"]')
          .evaluateAll((elements) =>
            elements.every(
              (element) => element.scrollWidth <= element.clientWidth + 1,
            ),
          ),
        'Preview tables fit without horizontal scrolling',
      );
    }
  }
  await navigate(page, '/users', 'Users');
  await page.getByRole('button', { name: 'Toggle Sidebar' }).click();
  await page.getByRole('dialog').waitFor();
  await screenshot(page, 'mobile-navigation');
  stage = 'fixture mobile sidebar Escape';
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  stage = 'fixture keyboard and read states';
  await page.setViewportSize({ width: 1440, height: 1000 });
  await navigate(page, '/users/new', 'Create a global user');
  await page
    .getByRole('dialog', { name: 'Create a global user' })
    .getByRole('button', { name: 'Create user', exact: true })
    .click();
  await page
    .getByText('Enter a valid email address.', { exact: true })
    .waitFor();
  check(
    await page
      .getByLabel('Email', { exact: true })
      .evaluate((element) => element === document.activeElement),
    'First invalid field receives focus',
  );
  scenario = 'empty';
  await navigate(page, '/users', 'Users');
  await heading(page, 'No users on this page');
  await screenshot(page, 'desktop-empty');
  scenario = 'error';
  await navigate(page, '/users', 'Users');
  await page.getByRole('alert').waitFor();
  await screenshot(page, 'desktop-error');
  check(
    (await page
      .getByRole('heading', { name: 'No users on this page' })
      .count()) === 0,
    'Read failure is not empty',
  );
  await navigate(page, '/unavailable-fixture-route', 'Page not found');
  if (layoutReview) {
    await screenshot(page, 'desktop-not-found');
    const routes = [
      ['/login', 'Operator sign in', 'login'],
      ['/forgot-password', 'Recover your password', 'recovery'],
      ['/reset-password', 'Set a new password', 'reset'],
      ['/users', 'Users', 'users'],
      ['/dashboard', 'Dashboard', 'dashboard'],
      ['/users/new', 'Create a global user', 'create'],
      [`/users/${fixtureId}`, 'Account details', 'details'],
      ['/history', 'Action history', 'history'],
      ['/status', 'Service status', 'status'],
      ['/account', 'Current account', 'account'],
    ] as const;
    scenario = 'data';
    for (const width of [320, 768, 1024]) {
      await page.setViewportSize({ width, height: 900 });
      for (const [path, title, name] of routes) {
        stage = `layout ${width} ${name}`;
        await navigate(page, path, title);
        await page
          .locator('[data-slot="skeleton"]')
          .waitFor({ state: 'detached' });
        await page.evaluate(() => document.fonts.ready);
        check(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
          `${width} page fits`,
        );
        check(
          await page
            .locator('[data-slot="table-container"]')
            .evaluateAll((elements) =>
              elements.every(
                (element) => element.scrollWidth <= element.clientWidth + 1,
              ),
            ),
          `${width} preview tables fit`,
        );
        if (width === 320) await screenshot(page, `narrow-${name}`);
      }
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await navigate(page, '/users', 'Users');
    stage = 'layout keyboard header account menu';
    await page.getByRole('button', { name: 'Header account menu' }).focus();
    await page.keyboard.press('Enter');
    await page.getByRole('menuitem', { name: 'Current account' }).waitFor();
    await screenshot(page, 'desktop-header-menu');
    await page.keyboard.press('Escape');
    check(
      await page
        .getByRole('button', { name: 'Header account menu' })
        .evaluate((element) => element === document.activeElement),
      'Header menu returns focus',
    );
    stage = 'layout collapsed sidebar';
    await page.getByRole('button', { name: 'Toggle Sidebar' }).click();
    await page.locator('[data-state="collapsed"]').waitFor();
    await screenshot(page, 'desktop-collapsed-sidebar');
    await page.getByRole('button', { name: 'Toggle Sidebar' }).click();
    for (const [path, title, name] of routes) {
      await navigate(page, path, title);
      await page
        .locator('[data-slot="skeleton"]')
        .waitFor({ state: 'detached' });
      await page.evaluate(() => document.documentElement.classList.add('dark'));
      await screenshot(page, `dark-${name}`);
    }
    await page.evaluate(() =>
      document.documentElement.classList.remove('dark'),
    );
    scenario = 'missing';
    await navigate(page, `/users/${fixtureId}`, 'Account not found');
    await screenshot(page, 'desktop-missing');
    scenario = 'denied';
    await navigate(page, '/users', 'Access denied');
    await screenshot(page, 'desktop-denied');
    scenario = 'session-error';
    await navigate(page, '/users', 'Session check unavailable');
    await screenshot(page, 'desktop-session-error');
    await page.setViewportSize({ width: 320, height: 900 });
    await navigate(page, '/users', 'Session check unavailable');
    await screenshot(page, 'narrow-session-error');
    await navigate(page, '/unavailable-fixture-route', 'Page not found');
    await screenshot(page, 'narrow-not-found');
    console.log(
      'Layout review passed at 320/390/768/1024/1440px, including dark tokens, header keyboard menu, collapsed/mobile sidebar and blocked routes.',
    );
  }
  console.log(
    'Fixture desktop/mobile/keyboard review completed; captures contain controlled fixtures only.',
  );
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
      .getByText(/last usable operator/)
      .waitFor();
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Cancel' })
      .click();
    for (const policy of ['Require verification', 'Operator confirmed']) {
      stage = `live create ${policy}`;
      const targetEmail = `web-target-${randomUUID()}@example.test`;
      await navigate(page, '/users/new', 'Create a global user');
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
        .getByRole('dialog', { name: 'Create a global user' })
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
      await Promise.race([
        page.getByText('Account creation confirmed', { exact: true }).waitFor(),
        page.locator('form [role="alert"]').waitFor(),
      ]);
      if (await page.locator('form [role="alert"]').count()) {
        console.log(
          JSON.stringify({
            safeCreationFeedback: await page
              .locator('form [role="alert"]')
              .allTextContents(),
          }),
        );
        throw new BrowserCheckFailure('Creation UI reported a safe failure');
      }
      await page
        .getByText('Account creation confirmed', { exact: true })
        .waitFor();
      stage = 'live opening created account';
      await page.getByText('Open account', { exact: true }).click();
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
        ['Ban user', 'Confirm ban', 'Ban confirmed'],
        ['Unban user', 'Confirm unban', 'Unban confirmed'],
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
      await page.getByText('Permanent deletion confirmed').waitFor();
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
  await page.getByText('Recovery requested', { exact: true }).waitFor();
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
  await page.getByText('Password reset confirmed').waitFor();
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
  if (live) await liveReview(page);
  else await fixtureReview(page);
  check(pageErrors === 0, 'No browser runtime errors');
} catch (error: unknown) {
  // Never print raw browser/request errors, DOM snapshots, URLs or form values.
  console.error(
    `Browser verification failed during: ${stage}. No credentials displayed.`,
  );
  if (error instanceof BrowserCheckFailure)
    console.error(`Check: ${error.message}`);
  if (live)
    console.log(JSON.stringify({ observedMethodsAndPaths: [...seen].sort() }));
  if (live) console.log(JSON.stringify({ navigationStatuses, callbackRouted }));
  console.log(
    JSON.stringify({ browserRuntimeErrorTypes: [...runtimeErrorNames] }),
  );
  if (!live && activePage)
    console.log(
      JSON.stringify({
        fixtureHeadings: await activePage.locator('h1,h2,h3').allTextContents(),
        fixtureAlertCount: await activePage.getByRole('alert').count(),
        dialogCount: await activePage.getByRole('dialog').count(),
        sidebarOpen: await activePage
          .locator('[data-mobile="true"][data-open]')
          .count(),
      }),
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
