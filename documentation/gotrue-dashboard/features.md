# GoTrue Dashboard — Basic V1 Features

Agreed product scope; not an implementation report. Build `gotrue-admin-api` and `gotrue-admin-web` first. See [backend architecture](backend-architecture.md), [technology stack](backend-architecture.md#technology-stack), and [shared deployment](../architecture-and-deployment.md).

[Frontend requirements](frontend-requirements.md) maps this scope to screens, interactions and every existing backend endpoint. Frontend architecture and implementation phases will be planned separately.

## What this dashboard manages

A trusted operator manages global accounts in the shared GoTrue identity pool. The browser calls our backend, which calls private GoTrue. V1 does not manage Docker containers, server environment settings, or developer projects. Accounts share one identity pool: bans and deletion can affect every application using that identity.

Operator eligibility comes from a server-controlled allowlist of GoTrue UUIDs. Valid login credentials alone do not grant operator access. No public dashboard signup or editable profile field can grant this permission. Provision the first operator through a trusted setup procedure.

## 1. Operator login, account, and logout

- Sign in with the operator's GoTrue email/password.
- Reject ordinary accounts even when their password is correct.
- Show the signed-in operator's ID and email through a current-account endpoint.
- Authenticate the session and check current operator eligibility on every protected request.
- Handle session expiry with a clear sign-in requirement; the session policy is defined in [backend architecture](backend-architecture.md#operator-sessions).
- Logout invalidates the dashboard session and clears its cookie. Document the scope of any upstream logout separately.

## 2. Operator password recovery

- Validate the current operator email before requesting recovery. Show an email-field error for ordinary/absent/ineligible accounts and send no recovery mail for them; eligible requests receive an acknowledgement that does not confirm delivery. See the [recovery API contract](api.md#password-recovery-implemented-isolated-verification).
- Deliver recovery email to Mailpit locally and the configured email provider in production.
- Allow only trusted recovery destinations and use expiring, purpose-bound recovery context.
- Let the account owner set a new password through GoTrue's supported recovery flow; invalid/expired links show a safe error.
- Require an ordinary operator login after reset. Recovery must never grant operator eligibility or a management session by itself.
- Do not expose recovery tokens in history, logs, or ordinary API responses. Follow [recovery policy and remaining upstream checks](backend-architecture.md#password-recovery).

## 3. Paginated user list

- Browse global GoTrue accounts with bounded page size and next/previous navigation where supported.
- Show ID, email, verification status, creation time, and ban status when available.
- Show loading, no-users, and retryable error states; a failed request must not look like an empty database.
- Open a selected account's details. Search is deferred; do not present page filtering as global search.

## 4. User details

- Show UUID, email, email-confirmation state, creation time, and available last-sign-in and ban information.
- Show unavailable fields honestly; do not invent dates or treat missing data as confirmed/unbanned.
- Provide create/ban/unban/delete entry points where appropriate; a missing/deleted user gets a clear not-found state.
- Never show password hashes, access/refresh tokens, recovery tokens, or privileged credentials.

## 5. Create a user

- Accept and validate email, password, and an explicit confirmation policy.
- Support an account requiring email verification or deliberate operator-confirmed creation through the supported upstream operation.
- State that operator confirmation bypasses email ownership verification; it must be an explicit choice.
- Show duplicate/invalid-input errors safely and prevent repeated submission while the request is pending.
- Show the new user's safe details and record the management action.
- Creating an account is not an invitation. Verify and document whether the selected operation actually sends email; never display an email-sent message unless that is supported and confirmed.

## 6. Ban and unban a user

- Require explicit confirmation before banning and explain the shared-account impact.
- Define a bounded V1 ban-duration policy and validate it against pinned GoTrue before implementation; do not claim an indefinite ban unless supported.
- Restore access through the supported unban operation and reload the user's status.
- Show whether a ban is active and its expiry when upstream supplies it.
- Record both successful and failed management attempts. Explain the actual effect on existing tokens/sessions; do not claim instant universal revocation.

## 7. Delete a user

- Show the target ID/email and require explicit permanent-deletion confirmation.
- Explain that this removes the global identity, rather than removing membership from one project.
- Verify the pinned upstream deletion mode supports the intended permanent behavior; do not silently substitute soft deletion.
- On confirmed success, remove the user from the visible list and record the result without credentials.
- Keep application-owned references separate. Define reconciliation before enabling deletion against production identities with platform data; never silently cascade into platform tables.

## 8. Protect the last operator

- Reject ban/delete requests that would remove the last usable configured operator; enforce this on the backend, not only by disabling buttons.
- Define usable as an eligible identity that exists, is not actively banned, and satisfies the configured login policy. Presence of a UUID in configuration alone is insufficient.
- Handle concurrent actions so two requests cannot both remove the final usable operator; fail closed when eligibility cannot be established.
- Explain a rejected action clearly. This protects dashboard operations; out-of-band GoTrue/configuration changes still require a trusted recovery procedure.

## 9. Basic GoTrue health

- Show reachable/unreachable status and safe upstream version information.
- Distinguish API liveness from upstream readiness. A health response alone does not establish that login, the database, or email delivery works.
- Show timeout/unavailable states without exposing connection strings or internal credentials.

## 10. Recent management action history

- Show recent user creation, invitation, verification-email, ban, unban, and deletion attempts with pagination or a bounded recent view.
- Record actor UUID, target UUID where known, action, outcome, timestamp, and request ID.
- Keep records durable across API restarts and restrict viewing to eligible operators.
- Distinguish success, failure, and unknown/partial outcomes. Follow the [durable audit policy](backend-architecture.md#durable-audit-history) for intent/completion records and reconciliation.
- Never record passwords, cookies, tokens, or raw upstream payloads. Operational Pino logs are separate from this history.

## Required foundations

The user-requested frontend polish adds a bounded operator dashboard, summary counts and varied charts over existing user/audit pages and health reads. [Frontend requirements](frontend-requirements.md#requested-dashboard-extension-implemented-2026-10-01) owns its sample limits and UI behavior. Global analytics/totals remain deferred; this view does not add aggregation endpoints or change backend contracts.

Secure operator sessions, constructor-injected class-based layers, server-side input validation, exact browser origins, CSRF protection for cookie-authenticated mutations, request/body limits, safe errors and logging, bounded Axios timeouts, and durable audit persistence. No unrestricted GoTrue passthrough or direct access to GoTrue tables.

Planned route groups remain `/v1/operator/auth/*`, `/v1/operator/users`, operator audit history, and minimal health. Final methods/payloads, storage, session lifecycle, and recovery callbacks are documented before their implementation.

## Authorized email extension

Operators can invite users, send verification for unconfirmed password-created accounts, and resend invitations for unconfirmed invited accounts. Recipients verify the newest OTP; invited recipients choose their own password. None of these grants operator eligibility. GoTrue owns sending through hosted Resend SMTP, proof expiry and one-use validation; our API preserves strict contracts and durable email-action audit. The [API reference](api.md#email-extension-contract-implemented-live-delivery-pending) owns details and [status](status.md) distinguishes isolated verification from pending manual inbox tests.

## Deferred

Global email search until upstream support is assessed; editing user email/password/metadata; bulk operations; full session/device administration; operator-role management UI; analytics; provider/environment settings; Docker restart/log controls; developer/project management.

## Complete V1

An eligible operator signs in, browses accounts, opens details, creates a controlled test account, bans/unbans it, deletes it, and sees durable action outcomes. Recovery, logout, expiry, ordinary-account rejection, and last-operator protection work. The frontend communicates only with our API. See [specific delivery checks](checklist.md).
