# Build Scope: GoTrue Dashboard, Then Platform V1

Status: planned work, October 1, 2026. Architecture and folder/deployment details are maintained in their [own guide](deployment-layout.md).

## Phase 1 — GoTrue management dashboard

Build `gotrue-admin-api` and `gotrue-admin-web` first. This is an operator tool for managing the existing shared auth service, not the developer-facing platform.

Initial features:

- Operator login/current account/logout using GoTrue identity plus explicit operator eligibility.
- Auth service health status.
- Paginated user list and user details with safe identity/verification fields.
- Basic global user management: create a user, ban/unban, and delete through supported GoTrue admin operations.
- Confirmation for destructive actions and operator audit records.

The frontend talks only to the admin API. Never return upstream admin credentials or unrestricted internal errors. Global management affects all projects using an identity; explain that effect before destructive actions. Arbitrary GoTrue environment editing, deployment controls, and password-hash inspection are outside scope.

First milestone: an authorized operator logs in, sees users, opens details, and completes an audited management action through Express. Unauthorized identities cannot use those routes.

## Phase 2 — Basic developer platform V1

Build `platform-api` and `platform-web` after the operator dashboard works. Keep v1 useful by completing a small application-auth slice as well as account/project management.

### Developer authentication

Email/password registration, verification, login, current account, logout, recovery, and editable display name. Use the same GoTrue identity pool. Explicit verified onboarding creates one personal workspace; team invitations are deferred.

Identity creation and platform onboarding are separate database operations. Retry/reconcile safely without duplicate profiles/workspaces or premature permissions.

### Basic management

Create/list projects; show ID, status, API URL, and examples. Edit name, allowed origins/redirects, and open-signup policy. Suspend/reactivate projects. Generate/revoke publishable and scoped server keys, showing new server secrets once. List project members; suspend/restore/remove their memberships without global identity mutation.

Project creation writes platform records, not new auth infrastructure. One developer cannot see/manage another workspace. Publishable keys are public and cannot prove the caller is trusted.

### Minimum application auth

Project signup/login, explicit authenticated join for existing identities, verification/recovery, current project user, refresh, logout, and online session validation.

For a new email, create the global identity and reconcile its project membership. For an existing email, never overwrite its password or attach membership based on email alone: authenticate and explicitly join an open project. Closed projects do not permit public joining; invitations are later work. Use safe responses to limit enumeration.

Issue project-scoped credentials only after active membership checks. Global password recovery is not a project-local reset. Document effects on other sessions and test the pinned upstream behavior.

Deliver a TypeScript quickstart showing integration and a protected customer backend route. The developer owns application business data and authorization beyond project access.

## Platform data and route groups

Minimum platform entities: developer profiles, personal workspaces/ownership, projects/settings, project memberships, API keys, platform sessions, expiring auth-flow context, and basic audit events. Optional profile/analytics/billing tables wait.

| Backend | Proposed route group | Authority |
|---|---|---|
| Admin API | `/v1/operator/auth/*` | Identity plus explicit operator eligibility |
| Admin API | `/v1/operator/users`, `/health` | User operations require operator session; public health reveals minimal status only |
| Platform API | `/v1/platform/auth/*`, `/profile` | Explicit onboarding / developer console session |
| Platform API | `/v1/projects`, project `/settings`, `/keys`, `/users` | Workspace ownership |
| Platform API | Project `/auth/signup`, `/login`, `/join` | Public key, credentials/proof, project policy, limits |
| Platform API | Project `/auth/user`, `/refresh`, `/logout` | Correct project session/refresh credential |
| Platform API | Project `/auth/verify`, `/recover` | Validated callback flow / recovery policy |
| Platform API | Project `/auth/validate` | Scoped server key plus customer access credential |

Define exact methods/payloads during implementation. Use pagination and safe error codes/request IDs. Do not proxy unrestricted GoTrue admin endpoints through the platform API.

## Release requirements

Real verification/recovery delivery, tamper-resistant callback context, registered redirects, rate limits, secret redaction, ownership/project/session boundaries, refresh race handling, controlled upstream failures, audit records, and tested backup/restore remain required despite the small feature scope.

Before making GoTrue private, migrate existing clients and public callback flows. The admin dashboard alone is insufficient to remove the direct route.

## Deferred

Social OAuth, OAuth authorization-server functionality, MFA/passkeys, phone/magic links, teams/invitations, billing, advanced analytics, hosted forms, full SDKs, custom domains/environments, webhooks, bulk imports, infrastructure provisioning, and offline JWT validation. Independent per-project passwords/provider settings are outside the shared-pool contract.

Track delivery in the [checklist](initial-feature-checklist.md).
