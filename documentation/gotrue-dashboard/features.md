# GoTrue Dashboard — Basic V1 Features

Agreed product scope; not an implementation report. Build `gotrue-admin-api` and `gotrue-admin-web` first. See [backend architecture](backend-architecture.md), [tech stack](tech-stack.md), and [shared deployment](../architecture-and-deployment.md).

## What this dashboard manages

A trusted operator manages global accounts in the shared GoTrue identity pool. The browser calls our backend, which calls private GoTrue. V1 does not manage Docker containers, server environment settings, or developer projects. Accounts share one identity pool: bans and deletion can affect every application using that identity.

Operator eligibility comes from a server-controlled allowlist of GoTrue UUIDs. Valid login credentials alone do not grant operator access. No public dashboard signup or editable profile field can grant this permission. Provision the first operator through a trusted setup procedure.

## 1. Operator login, account, and logout

- Sign in with the operator's GoTrue email/password.
- Reject ordinary accounts even when their password is correct.
- Show the signed-in operator's ID and email through a current-account endpoint.
- Authenticate the session and check current operator eligibility on every protected request.
- Handle session expiry with a clear sign-in requirement; define refresh behavior before implementation.
- Logout invalidates the dashboard session and clears its cookie. Document the scope of any upstream logout separately.

## 2. Operator password recovery

- Provide a forgot-password flow with a generic response that does not reveal whether an email belongs to an operator.
- Deliver recovery email to Mailpit locally and the configured email provider in production.
- Allow only trusted recovery destinations and use expiring, purpose-bound recovery context.
- Let the account owner set a new password through GoTrue's supported recovery flow; invalid/expired links show a safe error.
- Require an ordinary operator login after reset. Recovery must never grant operator eligibility or a management session by itself.
- Do not expose recovery tokens in history, logs, or ordinary API responses. Define the effect on existing sessions before implementation.

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

- Show recent user creation, ban, unban, and deletion attempts with pagination or a bounded recent view.
- Record actor UUID, target UUID where known, action, outcome, timestamp, and request ID.
- Keep records durable across API restarts and restrict viewing to eligible operators.
- Distinguish success, failure, and unknown/partial outcomes. GoTrue mutation and audit storage are not one transaction; define intent/completion records and reconciliation before implementation.
- Never record passwords, cookies, tokens, or raw upstream payloads. Operational Pino logs are separate from this history.

## Required foundations

Secure operator sessions, constructor-injected class-based layers, server-side input validation, exact browser origins, CSRF protection for cookie-authenticated mutations, request/body limits, safe errors and logging, bounded Axios timeouts, and durable audit persistence. No unrestricted GoTrue passthrough or direct access to GoTrue tables.

Planned route groups remain `/v1/operator/auth/*`, `/v1/operator/users`, operator audit history, and minimal health. Final methods/payloads, storage, session lifecycle, and recovery callbacks are documented before their implementation.

## Deferred

Global email search until upstream support is assessed; editing user email/password/metadata; invitation and resend-verification workflows; bulk operations; full session/device administration; operator-role management UI; analytics; provider/environment settings; Docker restart/log controls; developer/project management.

## Complete V1

An eligible operator signs in, browses accounts, opens details, creates a controlled test account, bans/unbans it, deletes it, and sees durable action outcomes. Recovery, logout, expiry, ordinary-account rejection, and last-operator protection work. The frontend communicates only with our API. See [specific delivery checks](checklist.md).
