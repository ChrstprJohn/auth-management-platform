# Operator API Reference

Status: health/login/me/logout implemented and verified with isolated HTTP tests. Live PostgreSQL/GoTrue walkthrough is pending user setup; examples below describe implemented contracts, not captured live responses. This file is the source of truth for endpoint contracts and usage. [Backend architecture](backend-architecture.md#agreed-v1-decisions) owns internal session, audit, and provisioning policies.

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

User-management and audit endpoint payloads, pagination limits, and destructive confirmation contracts are documented before implementing those modules. They are not finalized by this initial auth contract.

## Usage flow (isolated contract verified; live verification pending)

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

All responses use `Cache-Control: no-store`. Health liveness touches no dependencies. Readiness checks GoTrue `/health` and the owned session table under configured timeouts, returning only ready/unavailable. Readiness does not apply schema or establish email/auth persistence behavior.

No upstream calls are automatically retried. Login may create an upstream session before local storage fails; it grants no dashboard session unless persistence succeeds. Repeating login starts a fresh attempt. GET and successful logout are safe to repeat; a failed logout must be retried to confirm local invalidation. Dependency outages fail closed.

Environment names, generation instructions and defaults are in [`.env.example`](../../apps/gotrue-admin-api/.env.example). Required manual SQL is [admin schema/migration setup](../../packages/database/admin/README.md); no SQL has been executed by the agent. Pinned password-grant and user-validation semantics were checked against [GoTrue v2.196.0 token handler](https://github.com/supabase/auth/blob/v2.196.0/internal/api/token.go) and [user handler](https://github.com/supabase/auth/blob/v2.196.0/internal/api/user.go). Live operator/login verification remains pending.

## Documentation required during implementation

Expand each route with verified fields/limits, headers, response/error examples, side effects, retry rules, and tests. Record admin migration/setup requirements and environment names when their implementation exists. Update this file whenever endpoint behavior changes. Recovery, user management, and history contracts will be added before coding their modules; their upstream semantics remain subject to pinned-version verification.
