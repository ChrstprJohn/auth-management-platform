# GoTrue Dashboard — V1 Delivery Checklist

Implementation checks are marked only after verification. Decision checks below track documented design, not working code. Existing local setup is documented separately in [local README](../../infrastructure/local/README.md). See [feature descriptions](features.md) and [agreed V1 decisions](backend-architecture.md#agreed-v1-decisions).

## Decisions before coding

- [x] Specify operator session storage, cookie settings, encryption, expiry, refresh, and logout behavior.
- [x] Select restricted durable audit storage, retention, and intent/completion failure handling.
- [x] Document first-operator provisioning and trusted recovery from lockout.
- [x] Define initial health/login/current-operator/logout methods, payloads, and safe error envelope.
- [ ] Define exact recovery and later user-management/audit contracts, including pagination limits.
- [ ] Verify GoTrue recovery, creation/confirmation/email behavior, ban duration, and permanent deletion against the pinned version.

## Login and session

Initial implementation evidence (2026-10-01): workspace/backend build and 14 isolated configuration/HTTP tests pass for auth boundaries, expiry, encryption, CSRF, rate limits, logout, production-cookie attributes and readiness failure. No SQL was executed. Delivery boxes below stay unchecked until controlled live PostgreSQL/GoTrue walkthroughs establish them. See [backend setup](../../apps/gotrue-admin-api/README.md).

- [ ] Eligible operator can sign in and retrieve current ID/email.
- [ ] Wrong credentials return a safe error; valid ordinary accounts receive no operator session.
- [ ] Every protected endpoint rejects absent/invalid/expired sessions and rechecks operator eligibility.
- [ ] Removing eligibility blocks subsequent protected requests; platform credentials cannot substitute for operator sessions.
- [ ] Logout invalidates the dashboard session and clears its cookie; refresh and expiry match the documented policy.

## Recovery

- [ ] Forgot-password responses do not reveal operator/account existence and are rate-limited.
- [ ] Mailpit receives the local recovery message and its trusted callback supports password reset.
- [ ] Invalid/expired recovery context and untrusted redirects are rejected safely.
- [ ] Recovery does not grant operator eligibility or automatically establish a management session.
- [ ] Existing-session effects of password reset are documented and tested; reset tokens stay out of logs/history.

## Browse users

- [ ] List uses bounded upstream pagination and supports navigation without implying global search.
- [ ] List shows safe account fields with loading, empty, and error states.
- [ ] Details show verification, creation, available last-sign-in, and ban information accurately.
- [ ] Missing/deleted users show not-found; unavailable fields are represented honestly.

## Create users

- [ ] Email/password and explicit confirmation policy are validated on the backend.
- [ ] Operator-confirmed creation clearly explains bypassing email verification.
- [ ] Duplicate and upstream failures produce safe errors; UI prevents repeated pending submissions.
- [ ] Creation returns safe account details and records an audit outcome.
- [ ] UI accurately explains whether email was sent; account creation is not labeled as an invitation.

## Ban and unban

- [ ] Ban requires confirmation, explains global impact, and validates the agreed duration policy.
- [ ] Ban/unban refresh account status and record outcomes.
- [ ] Existing-token/session effects and ban expiry are accurately documented and tested.

## Delete

- [ ] Confirmation identifies the target and explicitly explains permanent global identity deletion.
- [ ] The supported deletion operation matches the promised permanent behavior.
- [ ] Successful deletion updates the list and records the outcome; ambiguous failure is not blindly retried.
- [ ] Platform-reference reconciliation is defined before enabling deletion against production platform users.

## Last-operator protection

- [ ] Backend rejects banning/deleting the last usable operator, including direct API calls.
- [ ] Check uses existing eligible identities and their login/ban state, not just allowlist length.
- [ ] Concurrent mutations cannot bypass protection; unknown eligibility fails closed.
- [ ] Another usable operator permits the target operation; out-of-band recovery is documented.

## Health and history

- [ ] Health distinguishes API liveness from reachable/unreachable GoTrue and exposes safe version information.
- [ ] Timeouts are clear; health is not presented as proof of working email/database/login flows.
- [ ] Operators can browse a bounded/paginated recent history of create/ban/unban/delete attempts.
- [ ] History includes actor, target, action, outcome, time, and request ID without credentials.
- [ ] Audit survives restart and distinguishes completed, failed, and unknown/partial outcomes.
- [ ] Audit persistence failure follows the documented policy and never claims an applied GoTrue change rolled back.

## Security and reliability

- [ ] Protected operations enforce operator authority, input validation, and allowed fields.
- [ ] Cookie/CSRF/exact-origin rules and login/recovery/general request limits work.
- [ ] Browser bundles, responses, logs, and audit contain no privileged credentials, passwords, or tokens.
- [ ] Axios timeouts and upstream errors map to safe responses with request IDs; mutations have no blind automatic retries.
- [ ] Configuration validation, graceful shutdown, and foreground Node process rules are followed.

## End-to-end completion

- [ ] Controlled local test account completes create, list/details, ban/unban, delete, and history walkthrough.
- [ ] Operator recovery, expiry, logout, ordinary-account rejection, and last-operator protection pass.
- [ ] Admin API deploys independently behind VM Caddy; frontend deploys on Vercel and calls only our API.
- [ ] Production browser cookies/origins and real recovery email delivery are verified before launch.
