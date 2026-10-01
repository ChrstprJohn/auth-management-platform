# Developer Auth Platform — Basic V1

Build after the GoTrue dashboard. Apps: `platform-api` (Express/TypeScript on VM) and `platform-web` (Vercel). See [shared architecture](../architecture-and-deployment.md).

## Purpose

A developer registers, creates a project, receives integration details, and adds email/password authentication to an application. Keep basic management plus a small working application-auth API; a dashboard without usable auth endpoints is not a complete v1.

## Features

| Area | Required behavior |
|---|---|
| Developer account | Signup, delivered verification/recovery, login, current account, logout, display-name editing |
| Workspace | One personal workspace from explicit verified onboarding; no team UI |
| Projects | Create/list/view; edit name, origins, redirects, open-signup policy; suspend/reactivate |
| Keys | Public integration key and scoped server key; show secret once, revoke, replace/rotate |
| Project members | Paginated list/details; suspend/restore/remove project access only |
| Application auth | Signup, login, explicit authenticated join, verification/recovery, current project user, refresh, logout |
| Backend integration | Project-bound opaque sessions and online server-key-authenticated validation |
| Documentation | Working TS quickstart including a protected customer backend route; safe errors/request IDs |

Projects are platform records, not GoTrue containers/databases. Workspace ownership protects every management request. Project admins cannot globally delete/ban users, reset their credentials, or enumerate the global pool.

## Shared-account flow

For a new email, GoTrue creates the global identity and the platform safely completes its membership. For an existing email, signup cannot replace its password or attach membership based on email alone. Authenticate, then explicitly join an open project using short-lived identity proof. Closed projects reject public joining; invitation workflows are deferred.

The same email/password works across projects. Verification and recovery are global. Developer onboarding is explicit: a customer signup does not automatically grant a workspace. Reconcile identity/profile/membership creation idempotently across the separate databases.

## Sessions and callbacks

Do not use raw GoTrue JWTs as proof of project access. Issue opaque project credentials after active membership checks. Store hashes, expiry, purpose, project, user, and revocation state; encrypt upstream tokens. Rotate refresh atomically and keep its original project binding.

Validation checks session, project, membership, expiry, and revocation. Removing/suspending membership invalidates project access without changing other memberships. Console sessions have management purpose and cannot be replaced by customer credentials. Document global password-change/revocation effects.

Verification/recovery callbacks enter public platform routes with expiring trusted flow context, authenticated identity checks, and registered destinations. A project ID in a redirect alone does not authorize membership.

## Data and API

`platform_db`: developer profiles, workspaces/ownership, projects/settings, memberships, API keys, platform sessions, auth-flow context, and minimal audit records. No copied password hashes; migrations never alter GoTrue's schema.

Route groups: `/v1/platform/auth/*`, `/v1/platform/profile`, `/v1/projects`, project `/settings`, `/keys`, `/users`, and `/auth/{signup,login,join,user,refresh,logout,verify,recover,validate}`. Define methods and payloads during implementation. Validation requires a project server key; public auth flows use a publishable key plus credentials/proof and policy. Public keys/CORS are not trusted caller authentication.

## Complete V1 means

A developer verifies/logs in, creates two projects, integrates the guide, and manages project memberships. A customer joins both using one global identity, receives separate project sessions, and accesses a protected customer backend route. Project-A credentials fail in B; removing access in A leaves B usable. Email, refresh/logout, ownership checks, and restore verification pass before an external pilot.

## Deferred

OAuth/social login and OAuth authorization-server functionality, MFA/passkeys, teams/invitations, billing, analytics, hosted forms, full SDKs, webhooks, imports, custom domains/environments, and offline JWT validation. Independent project passwords/providers are outside the shared-pool contract.

Use the [checklist](checklist.md) for delivery.
