# GoTrue Dashboard — Basic V1

Build first. Apps: `gotrue-admin-api` (Express/TypeScript on VM) and `gotrue-admin-web` (Vercel). See [shared architecture](../architecture-and-deployment.md).

## Purpose and authority

Give the platform operator a visual interface for the existing shared GoTrue. The browser calls the admin API; that backend calls GoTrue's private API. It does not manage developer projects or expose upstream admin credentials.

Operator login uses GoTrue identity plus a server-controlled allowlist of trusted user UUIDs. No public registration or client-editable role can grant operator access. Use a protected operator session, logout, and recovery through the supported auth flow. Provision the initial operator deliberately.

## Features

| Feature | Required behavior |
|---|---|
| Operator login/current account/logout | Authenticate identity and check operator eligibility on protected requests; logout invalidates the session |
| Password recovery | Deliver a working recovery message through the admin gateway and restrict redirects; never display reset tokens |
| Health | Show reachable/unreachable auth status and safe version information; distinguish service health from database/email readiness |
| User list | Paginated global users; email search supported through the adapter where available; loading, empty, and error states |
| User details | ID, email, verification state, creation time, available last login, and ban status; no password hashes or credential tokens |
| Create user | Validate email/password and confirmation policy, call supported GoTrue admin operation, and explain whether email is actually sent |
| Ban/unban | Explicit confirmation for ban; document existing-token behavior rather than claiming instant universal revocation |
| Delete user | Destructive confirmation and audit record; explain global impact and possible remaining application references |
| Action history | Record operator, target UUID, action, outcome, timestamp, request ID; simple operator-visible recent history |

Search must not imply searching only the currently displayed page. If the pinned upstream cannot support it, implement a bounded/documented approach or ship pagination without claiming global search.

Deletion is permanent identity administration, not project removal. While platform data exists, warn about developer workspaces and memberships; do not silently cascade into platform tables. Define reconciliation for deleted/banned identities before enabling deletion against production platform users.

## Backend and data

Use protected `/v1/operator/auth/*` and `/v1/operator/users` route groups plus minimal health. Define exact methods/payloads during implementation. Every user mutation rechecks operator authority; unrestricted GoTrue passthrough is not allowed.

GoTrue owns `auth_db`. Initially use server configuration for operator eligibility and a durable protected audit sink; no separate password database is needed. Share the server-only GoTrue adapter with the platform API. API secrets and configuration are separate per backend.

## Complete V1 means

An eligible operator logs in, browses users, inspects one, creates a test identity, bans/unbans it, and deletes it with recorded outcomes. Non-operators fail. Recovery and session expiry work. The Vercel UI operates against the deployed VM API without direct GoTrue access from its code.

## Deferred

Editing GoTrue environment settings, Docker/service controls, bulk import/export, advanced analytics, arbitrary credential inspection, and full session/device administration.

Use the [checklist](checklist.md) for delivery.
