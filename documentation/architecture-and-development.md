# Architecture and Local Development

## One shared identity pool

Both APIs call the same GoTrue instance. GoTrue authenticates platform operators, developers, and customer users. There is no GoTrue container/database per project or developer.

The same email uses one global identity and password across projects. Verification, password changes, recovery, and provider configuration are global. Membership and access can differ by project. Do not promise independent passwords or providers per project.

## Database ownership

| Store | Owner and contents |
|---|---|
| `auth_db` | GoTrue: identities, emails, password hashes, verification, upstream auth sessions |
| `platform_db` | Platform API: developer profiles, workspaces, projects, memberships, keys, scoped platform sessions, flow context, audit records |
| Admin API configuration/audit store | Server-controlled operator eligibility and operator action records; no separate password database |

Both databases may live on the same PostgreSQL server. Platform records reference the GoTrue UUID without copying passwords or relying on a cross-database foreign key. GoTrue manages its own migrations; platform migrations touch only `platform_db`.

The admin API initially uses a server-controlled operator allowlist and a protected audit sink. Add an operator database only if needed; do not give it unrestricted write access to platform membership tables. Each API has separate runtime credentials.

## Permission boundaries

| Caller | Authority |
|---|---|
| Platform operator | Global GoTrue administration through the admin API |
| Developer | Their workspace/projects and project membership management through the platform API |
| Project server key | Only documented scopes within its project |
| Customer | Application access through an active project membership/session |

A GoTrue account is identity, not permission. Operator access requires explicit server-controlled eligibility; normal registration cannot grant it. Developer onboarding explicitly creates the personal workspace. Neither API trusts browser-supplied roles, user IDs, or editable GoTrue metadata as authorization.

Developer suspension/removal acts on project membership only. Global identity bans/deletion belong to the operator API and can affect every project and developer workspace. Confirm destructive operator actions and record them in an audit trail.

## Project session design

A raw GoTrue JWT proves global identity, not project access. The platform API checks membership/project status and returns opaque project-bound access/refresh credentials. Store their hashes, context, expiry, and revocation state in `platform_db`; encrypt recoverable upstream tokens with a key outside the database.

Customer backends call a server-key-authenticated online validation endpoint. It checks the access credential, project, membership, expiry, and revocation. Credentials from project A fail in B even when the same identity belongs to both. Rotate refresh atomically and bind it to the original project. Offline JWT/JWKS validation is deferred.

Operator, developer-console, and customer sessions have distinct purposes and validation rules. A session issued for one purpose cannot authorize another. Console cookies should be HttpOnly/Secure with appropriate CSRF controls. Upstream admin/signing secrets remain server-only.

## Local development

Run one local GoTrue, local PostgreSQL with `auth_db` and `platform_db`, and a capture mailbox. Run the two APIs/frontends locally as their phases begin; use different host ports for the APIs, for example admin `3100` and platform `3200`. Host ports need to differ locally even though deployed containers can both use internal `3000`.

Each API gets a local `GOTRUE_INTERNAL_URL`. The platform API also gets its restricted `PLATFORM_DATABASE_URL` and session encryption key. The admin API gets private upstream admin credentials and operator eligibility configuration. These are proposed platform variables, not GoTrue variable names.

Host processes connect through local host ports; containers connect through Docker service names. `localhost` inside a container refers to that container. Keep local secrets/data separate from production. Local data does not synchronize automatically to the VM.

Follow the supplied Windows Node rules: foreground dev/build/watch processes, clean termination, and orphan-worker checks after dev sessions.

## Vercel-to-VM browser requests

Frontends call public HTTPS API URLs, not Docker addresses. Configure exact trusted origins and cookie/credentials behavior per frontend/API. `vercel.app` and `chrbuilds.dev` are cross-site; test browser cookie restrictions. Prefer production frontend custom domains under `chrbuilds.dev`, still with explicit origin checks. Preview deployments must not gain privileged production admin access by a broad origin wildcard.

See [deployment layout](deployment-layout.md) for routing and [V1 scope](auth-platform-spec.md) for features.
