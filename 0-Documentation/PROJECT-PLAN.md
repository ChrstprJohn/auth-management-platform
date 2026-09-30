# Auth Management Platform — main project plan

Updated September 30, 2026. This is the agreed direction and implementation roadmap, not a claim that every feature exists.

## Goal

Reuse one GoTrue authentication server across applications such as CRM and Dental. Keep shared identities while controlling project access separately. Provide one global administration dashboard and one reusable backend serving both application membership requests and protected administrative actions. Keep GoTrue unchanged.

## Architecture and responsibilities

| Component | Owns |
|---|---|
| GoTrue — shared authentication server | Signup, password hashing, login, access/refresh tokens, account confirmation/recovery, and protected auth administration. Uses `auth_db`. |
| Auth Management Platform backend | Verifies users, enforces dashboard/project permissions, manages projects and memberships, and eventually calls GoTrue admin APIs. Uses `dashboard_db`. |
| Global admin frontend (`frontend/`) | Operator login and screens for managing projects, users, memberships, and configuration. Calls the platform backend for administrative actions. |
| Individual project apps | Use GoTrue for authentication and platform APIs for enrollment/access checks. Their own backends enforce membership before returning protected project data. |

```text
Project apps ── signup/login/refresh ──► GoTrue
Project apps ── user token + enrollment/access request ──► Platform backend
Global admin dashboard ── user token + admin action ──► Platform backend
Platform backend ── verify user token (/user) ──► GoTrue
Platform backend ── project/admin permission checks ──► dashboard_db
Platform backend ── server-held admin token ──► GoTrue /admin/*
Project backends ── enforce verified project membership ──► protected app data
```

Another admin dashboard can reuse the same backend later. It receives no GoTrue operator credential; the backend applies the same permission checks regardless of the calling UI.

## Identity, membership, and administration

| Existing table | Purpose |
|---|---|
| `dashboard.projects` | Project identifiers, unique slugs, names, descriptions, and timestamps. |
| `dashboard.project_memberships` | A verified GoTrue user UUID linked to a project; currently modeled roles are `member` and `manager`. One user may have several memberships. |
| `dashboard.dashboard_admins` | GoTrue UUIDs allowed to perform global dashboard administration. Membership here does not grant GoTrue operator privileges. |

GoTrue owns passwords and identity records; do not duplicate password hashes in our database. References span separate databases, so account existence must be checked through GoTrue rather than a cross-database foreign key.

User metadata can label signup origin, but cannot authorize project access or grant roles. Dashboard admin permission and project membership are separate checks. A project manager is not automatically a global dashboard admin; define any manager-specific actions explicitly before exposing them.

## User flows

**Signup and enrollment:** The app calls GoTrue `/signup`. After confirmation/authentication as required, it sends the normal user's access token to a platform enrollment endpoint. The backend verifies identity and the project's enrollment policy, then inserts default membership. It must not trust a client-supplied user UUID or privileged role. Existing users can join another project without creating another account.

**Login and access:** The app calls GoTrue `/token?grant_type=password`, receives an access token, and calls the platform backend to check access to the requested project. The project's backend continues checking membership on protected API requests. A UI-only check is insufficient.

**Example:** A CRM member can authenticate from Dental using the same account, but Dental denies protected access until Dental membership is granted. This is shared identity with separate access, not separate passwords/accounts per application.

**Incomplete enrollment:** Signup and membership creation are separate operations. An account with no membership is allowed to exist but has no protected project access. Enrollment must support safe retry without duplicate memberships. Never delete a shared account merely because enrollment in one project failed.

**Admin action:** An operator logs in normally. The platform verifies the token, checks `dashboard_admins`, and performs the requested operation. For auth-user administration, it then calls GoTrue using the backend's privileged credential. That credential never goes to the frontend.

## Backend API groups

“Public” here means browser/application-facing, not unrestricted access to private data. See [platform-api.md](platform-api.md) for the authoritative implemented routes and payloads.

| Group | Features | Permission |
|---|---|---|
| Health — existing | `GET /health`, `GET /health/ready` | No token; readiness checks DB. |
| Application membership — implemented | Enroll, check own access/role, list own memberships | Valid user token; project enrollment policy for joining; only the verified user's records. |
| Project administration — implemented | Create/list/read projects; later update and archive/delete with defined effects | Valid token + global dashboard admin. Existing routes: `POST/GET /api/projects`, `GET /api/projects/:id`. |
| Membership administration — implemented | List project members, assign/remove membership, change permitted roles | Valid token + global dashboard admin initially. |
| GoTrue user administration — implemented | List/search/read accounts, create/update accounts, relevant recovery/confirmation operations, deliberate global deletion | Valid token + global dashboard admin; backend uses GoTrue operator credential. |
| Dashboard operator administration — implemented | Grant/revoke global admin access | Global admin only; bootstrap first admin through a trusted DB session; prevent accidental loss of all operators. |

Choose distinct routes/middleware for ordinary membership requests; do not place them behind the existing admin-only project router. Proposed names include `POST /api/projects/:id/enroll`, `GET /api/projects/:id/access`, and `GET /api/me/memberships`.

Enrollment policies must be explicit: open registration, invitation, or approval. Start with the policy needed by the first integrating app; invitations/approvals require additional storage and lifecycle handling. Rate-limit enrollment and administrative mutations, validate inputs, paginate lists, and record administrative changes as those features are added.

Removing a project membership revokes access to that project. Deleting a GoTrue account affects every project using that identity; make the difference explicit in API behavior and dashboard copy. Decide how to handle stale memberships when users are deleted outside the platform, and how project archival/deletion affects memberships and external app data.

## Global frontend layout and features

Keep the existing frontend as the global admin dashboard; individual project apps remain separate clients.

| Screen | Intended content |
|---|---|
| Login | Real GoTrue login/session refresh; check dashboard admin access; clear unauthorized/expired-session states. |
| Projects | Search/list projects, create project, open project; later edit/archive with defined rules. |
| Project overview | Project details, member counts, integration/access status. |
| Project users | Members scoped to this project, search/pagination, assign/remove membership and roles. |
| User details | GoTrue account details plus project memberships; distinguish account operations from membership operations. |
| Global users | Shared account search and administration across projects. |
| API/integration | Endpoint examples for signup/login/enrollment/access, required headers, and project identifiers; no operator secrets. |
| Project settings | Project details and enrollment policy; distinguish stored settings from GoTrue-wide configuration. |
| Global operators/audit | Admin grants/revocations and administrative event history. |

The frontend now connects login, projects, project members/settings, global accounts, operators, and audit screens to real services. Hardcoded projects/users/statistics and empty placeholder files were removed. It includes loading/error/empty states and typed API models. Sessions stay in memory, refresh through GoTrue, and end on logout or rejected authorization; reloading requires sign-in. Frontend route guards improve UX; backend authorization is authoritative.

## Deployment and credentials

- **Local:** GoTrue lives on the VM; the backend uses `GOTRUE_URL=https://auth.chrbuilds.dev`. Local PostgreSQL is `127.0.0.1:5433`, database `dashboard_db`. Local admin rows grant local platform access only.
- **VM later:** Deploy the backend on `app_network`, use GoTrue `http://gotrue:8081` and PostgreSQL `postgres:5432`, create a separate dashboard database/login, and apply Prisma migrations. Bootstrap VM dashboard admin rows separately. Keep containers private and expose intended API/frontend routes through HTTPS Caddy.
- **GoTrue environment:** Its `DATABASE_URL` points to `auth_db`; `GOTRUE_JWT_SECRET` is the signing secret in the documented setup. Verify live signing configuration and accepted `GOTRUE_JWT_ADMIN_ROLES` before generating an operator JWT.
- **Platform environment:** `DATABASE_URL`, `GOTRUE_URL`, and later `GOTRUE_ADMIN_TOKEN`. The latter is our backend variable for a generated privileged JWT, not a built-in GoTrue setting. Adding it alone does not implement admin integration. Plan token expiry/renewal.
- Configure allowed browser origins and auth redirects for each client. CORS does not replace authorization. Keep credentials out of Git, browser bundles, responses, and logs. Use a strong operator account password before production.

## Current state and work order

**Implemented foundation:** Uniform routes/controllers/services/repositories with a separate models directory; shared validation and GoTrue client; migrations; project CRUD and audit; open/closed enrollment and membership isolation; account CRUD/confirmation/disable/recovery; operator management with last-admin protection; CORS/body/request limits; and a frontend wired to these APIs. Both packages have format checks. Backend tests, frontend checks/build, and local fixture browser verification pass. Tests use local PostgreSQL and mocked GoTrue, not live account mutations.

**Remaining operational setup:** Configure and verify the privileged GoTrue JWT, email delivery, VM database/migrations/operator bootstrap, HTTPS and browser origins, and project-backend enforcement. This foundation does not deploy itself or automatically protect external app APIs.

**Future extensions:** Invitations/approval policies, archival, global server-side search (current UI searches the loaded page), scoped manager administration, distributed limits, and reconciliation of externally deleted accounts. Add these when required rather than introducing unused abstractions now.

**Done means:** Authorized users can enroll/access their permitted projects; unauthorized users cannot bypass API checks; global operators can administer through the dashboard; normal clients never receive privileged credentials; membership removal blocks project access; and the deployed setup has verified migrations, health, and recovery behavior.

See [detailed auth flow](dashboard-auth-flow.md), [backend setup](../backend/README.md), [database setup](../backend/DATABASE.md), and [repository architecture](../ARCHITECTURE.md).
