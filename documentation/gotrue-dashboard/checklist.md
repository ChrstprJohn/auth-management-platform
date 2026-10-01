# GoTrue Dashboard — V1 Delivery Checklist

Implementation checks are marked only after verification. Decision checks below track documented design, not working code. Existing local setup is documented separately in [local README](../../infrastructure/local/README.md). See [feature descriptions](features.md) and [agreed V1 decisions](backend-architecture.md#agreed-v1-decisions).

## Decisions before coding

- [x] Specify operator session storage, cookie settings, encryption, expiry, refresh, and logout behavior.
- [x] Select restricted durable audit storage, retention, and intent/completion failure handling.
- [x] Document first-operator provisioning and trusted recovery from lockout.
- [x] Define initial health/login/current-operator/logout methods, payloads, and safe error envelope.
- [x] Define exact recovery and later user-management/audit contracts, including pagination limits.
- [ ] Verify GoTrue recovery, creation/confirmation/email behavior, ban duration, and permanent deletion against the pinned version.

## Latest local backend evidence

Restricted-role verification (2026-10-01): after the user updated credentials and restarted the API, read-only metadata confirmed admin_api_runtime is the connected role and has no superuser, database/role creation, RLS bypass or schema CREATE privileges. The full management and successful recovery walkthroughs passed with this connection, including restart persistence, concurrent single-use reset, last-operator contention, session expiry and dependency failure checks. The running API returned ready. Disposable accounts/mail were removed; audit history was retained. This supersedes earlier restricted-role pending notes below. Natural upstream email-link expiry and production checks remain unverified.

On 2026-10-01, `scripts/verify-local-management.ts` passed against existing PostgreSQL and pinned GoTrue using disposable accounts. It verified operator login/me, wrong-password and ordinary-account rejection, bounded safe pagination/details, both creation modes without email, duplicate handling, ban duration and existing-access-token rejection during ban, unban, permanent deletion/not-found, audit/session persistence through gateway reconstruction, two-instance destructive contention and last-usable-operator rejection, eligibility removal, and logout. The real allowlist and credentials were unchanged; accounts were removed and audit history retained. This used the configured privileged database role; restricted-role operation, natural ban/session/OTP expiry walkthroughs, UI and production deployment remain unverified. Route extraction preserved endpoint contracts and all 76 isolated tests pass. Earlier phase evidence below records the checks available at that phase.

Session-expiry and shutdown evidence (2026-10-01): the management probe now establishes a real GoTrue login with a test-only two-second session expiry cap, verifies the PostgreSQL-backed session initially works, closes its gateway, waits past expiry, and checks every protected route through another gateway. Absent, malformed and expired cookies all returned safe 401 responses. This verifies persisted expiry enforcement without changing the one-hour policy or waiting for natural upstream expiry. A temporary compiled API on port 3101 reached readiness; invoking its registered SIGTERM handler then exited with code 0 and left no process/listener. Forced successful exit initially triggered a Windows native-handle assertion; allowing Node to finish cleanup resolved that check. Ctrl+C stopped the separate foreground terminal session, whose terminal exit code was 1. Restricted-role verification remains pending.

## Login and session

Initial implementation evidence (2026-10-01): workspace/backend build and 14 isolated configuration/HTTP tests pass for auth boundaries, expiry, encryption, CSRF, rate limits, logout, production-cookie attributes and readiness failure. No SQL was executed. Delivery boxes below stay unchecked until controlled live PostgreSQL/GoTrue walkthroughs establish them. See [backend setup](../../apps/gotrue-admin-api/README.md).

Second phase evidence: 48 isolated tests now cover user-list/details contracts, confirmations, bounded pagination, durable-intent failure/partial/unknown outcomes, last-operator/session-proof rules, simulated concurrency, mocked pg connection/lock failures, adapter timeout/error/payload/identity boundaries, protected safe-version health and static full-schema/migration consistency. Strict TypeScript includes the tests. Live PostgreSQL advisory-lock contention, persistence across restart, upstream mutations, email and recovery are still unverified. Migration 0002 is prepared only.

Recovery implementation evidence (2026-10-01): 76 isolated tests pass across the backend, including separate recovery cookies, generic responses, Origin/CSRF, encrypted material, expiry, identity binding, replay/concurrent claims, session invalidation ordering, ambiguous outcomes and mocked transaction failures. A disposable-account pinned GoTrue/Mailpit walkthrough verified email, PKCE exchange/state preservation, code replay/invalid-link rejection, password change and old/new password/token effects. After the user reported migration 0003 applied and GoTrue restarted, the complete gateway/PostgreSQL recovery flow passed: context survived gateway restart, concurrent reset produced one 204 and one 400, old dashboard session/password failed, and new-password login/logout worked. Readiness returned 200 ready. These probes applied no schema SQL and removed their accounts/mail. A real wait-until-OTP-expiry check and frontend reset page remain pending; broader V1 management/security delivery remains separate work.

- [x] Eligible operator can sign in and retrieve current ID/email.
- [x] Wrong credentials return a safe error; valid ordinary accounts receive no operator session.
- [x] Every protected endpoint rejects absent/invalid/expired sessions and rechecks operator eligibility.
- [ ] Removing eligibility blocks subsequent protected requests; platform credentials cannot substitute for operator sessions.
- [x] Logout invalidates the dashboard session and clears its cookie; refresh and expiry match the documented policy.

## Recovery

- [x] Forgot-password responses do not reveal operator/account existence and are rate-limited.
- [x] Mailpit receives the local recovery message and its trusted callback supports password reset.
- [x] Invalid/expired recovery context and untrusted redirects are rejected safely.
- [x] Recovery does not grant operator eligibility or automatically establish a management session.
- [x] Existing-session effects of password reset are documented and tested; reset tokens stay out of logs/history.

Recovery boundary evidence (2026-10-01): the gateway walkthrough now rejects absent browser proof, mismatched state, arbitrary redirect fields, reset before callback, callback replay, missing CSRF and untrusted Origin, while the successful recovery flow still passes. Its separate `--expiry` mode caps only the probe's returned upstream recovery-token lifetime to two seconds, reconstructs the gateway and waits for persisted ready-context expiry. Reset returns 400 `INVALID_RECOVERY`; the old password and existing dashboard session still work. This establishes local context-expiry enforcement, not natural upstream OTP expiry. Disposable accounts/messages were removed; no setup SQL was executed.

## Browse users

- [x] List uses bounded upstream pagination and supports navigation without implying global search.
- [ ] List shows safe account fields with loading, empty, and error states.
- [x] Details show verification, creation, available last-sign-in, and ban information accurately.
- [ ] Missing/deleted users show not-found; unavailable fields are represented honestly.

## Create users

- [ ] Email/password and explicit confirmation policy are validated on the backend.
- [ ] Operator-confirmed creation clearly explains bypassing email verification.
- [ ] Duplicate and upstream failures produce safe errors; UI prevents repeated pending submissions.
- [x] Creation returns safe account details and records an audit outcome.
- [ ] UI accurately explains whether email was sent; account creation is not labeled as an invitation.

## Ban and unban

- [ ] Ban requires confirmation, explains global impact, and validates the agreed duration policy.
- [x] Ban/unban refresh account status and record outcomes.
- [ ] Existing-token/session effects and ban expiry are accurately documented and tested.

## Delete

- [ ] Confirmation identifies the target and explicitly explains permanent global identity deletion.
- [x] The supported deletion operation matches the promised permanent behavior.
- [ ] Successful deletion updates the list and records the outcome; ambiguous failure is not blindly retried.
- [ ] Platform-reference reconciliation is defined before enabling deletion against production platform users.

## Last-operator protection

- [x] Backend rejects banning/deleting the last usable operator, including direct API calls.
- [x] Check uses existing eligible identities and their login/ban state, not just allowlist length.
- [x] Concurrent mutations cannot bypass protection; unknown eligibility fails closed.
- [ ] Another usable operator permits the target operation; out-of-band recovery is documented.

## Health and history

- [ ] Health distinguishes API liveness from reachable/unreachable GoTrue and exposes safe version information.
- [ ] Timeouts are clear; health is not presented as proof of working email/database/login flows.
- [x] Operators can browse a bounded/paginated recent history of create/ban/unban/delete attempts.
- [x] History includes actor, target, action, outcome, time, and request ID without credentials.
- [x] Audit survives restart and distinguishes completed, failed, and unknown/partial outcomes.
- [ ] Audit persistence failure follows the documented policy and never claims an applied GoTrue change rolled back.

## Security and reliability

Local dependency-failure evidence (2026-10-01): the management probe used temporary process-only URLs pointing at a closed local port, independently for GoTrue and PostgreSQL. In both cases liveness remained 200, readiness returned 503, and operator login returned safe correlated 503 without a dashboard cookie or credential-bearing response. Existing infrastructure and real configuration were unchanged. Adapter tests separately verify bounded Axios timeout behavior against local HTTP fixtures; these connection-refusal checks do not simulate a long-running database statement or network partition.

- [ ] Protected operations enforce operator authority, input validation, and allowed fields.
- [ ] Cookie/CSRF/exact-origin rules and login/recovery/general request limits work.
- [ ] Browser bundles, responses, logs, and audit contain no privileged credentials, passwords, or tokens.
- [ ] Axios timeouts and upstream errors map to safe responses with request IDs; mutations have no blind automatic retries.
- [ ] Configuration validation, graceful shutdown, and foreground Node process rules are followed.

## End-to-end completion

- [x] Controlled local test account completes create, list/details, ban/unban, delete, and history walkthrough.
- [ ] Operator recovery, expiry, logout, ordinary-account rejection, and last-operator protection pass.
- [ ] Admin API deploys independently behind VM Caddy; frontend deploys on Vercel and calls only our API.
- [ ] Production browser cookies/origins and real recovery email delivery are verified before launch.
