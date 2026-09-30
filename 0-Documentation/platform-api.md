# Auth Management Platform API

This is the reference for implemented backend routes. GoTrue's authentication routes are documented separately in [gotrue-routes.md](gotrue-routes.md). All IDs below are UUIDs; project slugs are display/integration labels, not substitutes for UUID route parameters.

## Setup and permissions

Local API: `http://127.0.0.1:3000/api`. The Vite frontend proxies `/api` to it. Health routes are outside `/api`. Configure the backend's `.env` from `backend/.env.example`, apply migrations with `pnpm db:deploy`, and start with `pnpm dev`. Stop foreground servers with Ctrl+C.

| Credential/configuration | Purpose |
|---|---|
| `DATABASE_URL` | Dashboard PostgreSQL connection; never the GoTrue auth database. |
| `GOTRUE_URL` | Trusted GoTrue URL; local `https://auth.chrbuilds.dev`, VM private network `http://gotrue:8081`. |
| `GOTRUE_ADMIN_TOKEN` | Backend-only privileged JWT for account administration and validating user IDs during membership/operator grants. Missing/invalid credentials fail closed with 503. Not needed for ordinary enrollment/access checks or project CRUD. |
| `ALLOWED_ORIGINS` | Comma-separated browser origins for cross-origin clients. Same-origin Vite proxy requests need no CORS permission. |
| `TRUST_PROXY` | Default `0`; use `1` only for a private API behind exactly one trusted Caddy proxy. |

Authenticate through GoTrue `/token?grant_type=password`, then send **the normal user access token** to platform routes:

```http
Authorization: Bearer <user_access_token>
Content-Type: application/json
```

- **User:** GoTrue-verified identity, using `/user` with a five-second timeout.
- **Admin:** verified identity plus a matching `dashboard.dashboard_admins` row. It does not mean the caller has a GoTrue operator token.
- **Operator credential:** stored only on our backend. The browser must never send or receive it.

Bootstrap the first dashboard admin through a trusted SQL session in `dashboard_db`, as described in [dashboard-auth-flow.md](dashboard-auth-flow.md). Local grants do not automatically populate VM tables.

## Route catalog

Responses use `{ "data": ... }` unless noted. Successful deletions return **204 with no body**. Lists return only the current page.

| Method | Path | Permission | Input/result |
|---|---|---|---|
| GET | `/health` | None | Process liveness; `{status, service}`. |
| GET | `/health/ready` | None | DB readiness; 200 or 503. |
| GET | `/api/me` | User | Verified `{id, isAdmin}`. |
| GET | `/api/me/memberships` | User | Own memberships with project details; no client-supplied user ID. |
| GET | `/api/projects/:projectId/access` | User | `{projectId, allowed, role}`. Nonmember gets 200 with `allowed:false`, not project permission. |
| POST | `/api/projects/:projectId/enroll` | User + enrollment policy | Empty body or `{}` only. Open projects assign `member`; existing membership is returned without changing its role. Closed projects deny new enrollment. |
| GET | `/api/projects` | Admin | `limit=20` (1–100), optional `cursor=<UUID>`; `{data, nextCursor}` ordered newest first. |
| POST | `/api/projects` | Admin | `{slug, name, description?, enrollmentPolicy?}`; 201 + Location header. Policy defaults to `closed`. |
| GET | `/api/projects/:id` | Admin | Project details and `_count.memberships`. |
| PATCH | `/api/projects/:id` | Admin | Nonempty subset of `slug`, `name`, `description`, `enrollmentPolicy`; preserves other fields. |
| DELETE | `/api/projects/:id` | Admin | Deletes project and memberships through cascade; does not delete shared accounts or external application data. |
| GET | `/api/projects/:projectId/members` | Admin | `page=1`, `limit=20`; memberships with safe GoTrue account details, or `user:null` when an account is missing. Requires configured GoTrue operator credential for nonempty results. |
| PUT | `/api/projects/:projectId/members/:userId` | Admin | `{role:"member"}` or `{role:"manager"}`; defaults to member. Validates GoTrue user existence; creates/updates membership. |
| DELETE | `/api/projects/:projectId/members/:userId` | Admin | Removes membership in this project only. |
| GET | `/api/users` | Admin | `page=1`, `limit=20`; safe shared GoTrue accounts. |
| POST | `/api/users` | Admin | `{email, password, email_confirm?, disabled?}`; creates a shared account, not membership; 201. |
| GET | `/api/users/:id` | Admin | Safe account details plus dashboard memberships/project details. |
| PATCH | `/api/users/:id` | Admin | Nonempty subset of `email`, `password`, `email_confirm`, `disabled`. No arbitrary roles or metadata. |
| POST | `/api/users/:id/recovery` | Admin | Requests recovery email for that account; delivery requires working GoTrue mail configuration. |
| DELETE | `/api/users/:id` | Admin | Body `{confirmUserId:"<same UUID>"}` required. Deletes the shared auth account and local memberships across projects. |
| GET | `/api/operators` | Admin | `page=1`, `limit=20`; dashboard admin UUIDs and timestamps. |
| PUT | `/api/operators/:id` | Admin | Grants dashboard admin permission to an existing GoTrue user; repeat-safe. |
| DELETE | `/api/operators/:id` | Admin | Revokes dashboard permission; refuses to remove the last admin. |
| GET | `/api/audit` | Admin | `page=1`, `limit=20`; newest recorded audit events first. |

Numbered lists use page/limit bounds (page 1–100000, limit 1–100) and return `{data, page, hasMore}`. Project lists use cursor pagination instead. The frontend's search filters the loaded account/member page; global server-side search is not implemented.

Project validation: slug 1–63 lowercase letters/numbers separated by single hyphens; trimmed name 1–120 characters; description at most 500 characters; policy `open` or `closed`. Account passwords created/changed by the platform must be 12–128 characters; GoTrue may enforce additional configured requirements. `disabled:true` sets an account ban; `false` removes it. Deletion/disabling of a dashboard admin account is rejected until its dashboard permission is revoked.

## Examples

Use one helper for your client; `base` must be the platform's API URL, not GoTrue's URL. Never print tokens or place them in query strings.

```js
async function platform(path, method = 'GET', body) {
  const response = await fetch(base + path, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  if (response.status === 204) return
  const result = await response.json()
  if (!response.ok) throw new Error(result.error.message)
  return result
}
```

### Admin: create a project and assign a verified account

```js
const { data: project } = await platform('/projects', 'POST', {
  slug: 'crm', name: 'CRM', enrollmentPolicy: 'closed',
})
await platform(`/projects/${project.id}/members/${userId}`, 'PUT', { role: 'member' })
```

### Application user: enroll and check access

```js
// Use this user's normal GoTrue token; open enrollment is required for new members.
await platform(`/projects/${projectId}/enroll`, 'POST', {})
const { data: access } = await platform(`/projects/${projectId}/access`)
if (!access.allowed) throw new Error('Project access has not been granted')
```

The application backend must perform the membership check before returning protected data, using the user's token and a server-configured project UUID. A browser redirect or local UI check is insufficient. If verification is unavailable, deny protected access rather than assuming permission. Do not trust project UUIDs supplied by callers to select an arbitrary authorization scope.

### Admin: remove membership versus delete shared identity

```js
await platform(`/projects/${projectId}/members/${userId}`, 'DELETE') // One project
await platform(`/users/${userId}`, 'DELETE', { confirmUserId: userId }) // Every project
```

## Errors, failure handling, and audit

```json
{ "error": { "code": "forbidden", "message": "Dashboard administrator access is required" } }
```

| Status | Meaning |
|---|---|
| 400 | Invalid UUID, input, pagination, JSON, role, or missing delete confirmation. |
| 401 | Missing/malformed or rejected user token. Sign in or refresh through GoTrue. |
| 403 | Missing dashboard permission, closed enrollment, or rejected browser preflight origin. |
| 404 | Missing project/member/operator/account or route. |
| 409 | Duplicate record, last-admin safeguard, or account still has dashboard admin permission. |
| 413 | JSON body exceeds 32 KiB. |
| 422 | GoTrue rejects an administrative input. |
| 429 | API request limit exceeded; use Retry-After when supplied. |
| 503 | Authentication/admin configuration or upstream service unavailable, or readiness failure. |
| 500 | Unexpected database/server failure. |

The API sets no-store and nosniff headers. Its in-memory limit is 300 API requests per minute per observed IP per process. Configure proxy trust carefully; otherwise callers behind a proxy share its IP. A multi-instance deployment needs shared gateway limits. OPTIONS requests are handled before authentication and limiting.

Project/membership/operator database changes and their audit records share transactions. Events include actor UUID, action, target UUID, timestamp, and event UUID. GoTrue mutations and dashboard writes are separate systems: they are not a distributed transaction. If an upstream mutation succeeds but the local write/response fails, inspect current state before retrying creation. Account deletion tolerates upstream 404 on retry so stale memberships can still be cleaned up. Direct SQL or calls outside this platform are not in its audit log.

Never delete a shared account just because enrollment failed. Open enrollment retries preserve existing roles and avoid duplicate memberships. Closing a project's enrollment does not remove existing members. Revoke membership explicitly to remove access.

## Verification and remaining deployment work

- `pnpm test`: mocked GoTrue/database authorization and admin boundary tests, last-operator guard, HTTP/CORS/body/limit handling.
- `pnpm test:integration`: local PostgreSQL project CRUD/audit and membership policy/isolation/retry tests; GoTrue is mocked and temporary rows are cleaned up.
- Frontend: `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm format:check`.
- Both packages have `format`/`format:check`. Source follows routes → controllers → services → repositories, with domain data types in `backend/src/models/`, shared validation/middleware, and a dedicated GoTrue integration client. Prisma schema/migrations stay under `backend/prisma/`.

Implemented and locally verified does not mean deployed. Still required for real VM use: configure/generate a privileged backend JWT, verify live GoTrue admin acceptance/rejection, configure mail delivery, apply dashboard migrations on the VM, bootstrap VM operators, choose HTTPS/frontend/API routing and allowed origins, and integrate membership enforcement in each project backend. No VM accounts were mutated by the implementation test suite.

Future extensions rather than current features: invite/approval enrollment policies, project archival, server-side global search, scoped project-manager administration, shared distributed limits, and automated reconciliation of accounts deleted outside the platform. Current policies are deliberately only open/closed; current administrative routes require global dashboard admin permission.

## Dashboard account creation

Global **Accounts → Create account** creates a shared GoTrue identity without project membership. A project's **Users → Create account** creates the identity through `POST /api/users`, then assigns it to that project with `PUT /api/projects/:projectId/members/:userId` and member role. Administrative assignment works with both open and closed enrollment. Both calls use the dashboard administrator's normal access token; the privileged GoTrue credential stays on the backend.

Creation and assignment are separate operations. If assignment fails after the account is created, the dialog keeps the returned user UUID and offers **Retry assignment** without repeating creation. Closing and reopening the dialog preserves that pending assignment during the current page session. After leaving or reloading the page, find the account in Global Accounts and use **Assign existing account**. After an interrupted creation response, check for the account before trying creation again.

The email-confirmed toggle is an explicit administrative choice. Turning it off can leave the identity pending confirmation, depending on GoTrue configuration. It does not send a confirmation email itself. The project API page provides copyable **Individual calls**, **Combined flows**, and **Admin creation** examples using the current project UUID. External applications must still enforce membership in their own backend on protected requests.
