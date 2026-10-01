# Operator frontend delivery checklist

Status: frontend implementation is in progress. Checked documentation decisions do not mean working UI. Mark implementation items only after the behavior is built and verified, recording its tests/browser evidence and phase commit.

## Phase evidence

Users/browse/create (2026-10-01): safe paginated list, invalid URL defaults, details/missing destinations, copyable UUIDs, inspectable ISO timestamps, null/unknown fields and explicit creation policies are implemented. Thirty frontend tests passed, including bounded page parsing, read failure distinct from empty, absent details, both confirmation policies/exact payloads and uncertain-create repeat blocking. Typecheck/lint/static build passed. No live users were changed. Recovery commit: `6b6e22b`. Browse/create phase commit: `feat(web): deliver paginated users and explicit account creation` (resolve by title).

Recovery (2026-10-01): public forgot/reset routes, generic acknowledgement, same-browser/newest-email and local Mailpit guidance, UTF-8 password limits, local confirmation and exact password-only reset payload are implemented. Twenty-three frontend tests passed, including 204 cache cleanup, invalid context, unknown update and failed-completion feedback with blocked repeat and cleared passwords. Typecheck/lint/static build passed. Base UI link composition warnings were corrected and the 23 tests rerun successfully. Live Mailpit callback navigation remains unverified. Session commit: `ee83edd`. Recovery phase commit: `feat(web): implement safe same-browser recovery screens` (resolve by title).

Session/account (2026-10-01): thin login/account views, responsive generated Sidebar/Sheet, public-origin login, account UUID/email/expiry and logout are implemented. Seventeen frontend tests passed, including existing-password validation, internal return routes, denied login/password clearing, failed logout with retained session, confirmed logout/cache clearing and stale-response/session-loss generation checks. Frontend typecheck, repository lint and static build passed. Browser focus/layout and real cookie/CORS checks remain pending. Foundation commit: `07c117e`. Session phase commit: `feat(web): add isolated operator sessions and account flow` (resolve by title).

Foundation (2026-10-01): Vite 7.3.6/React 19.3.0 with strict browser TypeScript, Tailwind 4.3.3 and official shadcn 4.21.0 Base UI `base-nova` generation. Package versions are pinned. Frontend typecheck, repository lint, static build and 11 API-boundary tests passed. Tests establish cookie/CSRF/DELETE configuration, 204 handling, response stripping/validation, safe partial metadata, network uncertainty/no retry, health 503 handling and public-origin validation. React Hooks lint rules and separate browser tests are integrated into root checks. Setup is documented in `apps/gotrue-admin-web/README.md`. No database, infrastructure or deployment actions occurred. Screen/browser verification remains pending. Phase commit: `feat(web): establish Vite and safe operator API foundation` (resolve by title in Git history).

[Requirements](frontend-requirements.md) owns features and endpoint usage; [architecture](frontend-architecture.md) owns the stack and hook/view boundaries; [implementation plan](frontend-implementation-plan.md) owns phases; [API reference](api.md) owns contracts. The [product checklist](checklist.md) tracks overall V1/backend/production delivery.

## Documented decisions

- [x] Agree React/TypeScript/Vite, shadcn/ui, Tailwind, Axios, React Router, TanStack Query and React Hook Form/Zod.
- [x] Use shadcn components/default styling with accessible, responsive state presentation.
- [x] Define thin views, feature hooks and shared API/session/cache boundaries in architecture and AGENTS.md.
- [x] Map all 16 endpoints to real frontend use, including browser recovery callback navigation.
- [x] Define public/protected screens, safe failures, confirmation behavior and implementation phases.
- [x] Check current official shadcn documentation and map component choices to screens/states.

## Foundation and navigation

- [x] Vite React SPA works in the pnpm workspace with compatible pinned dependencies and strict TypeScript.
- [ ] Tailwind and generated shadcn controls share consistent default tokens and interaction states.
- [ ] Component-map controls, including Field/Empty/Spinner/Input Group, are used where appropriate with consistent current primitive APIs.
- [x] Public API configuration is validated/documented; no secrets or backend environment imports reach the frontend.
- [x] Shared Axios requests implement cookies, exact CSRF/body fields, bounded timeout, cancellation and safe response validation.
- [ ] Public login/recovery and protected Users/create/details/History/Status/Account routes work on navigation/reload.
- [ ] Unknown routes have a useful not-found screen; navigation works on desktop/mobile and by keyboard.
- [ ] Views only render presentation and bind hook callbacks; business/request/effect/form/navigation behavior lives in hooks or shared boundaries.

## Sign-in, session and account

- [ ] Sign-in validates the existing-password contract, blocks repeated pending submission and handles bad credentials/ordinary-account denial.
- [ ] Login rate-limit and dependency/network failures have safe visible feedback.
- [ ] Successful login opens Users; account displays safe UUID/email/expiry and copy feedback/fallback.
- [ ] Reload restores an eligible session with loading UI and no private-content flash.
- [ ] Expiry/protected 401 clears private state and requires sign-in without automatic refresh.
- [ ] Protected 403 blocks access; bootstrap 503 shows unavailable without claiming logout or granting access.
- [ ] Late old-session responses cannot repopulate caches after logout/reset/session loss/different-account login.
- [ ] Confirmed logout handles 204 and clears private state; failed invalidation remains visible with deliberate retry.
- [ ] Return navigation stays within safe internal destinations.

## Forgot/reset password

- [ ] Valid recovery email receives generic acknowledgement without account disclosure or a delivery promise.
- [ ] Same-browser/newest-email instructions and clearly local Mailpit guidance are available.
- [ ] Email navigation reaches the backend callback and SPA reset page without frontend code/token exchange or storage.
- [ ] Reset validates UTF-8 password limits and local confirmation, sending only the allowed password field.
- [ ] Pending, field errors, rate limits and missing/expired/consumed/ineligible context have corresponding UI.
- [ ] Direct reset-page access does not invent a status endpoint or grant a management session.
- [ ] Reset 204 clears private state and requires ordinary sign-in.
- [ ] Unknown reset outcome/failed cleanup explains what is known and offers sign-in/trusted help, never automatic repeat.
- [ ] Recovery remains accessible during existing-session problems; secrets never enter storage/telemetry/support reports.

## User list and details

- [ ] Users renders safe fields, readable status labels and copyable UUID/detail links.
- [ ] Page/page-size and URL parameters respect backend bounds; Previous/Next invent no totals or global search.
- [ ] Initial loading, background refresh, real data, empty page and failed request render differently.
- [ ] Details shows available confirmation/creation/last-sign-in/ban data and honest null/unknown values.
- [ ] Invalid/missing/deleted destinations show safe feedback and return to Users.
- [ ] Long emails/IDs and wide tables remain usable at mobile widths without hiding essential fields.

## Create user

- [ ] Email/password and explicit confirmation policy use backend-aligned validation.
- [ ] Operator confirmation explains bypassing ownership verification; unconfirmed creation explains its limitations.
- [ ] Neither policy falsely claims invitation/confirmation email was sent.
- [ ] Pending, validation, duplicate and dependency failures have corresponding UI and no duplicate submission.
- [ ] Confirmed creation shows safe returned details and refreshes affected reads/history without retaining the password.
- [ ] Uncertain creation preserves safe support IDs and offers read-only inspection instead of silent repetition.

## Ban and unban

- [ ] Confirmations identify target UUID/email and shared-account impact; cancel sends no request.
- [ ] Ban validates bounded integer duration and exact matching-target confirmation; unban is explicitly confirmed.
- [ ] Pending/success/unavailable/denied states render correctly; confirmed outcomes refresh details/list/history.
- [ ] Last-operator/contention/reconciliation failures explain safe next steps without inventing an operator roster.
- [ ] Token/session messaging does not promise universal revocation.
- [ ] Unknown/partial outcomes preserve IDs, block ordinary resubmission and offer read-only inspection.

## Permanent deletion

- [ ] Destructive confirmation identifies exact UUID/available email and permanent global effect; cancel sends no request.
- [ ] DELETE sends required JSON confirmation/target and blocks repeat pending submission.
- [ ] Disabled deletion/last-operator refusal preserves the target and explains the backend restriction.
- [ ] Confirmed success leaves removed details and refreshes Users/history; later 404 renders as missing/already deleted.
- [ ] Unknown/network/partial failure claims no rollback and never automatically repeats deletion.
- [ ] Control visibility or guessed capability/role data never overrides backend authority.

## Action history

- [ ] Bounded pages show real actor/target/action/outcome/timestamps and safe audit/request IDs.
- [ ] Pending/succeeded/failed/unknown are textually and visually distinct; unresolved records never appear completed.
- [ ] Null fields and deleted-target links render honestly.
- [ ] Loading/refresh/empty/session-failure/read-error states are complete.
- [ ] Safe IDs are copyable; no frontend reconciliation or retry mutation is invented.

## Service status

- [ ] API liveness, combined readiness and protected GoTrue reachability/version are separate results.
- [ ] Each check has loading, last-check time, success, unavailable/network failure and deliberate refresh.
- [ ] Health 503 status objects are handled without assuming an error envelope.
- [ ] Health does not falsely prove email/login/database behavior; no fabricated metrics or infrastructure controls appear.

## All endpoint integrations

Verify feature calls and browser navigation against actual route modules and the API reference:

- [ ] GET `/health/live` — liveness.
- [ ] GET `/health/ready` — combined readiness.
- [ ] POST `/v1/operator/auth/login` — sign-in.
- [ ] GET `/v1/operator/auth/me` — restoration/account.
- [ ] POST `/v1/operator/auth/logout` — logout.
- [ ] POST `/v1/operator/auth/forgot-password` — recovery request.
- [ ] GET `/v1/operator/auth/recovery/callback` — email/browser navigation through the backend.
- [ ] POST `/v1/operator/auth/reset-password` — reset submission.
- [ ] GET `/v1/operator/users` — paginated browsing.
- [ ] GET `/v1/operator/users/:id` — details/refresh.
- [ ] POST `/v1/operator/users` — account creation.
- [ ] POST `/v1/operator/users/:id/ban` — bounded ban.
- [ ] POST `/v1/operator/users/:id/unban` — unban.
- [ ] DELETE `/v1/operator/users/:id` — permanent deletion.
- [ ] GET `/v1/operator/audit` — paginated history.
- [ ] GET `/v1/operator/health` — protected upstream status/version.

## UI states, accessibility and safety

- [ ] Loading/refreshing/empty/loaded/success/validation/not-found/denied/expired-session states are checked where applicable.
- [ ] Rate-limited/dependency/network/disabled/pending/unknown/partial states are checked where applicable.
- [ ] Labels, field errors, first-error focus, keyboard access, visible focus and status announcements work.
- [ ] Dialog descriptions/focus return/cancel behavior work; pending closure never implies backend cancellation or loses outcome feedback.
- [ ] Status does not depend on color alone; contrast and reduced motion are verified.
- [ ] 204 is not parsed as JSON; callback 303 remains browser navigation.
- [ ] Mutation errors never retry automatically; read failure never becomes empty data and retries are deliberate.
- [ ] Secret-bearing forms/mutation variables are cleared appropriately; private caches are isolated and not persisted.
- [ ] Copy success/failure and unsupported clipboard access have useful feedback/fallback.

## Verification and delivery

- [ ] Behavior tests cover session transitions, forms, request boundaries and applicable UI states.
- [ ] Frontend/repository typecheck, lint, formatting and static build pass without breaking affected backend checks.
- [ ] Emitted frontend assets contain no privileged credentials or server-only dependencies.
- [ ] Batched desktop/mobile/keyboard review passes and material fixes are confirmed.
- [ ] Controlled browser walkthrough verifies login/account/logout and same-browser Mailpit recovery/reset/new-password login.
- [ ] Controlled browser walkthrough verifies create/list/details/ban/unban/delete/history and last-operator/disabled feedback.
- [ ] All 16 endpoints are integrated and verified at intended scope; unavailable checks remain recorded.
- [ ] Setup README, phase evidence and delivery status reflect actual implementation.
- [ ] Completed phases are committed; agent-owned foreground servers are stopped and attributable leftovers checked.

## Separate launch prerequisites

These remain separate from local implementation:

- [ ] Production static hosting serves direct SPA routes, including reset-password, under the agreed same-site HTTPS origin.
- [ ] Production API origins/cookies and real recovery email are verified before launch.
- [ ] Platform-reference reconciliation is reviewed before enabling permanent deletion for production identities.
- [ ] Remaining natural GoTrue email-link expiry verification is recorded honestly.

Do not add deferred features as implicit V1 requirements. Follow the requirements document's deferred scope.
