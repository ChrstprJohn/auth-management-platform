# Operator API Reference

Status: planned contract only. The backend is not implemented and these routes cannot be called yet. This file is the source of truth for endpoint contracts and usage. [Backend architecture](backend-architecture.md#agreed-v1-decisions) owns internal session, audit, and provisioning policies.

## Connection and browser policy

The planned local API base URL is `http://localhost:3100`. The proposed production base URL is `https://admin-api.chrbuilds.dev`; it has not been deployed. GoTrue's local port 8081 is the upstream service, not this API.

Browser callers use credentials so the API can set/send its HttpOnly cookie.

Use a host-only cookie (no `Domain`), `HttpOnly`, `Path=/`, `SameSite=Lax`, and an expiry matching the session. Production uses `Secure` and the name `__Host-operator_session`; local HTTP uses `operator_session` without `Secure`.

Use exact configured frontend origins and credentialed CORS. Prefer a production frontend custom domain under `chrbuilds.dev` so frontend and API are same-site. A cross-site `vercel.app` frontend is not supported by this V1 cookie policy; configure the custom domain before production browser use.

For browser auth and management mutations, including login and logout, require a trusted `Origin` and the custom header `X-CSRF-Protection: 1`. Accept JSON bodies where a body is required; reject form submissions and unsupported content types. Enforce these checks on the API itself, not just in CORS configuration. The custom header requires a cross-origin browser preflight, which only exact allowed origins may pass. No separate CSRF-token service is needed for this policy. Recovery-link navigation needs its own purpose-bound flow, specified and tested before that module is implemented.

## Initial endpoint contracts

All responses use JSON except successful logout. Reject unknown login fields and validate email/password without logging them. Successful auth responses use `Cache-Control: no-store`. Common errors use `{ "error": { "code": "...", "message": "..." }, "requestId": "..." }` with safe messages.

| Method | Endpoint | Request | Success |
|---|---|---|---|
| GET | `/health/live` | No authentication | `200` with `{ "status": "ok" }`; no dependency checks |
| GET | `/health/ready` | No authentication | `200` with `{ "status": "ready" }` after bounded GoTrue and admin-database checks; `503` with `{ "status": "unavailable" }` if either fails |
| POST | `/v1/operator/auth/login` | JSON `{ "email": "...", "password": "..." }`, trusted Origin, CSRF header | `200`, session cookie, and `{ "operator": { "id": "...", "email": "..." }, "expiresAt": "ISO-8601" }` |
| GET | `/v1/operator/auth/me` | Operator cookie | `200` with the same safe operator/expiry shape |
| POST | `/v1/operator/auth/logout` | Trusted Origin and CSRF header; current cookie if present; no body required | `204`, session invalidated and cookie cleared |

Use `400` for invalid input, `401` for invalid credentials or absent/invalid/expired sessions, `403` for a valid ordinary account or rejected browser-origin/CSRF policy, `429` for rate limits, and `503` for unavailable dependencies. Do not reveal eligibility in error messages. Health returns no credentials, connection strings, or internal error details. Readiness does not prove email delivery or a complete login flow. Safe upstream version information can be added to an operator-only health view later.

User-management and audit endpoint payloads, pagination limits, and destructive confirmation contracts are documented before implementing those modules. They are not finalized by this initial auth contract.

## Planned usage flow

The following illustrates the intended browser integration, not a verified working example. Run it only after the API exists and the frontend origin has been configured. Use a controlled operator account and never hard-code real passwords in application source.

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

Planned login/current-operator JSON:

```json
{
  "operator": {
    "id": "00000000-0000-4000-8000-000000000001",
    "email": "operator@example.test"
  },
  "expiresAt": "2026-10-01T09:00:00.000Z"
}
```

Exact error-code strings and input/rate limits must be specified during implementation and recorded here; common error shape and status meanings are defined above.

## Documentation required during implementation

Expand each route with verified fields/limits, headers, response/error examples, side effects, retry rules, and tests. Record admin migration/setup requirements and environment names when their implementation exists. Update this file whenever endpoint behavior changes. Recovery, user management, and history contracts will be added before coding their modules; their upstream semantics remain subject to pinned-version verification.
