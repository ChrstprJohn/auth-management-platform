# Operator API Reference

Status: health, operator sessions, user management, audit and recovery are implemented with isolated verification. Pinned local GoTrue/Mailpit recovery was verified separately with a disposable account. After user migration/callback setup, the local recovery gateway walkthrough passed against PostgreSQL, including restart persistence, concurrent single use and login/logout. Controlled local management verification passed, including creation, ban/unban, permanent deletion, audit/session persistence and two-instance last-operator protection. The management and recovery walkthroughs also passed after switching to admin_api_runtime; read-only metadata confirmed no superuser, role/database creation, RLS bypass or schema CREATE privileges. Production checks remain pending. Examples illustrate contracts; they are not captured production responses. This file is the source of truth for endpoint contracts and usage. [Backend architecture](backend-architecture.md#agreed-v1-decisions) owns internal session, audit, and provisioning policies.

## Connection and browser policy

The local API base URL is `http://localhost:3100`. The proposed production base URL is `https://admin-api.chrbuilds.dev`; it has not been deployed. GoTrue's local port 8081 is the upstream service, not this API.

Browser callers use credentials so the API can set/send its HttpOnly cookie.

Use a host-only cookie (no `Domain`), `HttpOnly`, `Path=/`, `SameSite=Lax`, and an expiry matching the session. Production uses `Secure` and the name `__Host-operator_session`; local HTTP uses `operator_session` without `Secure`.

Use exact configured frontend origins and credentialed CORS. Prefer a production frontend custom domain under `chrbuilds.dev` so frontend and API are same-site. A cross-site `vercel.app` frontend is not supported by this V1 cookie policy; configure the custom domain before production browser use.

For browser auth and management mutations, including login and logout, require a trusted `Origin` and the custom header `X-CSRF-Protection: 1`. Accept JSON bodies where a body is required; reject form submissions and unsupported content types. Enforce these checks on the API itself, not just in CORS configuration. The custom header requires a cross-origin browser preflight, which only exact allowed origins may pass. No separate CSRF-token service is needed for this policy. Recovery-link navigation needs its own purpose-bound flow, specified and tested before that module is implemented.

## Initial endpoint contracts

All responses use JSON except successful logout. Reject unknown login fields and validate email/password without logging them. Successful auth responses use `Cache-Control: no-store`. Common errors use `{ "error": { "code": "...", "message": "..." }, "requestId": "..." }` with safe messages.

| Method | Endpoint                   | Request                                                                     | Success                                                                                                                                     |
| ------ | -------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/health/live`             | No authentication                                                           | `200` with `{ "status": "ok" }`; no dependency checks                                                                                       |
| GET    | `/health/ready`            | No authentication                                                           | `200` with `{ "status": "ready" }` after bounded GoTrue and admin-database checks; `503` with `{ "status": "unavailable" }` if either fails |
| POST   | `/v1/operator/auth/login`  | JSON `{ "email": "...", "password": "..." }`, trusted Origin, CSRF header   | `200`, session cookie, and `{ "operator": { "id": "...", "email": "..." }, "expiresAt": "ISO-8601" }`                                       |
| GET    | `/v1/operator/auth/me`     | Operator cookie                                                             | `200` with the same safe operator/expiry shape                                                                                              |
| POST   | `/v1/operator/auth/logout` | Trusted Origin and CSRF header; current cookie if present; no body required | `204`, session invalidated and cookie cleared                                                                                               |

Use `400` for invalid input, `401` for invalid credentials or absent/invalid/expired sessions, `403` for a valid ordinary account or rejected browser-origin/CSRF policy, `429` for rate limits, and `503` for unavailable dependencies. Do not reveal eligibility in error messages. Health returns no credentials, connection strings, or internal error details. Readiness does not prove email delivery or a complete login flow. Safe upstream version information can be added to an operator-only health view later.

## User management and audit contracts (implemented; local walkthrough verified)

`GET /v1/operator/health` requires the same operator cookie/eligibility checks. It makes a bounded GoTrue health request and returns `200 {"status":"reachable","version":"v2.196.0"}` or `503 {"status":"unavailable","version":null}`. This safe version view has no mutations or audit effects, is safe to retry, and does not establish email/auth/database readiness. Authentication failures retain the common error envelope.

All routes below require an unexpired operator cookie, current allowlist eligibility and upstream identity validation. Mutations additionally require the same exact Origin/custom-header/JSON policy as login. Pagination accepts only `page` (integer 1–10000, default 1) and `perPage` (integer 1–100, default 20); unknown query/body fields are rejected. Account path IDs must be UUIDs. Search and arbitrary upstream payload forwarding are not supported.

| Method | Path                           | Input                                                                                                                     | Success                                                                                             |
| ------ | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| GET    | `/v1/operator/users`           | Pagination query                                                                                                          | 200 `{users, page, perPage, hasNextPage}`; a full page may have a next page, with no invented total |
| GET    | `/v1/operator/users/:id`       | UUID                                                                                                                      | 200 `{user}`; missing user returns 404                                                              |
| POST   | `/v1/operator/users`           | `{email,password,confirmation}` where confirmation is `require_verification` or `operator_confirmed`                      | 201 `{user,auditId}`                                                                                |
| POST   | `/v1/operator/users/:id/ban`   | `{durationHours,confirmation:"BAN_GLOBAL_USER",targetId}`; durationHours integer 1–8760 and targetId exactly matches path | 200 `{user,auditId}`                                                                                |
| POST   | `/v1/operator/users/:id/unban` | `{confirmation:"UNBAN_GLOBAL_USER",targetId}`                                                                             | 200 `{user,auditId}`                                                                                |
| DELETE | `/v1/operator/users/:id`       | `{confirmation:"DELETE_GLOBAL_USER_PERMANENTLY",targetId}`                                                                | 200 `{deleted:true,targetId,auditId}`                                                               |
| GET    | `/v1/operator/audit`           | Pagination query                                                                                                          | 200 `{entries,page,perPage,hasNextPage}`                                                            |

Create requires a valid email (max 254 characters), password 8–72 UTF-8 bytes, and an explicit confirmation choice. `operator_confirmed` bypasses email ownership verification. GoTrue admin creation sends no confirmation/invitation email; `require_verification` creates an unconfirmed account and does not promise a sent message. Resend/invitation is deferred. Ban duration is sent as bounded Go duration hours; unban uses `none`; deletion explicitly sends `should_soft_delete:false`. These shapes were checked against [pinned admin handlers](https://github.com/supabase/auth/blob/v2.196.0/internal/api/admin.go); the controlled local walkthrough verified both creation modes without invitation email, the supplied ban duration, unban and permanent deletion.

Safe user fields: `id`, `email` (nullable), `createdAt`, `emailConfirmedAt`, `lastSignInAt`, `bannedUntil` (nullable), and `isBanned` (nullable if data cannot establish status). Never return metadata, hashes, identities, factors or upstream tokens. Missing optional dates stay null rather than invented dates. A missing `banned_until` means no ban reported by the pinned upstream JSON model; malformed supplied dates fail response validation. Pagination is bounded offset pagination and may shift during concurrent changes.

Each validated authorized mutation creates a durable `pending` intent before checking business rules/calling upstream. Intent failure blocks the mutation. Completed records are `succeeded`/`failed`; transport, 5xx, invalid-success-response or crash outcomes remain `unknown`/`pending`. Completion failure returns 503 `AUDIT_COMPLETION_FAILED` with safe `outcome` (`succeeded`, `failed` or `unknown`) and `auditId`; the upstream action may already have applied. Ambiguous upstream mutation returns 503 `UPSTREAM_OUTCOME_UNKNOWN`; never automatically repeat a mutation. Duplicate creation returns 409 `USER_EXISTS`; last-operator protection returns 409 `LAST_USABLE_OPERATOR`; an unresolved destructive operator intent returns 409 `RECONCILIATION_REQUIRED`; another active destructive mutation returns 409 `MUTATION_IN_PROGRESS`. Failed validation/authentication does not create a management intent.

Ban/delete are serialized with an admin-database advisory lock held on a dedicated connection across the upstream call. Another configured operator counts as usable only with verified email, no current ban/deletion, and a current password-established dashboard session whose token is revalidated; an allowlist UUID or provider metadata alone is insufficient evidence of password usability. Have another operator sign in before removing the current operator. Missing evidence blocks removal; dependency errors fail closed. Pending/unknown destructive intents on configured operators block further operator removals until trusted manual reconciliation. All API instances must use the same database and allowlist. Out-of-band GoTrue/configuration changes remain outside this guarantee.

The local ban walkthrough rejected password login and an existing access token at the upstream user endpoint during the ban; unban restored login. Natural ban expiry remains unverified. Bans/deletion affect the shared global identity. They do not promise immediate revocation of every existing token across applications. No platform data is cascaded or reconciled; production deletion is disabled unless `ALLOW_GLOBAL_USER_DELETION=true` is explicitly configured after platform-reference reconciliation has been reviewed. Repeating a confirmed delete yields 404 with a failed audit attempt. Repeating ban/unban is a new recorded upstream request (ban duration restarts). Creation has no idempotency key; inspect unknown outcomes before retrying.

Audit entries contain UUID `id`, `actorId`, nullable `targetId`, action (`create`, `ban`, `unban`, `delete`), outcome, `createdAt`, nullable `completedAt`, and `requestId`. No email/password/token/raw payload is stored. History is retained indefinitely in V1 and read only by operators. Reconciliation is a trusted user-managed SQL update after supported GoTrue checks; no public reconciliation endpoint or automatic retry exists.

### Management usage after login

Use the preceding login/me/logout flow to preserve the HttpOnly cookie. The browser supplies Origin. The following helper applies the same credential/CSRF policy; every error response must be handled before using returned data:

```ts
async function operatorRequest(path: string, method = 'GET', body?: object) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    credentials: 'include',
    headers:
      method === 'GET'
        ? {}
        : {
            'Content-Type': 'application/json',
            'X-CSRF-Protection': '1',
          },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  if (!response.ok) throw result; // Include requestId/auditId in safe support reporting.
  return result;
}
const page = await operatorRequest('/v1/operator/users?page=1&perPage=20');
const created = await operatorRequest('/v1/operator/users', 'POST', {
  email: 'controlled-test@example.test',
  password: controlledTestPassword,
  confirmation: 'operator_confirmed', // Explicitly bypasses email ownership verification.
});
const targetId = created.user.id;
const details = await operatorRequest(`/v1/operator/users/${targetId}`);
// Obtain explicit human confirmation of global shared-account impact first.
const banned = await operatorRequest(
  `/v1/operator/users/${targetId}/ban`,
  'POST',
  {
    targetId,
    confirmation: 'BAN_GLOBAL_USER',
    durationHours: 24,
  },
);
const unbanned = await operatorRequest(
  `/v1/operator/users/${targetId}/unban`,
  'POST',
  {
    targetId,
    confirmation: 'UNBAN_GLOBAL_USER',
  },
);
// Requires ALLOW_GLOBAL_USER_DELETION=true; permanent global identity removal.
const deleted = await operatorRequest(
  `/v1/operator/users/${targetId}`,
  'DELETE',
  {
    targetId,
    confirmation: 'DELETE_GLOBAL_USER_PERMANENTLY',
  },
);
const history = await operatorRequest('/v1/operator/audit?page=1&perPage=20');
```

Representative safe details/create/ban/unban contract:

```json
{
  "user": {
    "id": "00000000-0000-4000-8000-000000000003",
    "email": "controlled-test@example.test",
    "createdAt": "2026-10-01T09:00:00Z",
    "emailConfirmedAt": "2026-10-01T09:00:00Z",
    "lastSignInAt": null,
    "bannedUntil": null,
    "isBanned": false
  },
  "auditId": "AUDIT_UUID"
}
```

Details omit `auditId`; list wraps the same user objects in `users` with pagination. Ban returns the supplied upstream ban expiry and current `isBanned`; unban returns its updated state. Delete returns `{ "deleted": true, "targetId": "TARGET_UUID", "auditId": "AUDIT_UUID" }`. Audit returns `{ "entries": [{ "id": "AUDIT_UUID", "actorId": "OPERATOR_UUID", "targetId": "TARGET_UUID", "action": "delete", "outcome": "succeeded", "createdAt": "ISO_TIMESTAMP", "completedAt": "ISO_TIMESTAMP", "requestId": "REQUEST_UUID" }], "page": 1, "perPage": 20, "hasNextPage": false }`. These are representative contracts, not live captures.

Known mutation failures include top-level `auditId`/`outcome` alongside the common error envelope. Partial/unknown example (`503`):

```json
{
  "error": {
    "code": "AUDIT_COMPLETION_FAILED",
    "message": "The upstream outcome could not be fully recorded. Do not automatically repeat the action."
  },
  "requestId": "REQUEST_UUID",
  "auditId": "AUDIT_UUID",
  "outcome": "succeeded"
}
```

Other management errors include `400 UPSTREAM_REJECTED`, `404 USER_NOT_FOUND`, `403 DELETION_DISABLED`, validation/content-type/body/auth/rate errors from the common policy, and safe `503 DEPENDENCY_UNAVAILABLE`. Readiness now checks sessions, audit and recovery tables. Migrations 0002/0003 and their runtime grants are required; follow the [database ledger](../../packages/database/admin/README.md).

## Usage flow (isolated and controlled local verification)

The following illustrates the implemented browser integration. Configure the API and its database first following [backend setup](../../apps/gotrue-admin-api/README.md). Use a controlled operator account and never hard-code real passwords in application source.

```ts
const apiBaseUrl = 'http://localhost:3100';

// email and password come from the sign-in form.
const login = await fetch(`${apiBaseUrl}/v1/operator/auth/login`, {
  method: 'POST',
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Protection': '1',
  },
  body: JSON.stringify({ email, password }),
});
if (!login.ok) throw new Error('Sign-in failed');
const operatorSession = await login.json();

const current = await fetch(`${apiBaseUrl}/v1/operator/auth/me`, {
  credentials: 'include',
});
if (!current.ok) throw new Error('Could not retrieve current operator');
const currentOperator = await current.json();

const logout = await fetch(`${apiBaseUrl}/v1/operator/auth/logout`, {
  method: 'POST',
  credentials: 'include',
  headers: { 'X-CSRF-Protection': '1' },
});
if (!logout.ok) throw new Error('Sign-out could not be confirmed');
// Successful logout is 204; there is no JSON body to parse.
```

The browser supplies `Origin`; do not attempt to set it in browser JavaScript. The cookie is HttpOnly and is not read by this code. Sessions expire within one hour, capped by upstream expiry. Sign in again after expiry; there is no refresh endpoint in V1. Logout affects the current dashboard session only.

Representative login/current-operator JSON (not a captured live response):

```json
{
  "operator": {
    "id": "00000000-0000-4000-8000-000000000001",
    "email": "operator@example.test"
  },
  "expiresAt": "2026-10-01T09:00:00.000Z"
}
```

### Validation, errors and side effects

Login requires exactly `email` (valid email, maximum 254 characters) and `password` (1–1024 characters, preserved without trimming). Body limit is 16 KiB. Unknown fields or invalid JSON return `400 INVALID_INPUT`; unsupported content type returns `415 UNSUPPORTED_MEDIA_TYPE`; oversized JSON returns `413 BODY_TOO_LARGE`. The API accepts only the host-only operator cookie for protected routes; bearer/project credentials cannot substitute.

Common codes: `401 AUTHENTICATION_REQUIRED`, `403 ACCESS_DENIED` (same safe message for rejected browser policy and operator authority), `429 RATE_LIMITED`, `503 DEPENDENCY_UNAVAILABLE`, `404 NOT_FOUND` for unregistered routes, and `500 INTERNAL_ERROR`. Every response includes `X-Request-ID`; errors include the same ID. Example:

```json
{
  "error": {
    "code": "AUTHENTICATION_REQUIRED",
    "message": "Sign in with valid credentials."
  },
  "requestId": "REQUEST_UUID"
}
```

General limit: 300 requests/IP/minute; login limit: 10 attempts/IP/15 minutes, including successful attempts. Limits are process-local and reset on restart; deploy one API instance for V1. `Retry-After` and standard rate-limit headers are returned on throttling. Preflights are handled before rate limits.

Login calls GoTrue's password grant and writes one admin session after checking verified-email/unbanned eligibility. It stores only a SHA-256 cookie hash and AES-256-GCM encrypted access token, discards the refresh token, and returns no credentials. Current-account performs an unexpired-session lookup, allowlist check and GoTrue identity validation each time. Neither operation writes management audit history. Logout deletes only the current local session, clears its cookie after successful storage deletion, and returns 204 without a body; no upstream/global logout is attempted. Missing/malformed cookies make logout idempotently succeed. A storage failure returns 503 without claiming invalidation or clearing the cookie.

All responses use `Cache-Control: no-store`. Health liveness touches no dependencies. Readiness checks GoTrue `/health` and the owned session, audit and recovery tables under configured timeouts, returning only ready/unavailable. Readiness does not apply schema or establish email/auth persistence behavior.

No upstream calls are automatically retried. Login may create an upstream session before local storage fails; it grants no dashboard session unless persistence succeeds. Repeating login starts a fresh attempt. GET and successful logout are safe to repeat; a failed logout must be retried to confirm local invalidation. Dependency outages fail closed.

Environment names, generation instructions and defaults are in [`.env.example`](../../apps/gotrue-admin-api/.env.example). Required manual SQL is [admin schema/migration setup](../../packages/database/admin/README.md); no SQL has been executed by the agent. Pinned password-grant and user-validation semantics were checked against [GoTrue v2.196.0 token handler](https://github.com/supabase/auth/blob/v2.196.0/internal/api/token.go) and [user handler](https://github.com/supabase/auth/blob/v2.196.0/internal/api/user.go). Controlled local operator login, ordinary-account rejection, eligibility removal, session restart persistence and logout have passed.

## Password recovery (implemented; isolated verification)

Controlled local boundary verification also passed for missing browser proof, mismatched state, arbitrary redirect fields, premature reset, callback replay, missing CSRF and untrusted Origin. The manual gateway probe's `--expiry` mode verifies persisted ready-context expiry after restart with a test-only two-second lifetime cap: rejected reset leaves the password and existing dashboard session unchanged. This does not change the configured policy or establish natural GoTrue OTP expiry.

Prerequisites: user-executed admin migration `0003_operator_recovery.sql` and runtime-table grants, the backend's `RECOVERY_CALLBACK_URL` in GoTrue's URI allowlist, and a reset-page URL using a configured frontend origin. See [setup instructions](../../apps/gotrue-admin-api/README.md#password-recovery-setup). Existing databases at 0002 execute only migration 0003; never replay full initialization. New production URL settings require explicit HTTPS same-site values. Readiness now checks the recovery table; it remains unavailable until setup is applied.

All POSTs require JSON, exact trusted Origin and `X-CSRF-Protection: 1`. No current operator session is required. Recovery never establishes one or grants eligibility. Body/query unknown fields are rejected. A supplied upstream token, verification type or redirect is not accepted. The common safe error envelope, request IDs and `Cache-Control: no-store` apply; request bodies, cookies and token-bearing URLs are omitted from API logs. Proxies and external logging must also avoid recording callback query strings.

| Method | Path                                  | Input and identity                                                                                                                        | Success                                                                                                                 |
| ------ | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| POST   | `/v1/operator/auth/forgot-password`   | `{email}`; valid email, max 254 characters; no session                                                                                    | 202 `{"message":"If the account can be recovered, a recovery email will be sent."}` and recovery cookie                 |
| GET    | `/v1/operator/auth/recovery/callback` | Exact `{code,state}` query; code UUID and 43-character base64url state; matching recovery cookie from the browser that requested recovery | 303 with fixed `Location: RECOVERY_RESET_URL` and shortened recovery-cookie expiry; no response body or upstream tokens |
| POST   | `/v1/operator/auth/reset-password`    | `{password}`; minimum 8 characters, maximum 72 UTF-8 bytes; ready unexpired recovery cookie                                               | 204; all local sessions invalidated, recovery and current operator cookies cleared; normal login required               |

Forgot-password is limited to 5 requests/IP/15 minutes; callback and reset each have 10 requests/IP/15 minutes. The global limiter still applies. These limits are process-local and reset on restart. Rate-limit failures return 429 and Retry-After. Invalid email/body/query/password returns 400 `INVALID_INPUT`; JSON media-type failures return 415; rejected Origin/CSRF returns 403. Missing, expired, mismatched, consumed or ineligible recovery returns generic 400 `INVALID_RECOVERY`. Storage failures and non-identity exchange outages return safe 503 responses. Expired/banned/missing upstream recovery identities cannot reset through this gateway.

Forgot-password creates a fresh browser state and server-only PKCE verifier for every valid email, regardless of account existence or operator status. Only the state/email hashes and encrypted verifier are stored; no email/password or refresh token is persisted. The callback URL is constructed solely from server configuration plus random state. The API sends a recovery request to GoTrue for all valid email inputs, including ordinary accounts, and returns the same 202 body/cookie policy even if GoTrue rejects delivery or is unavailable. Storage failure returns 503 before sending. This response is not delivery confirmation and does not authorize ordinary accounts. Upstream timing and mail receipt are outside the generic-response guarantee.

GoTrue's normal recovery email link goes to `/verify?type=recovery`; GoTrue verifies it and redirects with a PKCE authorization code and preserved state to our gateway. The gateway requires the same browser cookie, atomically claims the pending context, exchanges the code with the encrypted server-held verifier, validates identity/email binding and configured eligible-operator status, and stores only the encrypted recovery access token. A general login token or unrelated signup/magic-link code cannot substitute for this server-generated recovery flow. Callback navigation uses proof from the cookie/state/code rather than POST Origin/CSRF headers. Error redirects from GoTrue are rejected as invalid query input; request a fresh flow if needed. Callback success redirects to the fixed reset page with no token/code/state forwarded. `Referrer-Policy: no-referrer` protects the redirect. Pending contexts expire within one hour; ready contexts expire within ten minutes, capped by the initial context and upstream access-token expiry. GoTrue also enforces its own earlier link/code expiry.

Reset atomically claims the ready context and deletes all local sessions for its UUID in one admin transaction **before** the password mutation. It then revalidates the upstream identity and operator eligibility and sends only the new password to GoTrue. After confirmed success another transaction deletes local sessions again and removes identified recovery contexts. No management audit event is written for password recovery; GoTrue retains its own recovery/password-change history. Old dashboard sessions may be invalidated even when password reset later fails. A competing request cannot reuse a claimed context; a rejected upstream password also consumes it. Obtain a new recovery flow to correct the password; do not automatically retry the mutation.

Timeout/ambiguous update returns 503 `PASSWORD_RESET_OUTCOME_UNKNOWN`: password may have changed, so try ordinary sign-in or seek trusted assistance. Successful upstream update followed by failed local cleanup returns 503 `PASSWORD_RESET_COMPLETION_FAILED`: password changed, but cleanup could not be confirmed. Neither response claims rollback or invites repeating reset. Failed completion keeps its consumed context, even across restart. Read-only administrator reconciliation must establish current state before any deliberate corrective operation.

### Complete recovery usage

From the configured frontend origin, preserve cookies throughout:

```ts
const apiBaseUrl = 'http://localhost:3100';
const headers = {
  'Content-Type': 'application/json',
  'X-CSRF-Protection': '1',
};
const requested = await fetch(
  `${apiBaseUrl}/v1/operator/auth/forgot-password`,
  {
    method: 'POST',
    credentials: 'include',
    headers,
    body: JSON.stringify({ email: 'controlled-operator@example.test' }),
  },
);
if (requested.status !== 202) throw await requested.json();
// Open Mailpit's newest recovery email in this SAME browser.
// Follow its GoTrue link; the gateway exchanges the code and redirects
// to the configured /reset-password page without credentials in the URL.
const reset = await fetch(`${apiBaseUrl}/v1/operator/auth/reset-password`, {
  method: 'POST',
  credentials: 'include',
  headers,
  body: JSON.stringify({ password: newControlledPassword }),
});
if (reset.status !== 204) throw await reset.json();
// Now use the documented login -> me -> logout flow with the new password.
```

The frontend/reset page is not implemented; this example is an integration contract. For a backend-only manual walkthrough, a cookie-preserving client can request recovery with the same trusted Origin/header, follow the mail link and callback without following the final frontend redirect, then POST reset with that cookie jar. Do not put email links, codes, passwords or cookies into shell history or test logs.

Observed pinned upstream evidence: Mailpit recovery email, PKCE exchange/state preservation, code replay and invalid-link rejection, password update, old-password/old-access/old-refresh rejection and new-password login passed with a disposable local account. The recovery access token remained valid after update; the gateway discards it after cleanup and does not return it to the browser. Do not claim universal revocation across products or out-of-band resets. See pinned [recovery handler](https://github.com/supabase/auth/blob/v2.196.0/internal/api/recover.go), [PKCE handler](https://github.com/supabase/auth/blob/v2.196.0/internal/api/token.go), and [password update handler](https://github.com/supabase/auth/blob/v2.196.0/internal/api/user.go). After user migration/callback setup, the complete local gateway/PostgreSQL recovery probe passed, including persistence through gateway restart, one winner under concurrent reset, old-session invalidation and new-password login/logout. A real wait-until-link-expiry test remains pending; isolated tests cover local context expiry, replay and storage failures.

## Documentation required during implementation

Update this reference whenever endpoint behavior changes. The local upstream and recovery gateway probes establish only their recorded controlled flows. They do not establish complete V1 management/security verification, production delivery, or deployment.
