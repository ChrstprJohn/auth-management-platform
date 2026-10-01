# Authentication Platform — Product and Architecture Spec

Status: proposed MVP, October 1, 2026. This is a planning document; no VM configuration has been changed.

## 1. Product vision

Developers create an account, create a project, configure authentication, and integrate one public API into their application. The platform handles passwords, users, sessions, email verification, and recovery through private GoTrue services.

The developer still owns their application's database, business logic, and authorization: what a signed-in user can read or change. This platform supplies identity and authentication; it does not automatically provide the customer's whole application backend.

Example: a developer creates a “Shop” project. Their customers register through the platform API. The Shop backend verifies the resulting project access token and stores orders against its user ID. Another developer's “School” project has separate users, credentials, settings, and sessions—even when a person uses the same email in both.

## 2. Existing infrastructure

Based on `vm_infrastructure/5-auth-server.md` and `vm_infrastructure/vm-infrastructure-reference-updated.md`:

- Azure Ubuntu VM with Caddy handling public HTTPS.
- Private Docker services using external `app_network`.
- Existing `gotrue:8081`, image `supabase/gotrue:v2.196.0`.
- PostgreSQL `postgres:5432`, GoTrue database `auth_db`, schema `auth`.
- Current public route: `auth.chrbuilds.dev` directly proxies GoTrue.
- Current JWT configuration uses a private symmetric secret and a one-hour lifetime.
- Email delivery is deferred; the documented startup used a Noop mail client.

These are documented facts, not a fresh VM inspection. An attempted public health request from this workspace was blocked by local network permissions. Existing customer integrations and VM capacity must be inventoried before migration.

## 3. Recommended architecture

```text
Developer dashboard                 Customer frontend / backend
         |                                      |
         +---------------- HTTPS ---------------+
                              |
                            Caddy
                              |
                 Platform API: TypeScript + Express
                 |                            |
          Management operations         Project auth gateway
                 |                            |
       platform_db in PostgreSQL       private GoTrue for project
                                              |
                                       project auth database

Provisioning worker -> creates/configures private project resources
Email provider      -> sends confirmation and recovery messages
```

Start with one modular API application plus a separate provisioning worker. Management routes handle developers and projects; runtime routes handle customer users and sessions. They can become separate services later when load or security boundaries justify it.

Proposed public hosts, subject to DNS availability:

- `console.chrbuilds.dev`: developer dashboard.
- `identity.chrbuilds.dev`: platform API and public auth callbacks.
- Customer applications communicate with this API, never Docker addresses.

The gateway resolves a project to a provisioned upstream from trusted platform records. A client cannot supply an upstream URL, GoTrue secret, or database name.

## 4. Project isolation: the foundational decision

### Recommended: one private GoTrue deployment per project environment

Each project environment gets:

- A separate GoTrue container and configuration.
- A separate PostgreSQL database and restricted database role on the existing PostgreSQL server initially.
- Independent signing material, users, sessions, providers, email settings, and redirect configuration.
- No public GoTrue port or direct Caddy route.

This gives independent identity pools and allows the same email to have unrelated credentials in different projects. Databases share a server, so this is logical isolation; the VM and PostgreSQL remain shared failure and resource boundaries.

Start with one environment per pilot project. Add separate development and production environments later using the same provisioning model. Cap pilot project count based on measured memory, CPU, connections, and disk use. Do not promise unlimited projects on this VM.

### Why a project ID on the existing instance is insufficient

A gateway can scope routes, but one shared GoTrue pool still shares identities and much of its configuration. A membership table does not create independent passwords or provider configuration. Client-editable user metadata is also unsuitable for enforcing project ownership.

Supabase Auth explicitly lists inherited multi-tenancy through `instances` / `GOTRUE_MULTI_INSTANCE_MODE` as unsupported. Do not build the service on that mechanism.

A shared pool is an alternative only if the intended product is deliberately one global identity used across applications. That would be a different product contract.

### Reuse of the existing GoTrue

Use the current instance for developer dashboard identities only if existing use allows it. Otherwise provision a dedicated platform identity instance. Keep developer identities separate from customer project users. Do not convert the existing pool into a customer project without inventorying current consumers and data.

## 5. Main user journeys

### Developer onboarding

1. Developer registers and verifies their email.
2. Platform creates a workspace and assigns the developer as owner.
3. Developer creates a project with a name and initial allowed application URLs.
4. Project enters `provisioning`; a worker creates its auth resources.
5. Health and isolation checks pass; project becomes `active`.
6. Dashboard shows project ID, API base URL, publishable key, integration examples, and a server secret shown once when generated.

Project lifecycle: `provisioning -> active`, with `failed` plus safe retry, `suspended`, and `deleting -> deleted`. Provisioning must be idempotent and reconcile partial resource creation. Failed projects must never accept runtime traffic.

### Customer signup and login

1. Customer app calls the project's signup or login route with its publishable key.
2. API checks project status, signup policy, request limits, and input.
3. API calls that project's private GoTrue.
4. API returns a stable platform user/session response.
5. Customer app sends the access token to its own backend.
6. Customer backend verifies the token for its configured project and authorizes access to application data.

Browser CORS improves browser integration but is not authentication or abuse protection. A publishable key is public and cannot prove that a request comes from the intended application.

### Developer manages users

Developer signs into the console, selects a project, searches its users, inspects safe profile/session information, and performs permitted admin actions. Every management request checks workspace membership and role before accessing the project's GoTrue admin API.

### Verification and recovery

Messages link to a public gateway callback bound to the correct project and verification flow. The gateway calls the private upstream and permits only registered redirects. Sensitive callback URLs must be excluded from logs. Recovery establishes a restricted password-change journey before normal application use.

Email delivery is a launch requirement for a public service. A Noop mailer cannot support reliable verification or recovery. Begin with one platform-managed email provider; n8n can support later workflows but should not be a required dependency for basic login.

## 6. Feature scope

| Area | MVP | Later |
|---|---|---|
| Developer accounts | Register, verify, login, logout, recover | MFA, enterprise SSO |
| Workspaces | Automatic owner workspace, ownership checks | Team invitations and expanded roles |
| Projects | Create, provision, status, settings, suspend | Multiple environments, custom domains |
| Customer authentication | Email/password, verification, recovery | OAuth, magic links, phone, MFA, passkeys |
| Sessions | Refresh rotation, logout, current user | Session/device dashboard |
| User management | List/search, inspect, suspend, delete | Imports, exports, bulk operations |
| Integration | REST documentation, TS examples, token validation guide | Small SDKs and framework adapters |
| Credentials | Publishable/server keys, revoke and rotate | Granular scopes and automated rotation |
| Operations | Health, limits, audit events, backup/restore | Usage billing, richer analytics, regions |
| Events | Durable internal audit/event records | Signed webhooks with retries |

For customer suspension, verify how the pinned GoTrue version handles bans and existing sessions. Specify separately whether issued access tokens expire naturally or are rejected through online validation.

Do not add billing, many providers, realtime, MongoDB, or custom hosted login pages to the first implementation. The initial value is project creation plus reliable isolated authentication.

## 7. API boundaries

Proposed routes; these are the platform contract, not raw GoTrue passthrough.

| API | Example | Required authority |
|---|---|---|
| Platform login | `POST /v1/platform/auth/login` | Developer credentials |
| Project creation | `POST /v1/projects` | Developer session + workspace role |
| Project settings | `PATCH /v1/projects/:projectId` | Owner/admin role |
| Key creation/revocation | `/v1/projects/:projectId/keys` | Owner/admin role |
| Customer signup | `POST /v1/projects/:projectId/auth/signup` | Publishable key + policy |
| Customer login | `POST /v1/projects/:projectId/auth/login` | Publishable key + credentials |
| Session refresh | `POST /v1/projects/:projectId/auth/refresh` | Project refresh token |
| Current user | `GET /v1/projects/:projectId/auth/user` | Project access token |
| Logout | `POST /v1/projects/:projectId/auth/logout` | Project session |
| Recovery | `POST /v1/projects/:projectId/auth/recover` | Public flow + abuse controls |
| Verification callback | `/v1/projects/:projectId/auth/verify` | Bound verification artifact |
| Server user management | `/v1/projects/:projectId/admin/users` | Scoped project server key |
| Console user management | `/v1/projects/:projectId/users` | Developer session + role |

Use one documented error envelope with a safe code, message, and request ID. Hide upstream stack traces and configuration. Return generic recovery responses to limit account enumeration. Document pagination, request limits, retry behavior, and versioning.

Management sessions, customer sessions, and project API keys are separate credential types. Never accept a customer JWT as a developer management session.

## 8. Tokens and integration contract

Keep GoTrue responsible for password verification and session issuance. Avoid creating a second custom session system in the MVP.

Prefer independent asymmetric signing keys per project and public project JWKS endpoints, subject to a compatibility spike against the pinned GoTrue build. Customer backends can verify signatures without receiving a signing secret. Never distribute the existing symmetric JWT secret to customers: possession also permits signing tokens.

If asymmetric configuration cannot be completed initially, offer authenticated server-to-server session validation through the gateway. Do not present offline JWKS validation as available until implemented and tested.

Validation must check the allowed algorithm, trusted key, expiry, expected audience, issuer, and configured project boundary. Issuer/callback URLs must be configured and tested against the actual upstream behavior. A project ID copied from a request or mutable user metadata is not sufficient evidence.

Logout revokes refresh capability; stateless access tokens can remain valid until expiry. Start with a proposed 15-minute customer access lifetime and rotating refresh tokens, then validate behavior against GoTrue. Applications needing immediate revocation use online session/status validation.

For the console use secure HttpOnly cookies with CSRF protection where appropriate. For customer integrations publish separate server-cookie and bearer-token examples; cross-site cookie flows require explicit browser compatibility testing. Do not quietly default to persistent browser localStorage.

## 9. Platform data model

Use a new `platform_db`, separate from all GoTrue databases. Application migrations own only platform tables.

| Table | Purpose / main fields |
|---|---|
| `developer_profiles` | Platform identity reference, name, timestamps |
| `workspaces` | Owner workspace, name, status |
| `workspace_members` | Workspace + developer, role, unique membership |
| `projects` | Workspace, name, immutable public ID, lifecycle |
| `project_environments` | Project, environment, status, configuration version |
| `auth_resources` | Environment, internal service reference, DB reference, secret references |
| `project_settings` | Signup policy, origins, redirect URLs, email configuration |
| `api_keys` | Environment, type, prefix, hash, scopes, expiry, revoked timestamp |
| `provisioning_jobs` | Resource/job state, attempts, lease, safe failure reason |
| `audit_events` | Workspace/project, actor, action, target, request ID, timestamp |
| `usage_buckets` | Environment, time window, counters |

GoTrue remains the source of truth for customer users, identities, passwords, and sessions. Optional platform-owned customer metadata must be keyed by both environment and upstream user UUID. Do not copy password hashes or let the ORM migrate GoTrue schemas.

Hash high-entropy API keys for lookup/verification; show server secrets once. Credentials that must be recovered to call an upstream belong in a secret store or encrypted storage with its key outside the database. Audit logs exclude passwords, tokens, full auth callback URLs, and provider credentials.

## 10. TypeScript / Express structure

Suggested starting structure:

```text
apps/api/src/
  modules/platform-auth/
  modules/workspaces/
  modules/projects/
  modules/project-auth/
  modules/user-management/
  modules/api-keys/
  modules/audit/
  adapters/gotrue/
  middleware/
apps/worker/src/provisioning/
packages/contracts/
packages/database/
docs/
```

Use Express for HTTP, PostgreSQL for control-plane data, a migration-capable TS database layer such as Drizzle, runtime request validation, and structured redacted logs. Keep one GoTrue adapter responsible for translating requests, responses, and errors.

A PostgreSQL-backed leased job queue is adequate for initial provisioning; ensure locking, retries, idempotency, and reconciliation. Add Redis when distributed rate limits or queue throughput warrant it. Multi-replica limits must share state rather than using independent in-memory counters.

The public API must not hold a Docker socket or run privileged provisioning commands. A separately privileged worker consumes validated jobs and uses fixed provisioning templates; tenant-supplied text must never become shell commands or arbitrary container configuration.

## 11. VM rollout

1. Inventory existing auth consumers, GoTrue configuration, backups, and VM capacity.
2. Provision `platform_db` and a restricted platform database role.
3. Deploy API and worker containers with private internal ports and controlled secrets.
4. Route the new public API hostname through Caddy.
5. Provision one test project with a private GoTrue and auth database.
6. Configure external URLs so verification, recovery, and later provider callbacks enter the gateway; test trusted forwarding headers and redirects.
7. Test the entire developer-to-customer journey with real email delivery.
8. Migrate current direct consumers before removing their existing public GoTrue route.
9. Remove direct public exposure for migrated auth instances. A private port alone is insufficient while Caddy still proxies directly to it.

Initially the existing network is usable. Introduce dedicated auth network segments to restrict which other VM services can reach identity databases and services. Avoid assuming that a shared Docker network provides isolation between services.

Back up platform and project auth databases, signing material, and provisioned configuration. Perform a restore test. Monitor upstream latency/failure, provisioning failures, disk/memory, PostgreSQL connections, and email failures. A single VM pilot has no high-availability guarantee.

## 12. Build order and acceptance criteria

### Phase 1: isolation and gateway proof

Provision two projects and implement signup, login, refresh, user lookup, logout, and validation. Prove the same email can use different passwords in each project. Prove a project-A token or server key cannot access project B. Prove customer credentials cannot access management routes. Confirm public traffic cannot bypass the gateway for pilot project instances.

### Phase 2: developer self-service

Add developer accounts, workspace ownership, project lifecycle, provisioning retries, keys, configuration, and basic user management. Repeated project-create requests must not create duplicate resources. Failed provisioning must be visible and safely retryable. Suspending a project blocks new auth traffic.

### Phase 3: production-capable pilot

Add delivered verification/recovery emails, rate limits, safe errors, audit records, quotas, credential rotation, monitoring, and tested restore procedures. Test malicious redirects, wrong-project callbacks, email enumeration behavior, upstream failure, refresh races, and partially completed provisioning.

### Phase 4: expansion

Add SDKs, team access, OAuth, additional environments, webhooks, and billing based on actual pilot needs. OAuth requires a separate design for per-project provider secrets, state/PKCE, and public callback routing.

The first complete demonstration is: developer registers -> creates project -> receives integration details -> customer signs up and verifies -> logs in -> customer's backend validates the session -> developer sees that customer in the project's user list.

## 13. Decisions to confirm during implementation

- VM sizing and initial project cap, based on measurements.
- Existing GoTrue consumers and whether it can serve platform developer identities.
- Email provider and sender/domain verification.
- Pinned GoTrue asymmetric signing and issuer/callback configuration.
- Initial product policy for signup, token lifetime, retention, and deletion.

Recommendation: proceed with isolated project auth pools, a modular TypeScript/Express gateway, PostgreSQL platform metadata, and email/password authentication first.

## 14. Initial offering and completion checklist

Use this as the v1 delivery checklist. All boxes start unchecked because this repository currently contains a specification, not an implemented platform. Check a box only when its acceptance condition works end to end.

Initial product promise: **Create a project and add hosted email/password authentication to your application, with isolated users, session management, and a developer dashboard.**

### A. Developer account and dashboard

- [ ] Developer signup and email verification — a new developer receives a real email and can verify their account.
- [ ] Developer login and logout — verified developers can access the console; logout removes their console session.
- [ ] Developer password recovery — a delivered recovery link allows a password reset without exposing tokens.
- [ ] Project overview — the console lists only projects owned by the developer's workspace, with their current status.

### B. Project creation and configuration

- [ ] Create a project — submitting a name provisions an isolated auth environment and eventually shows `active` or an actionable failure.
- [ ] Integration details — each active project shows its immutable project ID, API URL, and copyable integration examples.
- [ ] Publishable key — the developer receives a public integration key that has no admin authority.
- [ ] Server secret key — a secret is displayed once when created and grants only the documented operations for its project.
- [ ] Rotate and revoke keys — revoked keys stop authorizing new API requests; replacement keys work for the correct project.
- [ ] Allowed origins and redirects — developers configure application origins and callback URLs; unregistered redirects are rejected.
- [ ] Signup setting — disabling signup blocks new customer registration while existing users can still sign in.
- [ ] Project suspension — a suspended project rejects new auth API operations with a documented error.
- [ ] Safe provisioning retry — retrying a failed operation does not create duplicate projects or leak abandoned resources.

### C. Authentication developers can offer their users

- [ ] Email/password signup — a customer account is created only inside the selected project.
- [ ] Email verification — confirmation messages arrive and their links complete verification for the correct project. Define and enforce whether verification is required before normal login.
- [ ] Email/password login — valid credentials return the documented user/session response; invalid credentials return a safe error.
- [ ] Current-user lookup — a valid project session returns that user's safe profile fields.
- [ ] Session refresh — a valid refresh token returns a renewed session; rotation and concurrent refresh behavior are documented and tested.
- [ ] Logout — refresh capability for the selected logout scope is revoked. Documentation states how long already-issued access tokens can remain valid.
- [ ] Password recovery — recovery messages arrive; invalid, expired, or wrong-project artifacts cannot reset a password.
- [ ] Password change — an authenticated user can change their password through the documented flow; reauthentication and other-session behavior are specified.
- [ ] Backend session validation — a working TypeScript example validates the customer's session for the configured project and protects an example application route.

### D. User management in the developer console

- [ ] List and search users — results are paginated and limited to the selected project.
- [ ] View a user — show user ID, email, verification status, creation time, and available last-sign-in information; never show password hashes or tokens.
- [ ] Suspend and restore a user — a suspended user cannot obtain new sessions; the effect on existing sessions is documented and tested.
- [ ] Delete a user — an authorized developer can delete the correct project user after an explicit destructive-action confirmation. Explain that customer application data needs its own cleanup.

### E. Integration experience

- [ ] API reference — every shipped endpoint includes authentication requirements, request/response examples, and common error codes.
- [ ] Quickstart — a developer can create a project and run signup, login, refresh, logout, and a protected backend request using the guide.
- [ ] Browser and server guidance — examples clearly distinguish publishable keys, server secrets, customer sessions, and console sessions.
- [ ] Stable responses — platform errors include a safe error code and request ID; upstream configuration and stack traces stay private.

### F. Required release checks

These support the offering and must pass before inviting external developers.

- [ ] Project isolation — the same email can have different passwords in projects A and B; tokens, keys, recovery links, and admin requests cannot cross projects.
- [ ] Management authorization — customer sessions cannot access console APIs, and developers cannot access another workspace's projects.
- [ ] Private auth services — pilot GoTrue instances have no direct public route that bypasses the platform gateway.
- [ ] Abuse limits — signup, login, recovery, and verification have enforced limits; publishable keys and CORS are not treated as proof of caller identity.
- [ ] Secret protection — browser bundles, logs, and source control contain no server secrets, signing secrets, passwords, or session tokens.
- [ ] Audit history — project settings, key changes, and destructive user actions record the actor, project, action, time, and request ID.
- [ ] Failure handling — unavailable upstreams and failed email delivery produce controlled behavior without exposing internals or reporting undelivered messages as delivered.
- [ ] Backup and restore — platform metadata, project identities, signing material, and configuration can be restored through a tested procedure.
- [ ] Capacity limits and monitoring — project caps are enforced, and failed provisioning, service failures, and resource pressure are visible to the operator.

### G. Explicitly deferred features

These are future options, not requirements for the initial offering:

- Social login such as Google and GitHub.
- Magic links, phone/SMS authentication, MFA, and passkeys.
- Prebuilt login/signup components and hosted login pages.
- Full SDK packages beyond working TypeScript examples.
- Team invitations, enterprise SSO, and advanced role management.
- Separate development/production environments and custom auth domains.
- Signed customer webhooks, billing, advanced analytics, and bulk user migration.

### Final v1 walkthrough

- [ ] A new developer registers, verifies, signs in, and creates a project.
- [ ] They integrate their app using the published guide and correct credential types.
- [ ] A customer signs up, verifies, logs in, and accesses a protected route on the developer's backend.
- [ ] The customer refreshes their session, logs out, and successfully completes password recovery.
- [ ] The developer sees and manages that customer in the project's console.
- [ ] A second project passes the same flow while remaining isolated from the first.

When the offering checklist and release checks pass, the initial platform is ready for a limited external pilot. Expand features based on pilot feedback and measured capacity.

## References

- Local deployment: `vm_infrastructure/5-auth-server.md`.
- Local VM layout: `vm_infrastructure/vm-infrastructure-reference-updated.md`.
- [Supabase Auth v2.196.0 official README](https://github.com/supabase/auth/blob/v2.196.0/README.md): unsupported inherited multi-instance mode, configuration, API behavior, and schema ownership.
