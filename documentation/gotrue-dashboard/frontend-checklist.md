# Operator frontend delivery checklist

Status: complete documented local frontend scope is implemented and verified at the scopes below. Production launch prerequisites remain separate. Historical phase evidence records checks available at that phase and is superseded by final delivery evidence.

## Phase evidence

Application-wide layout overhaul (2026-10-01): all ten existing pages (`/login`, `/forgot-password`, `/reset-password`, `/dashboard`, `/users`, `/users/new`, `/users/:id`, `/history`, `/status`, `/account`) now use composed shared shells and responsive shadcn sections. The protected shell extracts AppSidebar and supplies a sticky breadcrumb/header account menu, one main landmark, consistent padding and PageHeader actions. Metrics use two/four-column grids; chart/detail/create/account areas use seven-column desktop splits. Service cards align their footer controls. Card text columns shrink independently of ellipsis menus; email previews truncate while account details preserve full values. Public forms compose separate navigation footers, and session-blocked/not-found screens use RouteState. Empty outcome containers no longer add page-top space. Dark sidebar text and neutral chart tokens were checked in rendered output.

Verification for this change: 58 frontend behavior tests pass, including cookie/CSRF/204 parsing, session/cache transitions, recovery and creation validation, uncertain outcomes, history/detail menus, and independent service refresh from the new card menu. Aggregate repository typecheck, lint, Prettier check, frontend static build and safe emitted-asset scan pass. A pre-existing blank-line formatting issue in the history test was normalized without changing its behavior. Build output has an 800.93 kB main JavaScript chunk (256.60 kB gzip) and a lazy 400.10 kB dashboard chunk (117.54 kB gzip); Vite's size warning and the pinned Zod annotation warnings remain nonfatal.

The fixture browser audit and single confirmation pass check every route at 320/390/768/1024/1440px, plus light/dark tokens, desktop icon collapse, mobile drawer Escape, keyboard header-menu focus return, row menus/detail dialogs, first-invalid-field focus, empty/error separation, missing/denied/unavailable routes and uncertain feedback across navigation. Preview tables fit without horizontal scrolling at every checked width. All ten pages were visually inspected at desktop and narrow mobile widths against the official dashboard-01 composition (plus the existing login reference). Fifty-eight fixture-only captures per completed round are saved under ignored `artifacts/web-review/layout-after` and `layout-confirm`; the public dashboard reference is under `polish-before`. The initial screenshot attempt timed out while loading the dashboard; a behavior-only diagnosis passed, and the completed screenshot rounds passed with a bounded 30-second browser wait.

The source diff preserves feature hooks, session orchestration, API client/contracts, route parameters and backend code. This overhaul used fixture requests only; the historical live walkthrough below was not rerun, no real identities were mutated, and no database setup/migrations/deployment occurred. Each distinct page/component set was committed during implementation. All audit-owned foreground Vite/browser resources closed; the final process inspection found only the same pre-existing API watcher/child and Vite process observed before work.

Final local delivery (2026-10-01): 54 frontend behavior tests and 76 backend tests pass alongside aggregate typecheck, lint, formatting and static build. The emitted-asset scan found no server-only markers or configured credential values. Tests cover safe cookie/CSRF/204 boundaries, malformed responses, no mutation retry, login failures including rate limits/network, protected restoration/expiry/denial/unavailable states, stale successful and failed responses, private cache cleanup, recovery/uncertain-reset handling, both creation policies, uncertain creation across navigation, action confirmations/restrictions/partial outcomes, history, health and copy success/fallback. Source review confirmed thin views and feature-hook/shared-client orchestration.

The bounded desktop (1440×1000), mobile (390×844), reduced-motion and keyboard review used controlled fixtures. Material fixes made empty/missing titles accessible headings, wide tables keyboard-scrollable with visible focus, and dialog focus return explicit. The confirmation pass checked mobile width/drawer/Escape, first-invalid-field focus, dialog focus return, missing routes, empty/error separation and uncertain feedback across navigation. Screenshots remain ignored under `artifacts/web-review/` and contain fixtures only. Default neutral shadcn tokens provide text alongside status colors.

The foreground `scripts/verify-local-web.ts --live` browser walkthrough passed all 16 endpoint flows: cookie/CORS login and reload restoration/account, both creation policies, list/details, ban/unban/permanent deletion and later missing details, last-usable-operator refusal, disabled-deletion preservation, ordinary-account denial, durable history, all three health reads, Mailpit request/email navigation/real backend callback/reset 204/new-password login/logout. Existing GoTrue, Mailpit and restricted-role admin storage were used; no setup SQL or infrastructure startup occurred. Temporary listeners 3101/3102 use process-only disposable allowlist/deletion settings; the browser rewrites only GoTrue's verification-response callback origin to 3101, preserving same-browser cookies. This is local integration evidence, not proof of production callback configuration. Owned identities/mail/browser/listeners were removed/closed; durable audit remains, real operator configuration is unchanged and user-owned services remain running.

Final corrections/verification commit: `1912c46`. Separate production hosting/cookie/mail checks, platform-reference reconciliation and natural upstream email-link expiry remain unchecked below. Backend callback failures still return the documented safe API response rather than a branded SPA error redirect. Static output currently has a roughly 784 kB JavaScript chunk (about 252 kB gzip); Vite warns about chunk size. It requires no frontend application server. Rollup also removes two malformed pure annotations in the pinned Zod dependency; compilation succeeds without editing dependencies.

History/status (2026-10-01): paginated durable history renders all four outcomes, unresolved labels, nullable fields, copyable audit/request/actor/target IDs and target inspection links. Service status makes all three health reads independently with last-check timestamps and explicit refresh; readiness/unavailable status bodies remain distinct from errors. Forty-one frontend tests, typecheck, lint and static build passed. Management commit: `8c86f4e`. History/status commit: `efc88ab`. All screens are implemented; bounded browser review, complete endpoint proof, broad repository checks and live controlled walkthrough remain to complete.

Management actions (2026-10-01): Base UI Alert Dialog confirmations identify target and global impact; ban has bounded whole-hour validation; exact confirmations are owned by the API feature client. Session-scoped hook/context state preserves pending/uncertain feedback across overlays and routes, disables ordinary repeats, and clears on session changes. Confirmed deletion returns to Users; successful actions invalidate reads/history. Thirty-eight frontend tests, typecheck, lint and static build passed. Action tests cover cancel/no request, duration, duplicate clicks, disabled deletion/last operator/contention/reconciliation and qualified audit-completion failure. No live account action has been performed yet. Browse/create commit: `848cc15`. Management commit: `8c86f4e`.

Users/browse/create (2026-10-01): safe paginated list, invalid URL defaults, details/missing destinations, copyable UUIDs, inspectable ISO timestamps, null/unknown fields and explicit creation policies are implemented. Thirty frontend tests passed, including bounded page parsing, read failure distinct from empty, absent details, both confirmation policies/exact payloads and uncertain-create repeat blocking. Typecheck/lint/static build passed. No live users were changed. Recovery commit: `6b6e22b`. Browse/create phase commit: `848cc15`.

Recovery (2026-10-01): public forgot/reset routes, generic acknowledgement, same-browser/newest-email and local Mailpit guidance, UTF-8 password limits, local confirmation and exact password-only reset payload are implemented. Twenty-three frontend tests passed, including 204 cache cleanup, invalid context, unknown update and failed-completion feedback with blocked repeat and cleared passwords. Typecheck/lint/static build passed. Base UI link composition warnings were corrected and the 23 tests rerun successfully. Live Mailpit callback navigation remains unverified. Session commit: `ee83edd`. Recovery phase commit: `6b6e22b`.

Session/account (2026-10-01): thin login/account views, responsive generated Sidebar/Sheet, public-origin login, account UUID/email/expiry and logout are implemented. Seventeen frontend tests passed, including existing-password validation, internal return routes, denied login/password clearing, failed logout with retained session, confirmed logout/cache clearing and stale-response/session-loss generation checks. Frontend typecheck, repository lint and static build passed. Browser focus/layout and real cookie/CORS checks remain pending. Foundation commit: `07c117e`. Session phase commit: `ee83edd`.

Foundation (2026-10-01): Vite 7.3.6/React 19.3.0 with strict browser TypeScript, Tailwind 4.3.3 and official shadcn 4.21.0 Base UI `base-nova` generation. Package versions are pinned. Frontend typecheck, repository lint, static build and 11 API-boundary tests passed. Tests establish cookie/CSRF/DELETE configuration, 204 handling, response stripping/validation, safe partial metadata, network uncertainty/no retry, health 503 handling and public-origin validation. React Hooks lint rules and separate browser tests are integrated into root checks. Setup is documented in `apps/gotrue-admin-web/README.md`. No database, infrastructure or deployment actions occurred. Screen/browser verification remains pending. Phase commit: `07c117e`.

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
- [x] Tailwind and generated shadcn controls share consistent default tokens and interaction states.
- [x] Component-map controls, including Field/Empty/Spinner/Input Group, are used where appropriate with consistent current primitive APIs.
- [x] Public API configuration is validated/documented; no secrets or backend environment imports reach the frontend.
- [x] Shared Axios requests implement cookies, exact CSRF/body fields, bounded timeout, cancellation and safe response validation.
- [x] Public login/recovery and protected Users/create/details/History/Status/Account routes work on navigation/reload.
- [x] Unknown routes have a useful not-found screen; navigation works on desktop/mobile and by keyboard.
- [x] Views only render presentation and bind hook callbacks; business/request/effect/form/navigation behavior lives in hooks or shared boundaries.

## Sign-in, session and account

- [x] Sign-in validates the existing-password contract, blocks repeated pending submission and handles bad credentials/ordinary-account denial.
- [x] Login rate-limit and dependency/network failures have safe visible feedback.
- [x] Successful login opens Users; account displays safe UUID/email/expiry and copy feedback/fallback.
- [x] Reload restores an eligible session with loading UI and no private-content flash.
- [x] Expiry/protected 401 clears private state and requires sign-in without automatic refresh.
- [x] Protected 403 blocks access; bootstrap 503 shows unavailable without claiming logout or granting access.
- [x] Late old-session responses cannot repopulate caches after logout/reset/session loss/different-account login.
- [x] Confirmed logout handles 204 and clears private state; failed invalidation remains visible with deliberate retry.
- [x] Return navigation stays within safe internal destinations.

## Forgot/reset password

- [x] Valid recovery email receives generic acknowledgement without account disclosure or a delivery promise.
- [x] Same-browser/newest-email instructions and clearly local Mailpit guidance are available.
- [x] Email navigation reaches the backend callback and SPA reset page without frontend code/token exchange or storage.
- [x] Reset validates UTF-8 password limits and local confirmation, sending only the allowed password field.
- [x] Pending, field errors, rate limits and missing/expired/consumed/ineligible context have corresponding UI.
- [x] Direct reset-page access does not invent a status endpoint or grant a management session.
- [x] Reset 204 clears private state and requires ordinary sign-in.
- [x] Unknown reset outcome/failed cleanup explains what is known and offers sign-in/trusted help, never automatic repeat.
- [x] Recovery remains accessible during existing-session problems; secrets never enter storage/telemetry/support reports.

## User list and details

- [x] Users renders safe fields, readable status labels and copyable UUID/detail links.
- [x] Page/page-size and URL parameters respect backend bounds; Previous/Next invent no totals or global search.
- [x] Initial loading, background refresh, real data, empty page and failed request render differently.
- [x] Details shows available confirmation/creation/last-sign-in/ban data and honest null/unknown values.
- [x] Invalid/missing/deleted destinations show safe feedback and return to Users.
- [x] Long emails/IDs and wide tables remain usable at mobile widths without hiding essential fields.

## Create user

- [x] Email/password and explicit confirmation policy use backend-aligned validation.
- [x] Operator confirmation explains bypassing ownership verification; unconfirmed creation explains its limitations.
- [x] Neither policy falsely claims invitation/confirmation email was sent.
- [x] Pending, validation, duplicate and dependency failures have corresponding UI and no duplicate submission.
- [x] Confirmed creation shows safe returned details and refreshes affected reads/history without retaining the password.
- [x] Uncertain creation preserves safe support IDs and offers read-only inspection instead of silent repetition.

## Ban and unban

- [x] Confirmations identify target UUID/email and shared-account impact; cancel sends no request.
- [x] Ban validates bounded integer duration and exact matching-target confirmation; unban is explicitly confirmed.
- [x] Pending/success/unavailable/denied states render correctly; confirmed outcomes refresh details/list/history.
- [x] Last-operator/contention/reconciliation failures explain safe next steps without inventing an operator roster.
- [x] Token/session messaging does not promise universal revocation.
- [x] Unknown/partial outcomes preserve IDs, block ordinary resubmission and offer read-only inspection.

## Permanent deletion

- [x] Destructive confirmation identifies exact UUID/available email and permanent global effect; cancel sends no request.
- [x] DELETE sends required JSON confirmation/target and blocks repeat pending submission.
- [x] Disabled deletion/last-operator refusal preserves the target and explains the backend restriction.
- [x] Confirmed success leaves removed details and refreshes Users/history; later 404 renders as missing/already deleted.
- [x] Unknown/network/partial failure claims no rollback and never automatically repeats deletion.
- [x] Control visibility or guessed capability/role data never overrides backend authority.

## Action history

- [x] Bounded pages show real actor/target/action/outcome/timestamps and safe audit/request IDs.
- [x] Pending/succeeded/failed/unknown are textually and visually distinct; unresolved records never appear completed.
- [x] Null fields and deleted-target links render honestly.
- [x] Loading/refresh/empty/session-failure/read-error states are complete.
- [x] Safe IDs are copyable; no frontend reconciliation or retry mutation is invented.

## Service status

- [x] API liveness, combined readiness and protected GoTrue reachability/version are separate results.
- [x] Each check has loading, last-check time, success, unavailable/network failure and deliberate refresh.
- [x] Health 503 status objects are handled without assuming an error envelope.
- [x] Health does not falsely prove email/login/database behavior; no fabricated metrics or infrastructure controls appear.

## All endpoint integrations

Verify feature calls and browser navigation against actual route modules and the API reference:

- [x] GET `/health/live` — liveness.
- [x] GET `/health/ready` — combined readiness.
- [x] POST `/v1/operator/auth/login` — sign-in.
- [x] GET `/v1/operator/auth/me` — restoration/account.
- [x] POST `/v1/operator/auth/logout` — logout.
- [x] POST `/v1/operator/auth/forgot-password` — recovery request.
- [x] GET `/v1/operator/auth/recovery/callback` — email/browser navigation through the backend.
- [x] POST `/v1/operator/auth/reset-password` — reset submission.
- [x] GET `/v1/operator/users` — paginated browsing.
- [x] GET `/v1/operator/users/:id` — details/refresh.
- [x] POST `/v1/operator/users` — account creation.
- [x] POST `/v1/operator/users/:id/ban` — bounded ban.
- [x] POST `/v1/operator/users/:id/unban` — unban.
- [x] DELETE `/v1/operator/users/:id` — permanent deletion.
- [x] GET `/v1/operator/audit` — paginated history.
- [x] GET `/v1/operator/health` — protected upstream status/version.

## UI states, accessibility and safety

- [x] Loading/refreshing/empty/loaded/success/validation/not-found/denied/expired-session states are checked where applicable.
- [x] Rate-limited/dependency/network/disabled/pending/unknown/partial states are checked where applicable.
- [x] Labels, field errors, first-error focus, keyboard access, visible focus and status announcements work.
- [x] Dialog descriptions/focus return/cancel behavior work; pending closure never implies backend cancellation or loses outcome feedback.
- [x] Status does not depend on color alone; contrast and reduced motion are verified.
- [x] 204 is not parsed as JSON; callback 303 remains browser navigation.
- [x] Mutation errors never retry automatically; read failure never becomes empty data and retries are deliberate.
- [x] Secret-bearing forms/mutation variables are cleared appropriately; private caches are isolated and not persisted.
- [x] Copy success/failure and unsupported clipboard access have useful feedback/fallback.

## Verification and delivery

- [x] Behavior tests cover session transitions, forms, request boundaries and applicable UI states.
- [x] Frontend/repository typecheck, lint, formatting and static build pass without breaking affected backend checks.
- [x] Emitted frontend assets contain no privileged credentials or server-only dependencies.
- [x] Batched desktop/mobile/keyboard review passes and material fixes are confirmed.
- [x] Controlled browser walkthrough verifies login/account/logout and same-browser Mailpit recovery/reset/new-password login.
- [x] Controlled browser walkthrough verifies create/list/details/ban/unban/delete/history and last-operator/disabled feedback.
- [x] All 16 endpoints are integrated and verified at intended scope; unavailable checks remain recorded.
- [x] Setup README, phase evidence and delivery status reflect actual implementation.
- [x] Completed phases are committed; agent-owned foreground servers are stopped and attributable leftovers checked.

## Separate launch prerequisites

These remain separate from local implementation:

- [ ] Production static hosting serves direct SPA routes, including reset-password, under the agreed same-site HTTPS origin.
- [ ] Production API origins/cookies and real recovery email are verified before launch.
- [ ] Platform-reference reconciliation is reviewed before enabling permanent deletion for production identities.
- [ ] Remaining natural GoTrue email-link expiry verification is recorded honestly.

Do not add deferred features as implicit V1 requirements. Follow the requirements document's deferred scope.
