# Operator frontend implementation plan

Status: documentation complete; frontend implementation has not started. This plan describes the work to perform after the documentation phase. Each phase is committed after its applicable checks; a planned check is not a passed check.

Read [requirements](frontend-requirements.md) for features and the complete 16-endpoint mapping, [architecture](frontend-architecture.md) for the agreed stack and hook/view boundaries, [API reference](api.md) for contracts, and [AGENTS.md](../../AGENTS.md) for delivery rules. This plan owns sequencing, decisions and acceptance gates rather than repeating endpoint schemas.

## Decisions carried into implementation

- React/TypeScript/Vite browser SPA with shadcn components/default tokens, Tailwind, Axios, React Router, TanStack Query and React Hook Form/Zod.
- Keep generated shadcn UI components separate from feature hooks and views. Use feature hooks for behavior, not page effects or ad hoc fetches in JSX.
- Users is the initial protected destination. Public routes are login, forgot-password and reset-password; protected routes are users, create user, user detail, history, status and account. Unknown routes have a useful not-found view. Recovery is accessible even if an old operator session exists.
- Use shadcn Table and server pagination initially. No global search, bulk actions or simulated metrics. TanStack Table is deferred until the interface requires richer column behavior.
- Render the delete action with explicit destructive confirmation; handle `DELETION_DISABLED` from the backend. No new capability endpoint or guessed environment flag is required to implement V1.
- Keep the existing backend callback navigation and error contract. The reset screen handles its own failures; branded backend callback errors require a separately documented backend change.
- Use generic rate-limit feedback under current CORS. Exposing Retry-After for a precise countdown is optional future API work.
- Add Lucide for icons and Sonner only as supplemental feedback. Persistent mutation results and errors remain visible and accessible.

## Phase 1: workspace and shared boundaries

Prepare `apps/gotrue-admin-web` in the existing pnpm workspace, pin compatible versions, configure strict browser TypeScript, Vite/Tailwind and React lint rules, and preserve the backend's existing commands. Add clearly named frontend dev/build/typecheck/test commands and integrate the app into aggregate checks without starting background servers.

Create the public configuration example and frontend setup README. Configure strict local port 5173, API-origin validation, static build output, import aliases and the generated shadcn components actually needed. No deployment is performed.

Build the shared Axios client and safe boundary schemas, query keys/client, feedback views, pagination presentation and pure date/identifier helpers. Handle cookie/CSRF requests, cancellation, 204, health status bodies and common safe errors. Define mutation outcome handling before feature calls.

Acceptance:

- Frontend dependencies install normally, without force/recreating node_modules. Typecheck/lint/static build succeed with the pinned runtime.
- Client checks cover credentials, exact mutation headers/fields, empty 204, safe malformed responses and unknown network failures. No raw errors or privileged environment imports reach the frontend.
- Views contain no API calls/effects/business orchestration; UI primitives and feedback states remain independently reusable.

Commit this working foundation before adding feature flows.

## Phase 2: session, shell and account

Implement session restoration and a protected-route hook with loading, unauthenticated, denied and unavailable states. Configure cache isolation/cancellation and stale-response protection. Build responsive shadcn navigation and the current-account view from safe operator data.

Implement login and logout through feature hooks. Preserve only safe internal return destinations. Validate fields with the actual login contract; do not incorrectly apply new-password rules to an existing password. Handle invalid credentials, ordinary-account denial, rate limits and dependency failures. Logout failure must remain visible without claiming invalidation. Clear private caches after confirmed logout/session loss and expire local display state without refresh tokens.

Acceptance:

- Reload restores a real eligible session; failed restoration never flashes private user data.
- Login denial does not establish a frontend session. Protected requests that lose authority clear private state; a late old-session response cannot repopulate it.
- Account shows ID/email/expiry with copy feedback. Logout succeeds, fails and retries honestly. Navigation works by keyboard and at mobile width.

Commit the session/account flow with its state tests.

## Phase 3: password recovery

Implement forgot-password and reset-password hooks/forms. Send only allowed payloads. Show the generic acknowledgement and same-browser/newest-email instructions. Use local-only Mailpit guidance where appropriate.

Support the backend email callback redirect to `/reset-password` without fetching or persisting callback codes in the SPA. There is no recovery-status endpoint; a direct visit may render the form but submission validates context. Compare password confirmation locally and enforce the backend's UTF-8 limit.

On 204 require ordinary sign-in and clear private state. Invalid/expired/consumed context offers a fresh recovery flow. Uncertain reset/cleanup failures explain what is known and direct the user to sign-in or trusted help; they do not repeat the reset.

Acceptance:

- Test generic responses, field mismatch/byte limits, pending submission, invalid context, rate limits, network and partial-outcome UI, and 204 handling.
- Run controlled same-browser Mailpit recovery through the backend callback into the reset page, then normal login; do not use an existing real operator for destructive tests.
- Recovery values/passwords do not enter storage, analytics, URLs generated by the SPA or error reports. Public recovery views remain accessible during session failures.

Commit recovery once the implemented behavior and checks are recorded.

## Phase 4: user browsing and creation

Implement `useUsersPage`, detail loading and create-user form orchestration with corresponding views. Parse bounded page/page-size parameters in hooks, use server pagination and preserve each list state. Users and detail views display only the safe fields, with honest null/unknown values and copyable UUIDs.

Create-user requires an explicit confirmation policy and explanatory copy about bypassing verification or creating an unconfirmed account without email. Handle validation/duplicate/unavailable and uncertain results; disable pending submissions and release password state after use. On confirmed success use the returned user and invalidate the relevant reads.

Acceptance:

- Users/history-style pagination does not invent totals or advertise global filtering. Invalid URL pagination is safely normalized or shown as invalid before requests.
- Empty and failed list loads differ; missing/deleted details show not-found. Background refresh retains only the current session's valid data.
- Both creation policies are testable through the UI, with no false invitation message. Duplicate and unknown outcomes do not silently repeat creation.

Commit browse/details/create together as a complete flow.

## Phase 5: confirmed management actions

Implement a user-action hook for ban, unban and delete, with separate validation and exact confirmation payloads. Use shadcn confirmation dialogs for protected destructive focus. Identify target UUID/email and global effect; ban duration is bounded, and unban is explicit.

Treat success, denied/disabled, last-operator refusal, contention, reconciliation-required and ambiguous/completion-failure results independently. Keep a pending/uncertain action's result accessible across dialog closure. Do not use optimistic deletion or fake history to conceal an unknown outcome. After confirmed deletion leave its detail view and refresh the current list/history. Cancel sends no request.

Acceptance:

- Tests cover cancel, target matching, duration limits, repeated-click suppression, each refusal state, no automatic mutation retry and safe support identifiers.
- A controlled browser walkthrough creates, bans/unbans and permanently deletes disposable accounts; disabled deletion is also exercised without changing backend configuration for the test.
- Last-operator feedback explains the backend restriction; the frontend does not infer eligibility or invent an operator roster.

Commit completed management actions and evidence.

## Phase 6: history and service status

Implement paginated durable action history with explicit pending/succeeded/failed/unknown outcomes, safe actor/target/audit/request identifiers and timestamps. A target link may legitimately lead to not-found after deletion. No frontend reconciliation mutation exists.

Implement all three health reads through a status hook: public API liveness, combined dependency readiness and protected GoTrue reachability/version. Present each result/loading/error/last-check time and allow deliberate refresh. Session loss remains an auth event, not a fake unhealthy service response. Health is not proof of email delivery.

Acceptance:

- Audit pagination, empty/history failures and nullable target/completion fields render honestly. Unresolved outcomes remain visibly unresolved.
- Each health endpoint is called by its intended view; liveness versus readiness and protected version remain distinguishable under failure.
- All reads are bounded and retry deliberately; safe health status bodies are parsed without assuming an error envelope.

Commit history and status.

## Phase 7: complete UI verification and delivery

Run frontend behavior tests, repository lint/format/type checks and static production build. Inspect the emitted frontend assets for accidental server credentials/imports using safe checks that do not print secrets. Backend tests must remain passing when shared tooling changes affect them.

Use a single batched desktop/mobile visual and keyboard review, correct material findings together, then confirm the fixes. Inspect loading, empty, failure, denied, expired-session, missing, mutation-pending and ambiguous states with clearly labeled controlled fixtures in tests; do not ship fake accounts/results as production behavior.

Complete the frontend requirements' acceptance scenarios and all 16 endpoint mappings. Verify real cookie/CORS integration, public recovery navigation, account/cache cleanup and the controlled create/list/detail/ban/unban/delete/history flow. Stop every foreground server started for this work and check attributable process leftovers; leave user-owned services alone.

Record exactly what passed in the [frontend checklist](frontend-checklist.md) and update overall product status in the [delivery checklist](checklist.md), update setup instructions, and commit the verified result. Keep production deployment, natural GoTrue email-link expiry, platform-reference reconciliation and any unavailable live checks explicitly separate. A successful build alone does not complete this phase.

## Completion evidence

| Deliverable                      | Evidence required                                                                                 |
| -------------------------------- | ------------------------------------------------------------------------------------------------- |
| Agreed stack and layering        | Manifest/config plus source showing thin views, feature hooks and shared API client               |
| Every existing endpoint used     | Requirements' 16-row mapping matched to actual feature calls or recovery navigation               |
| Complete states                  | Behavior tests and rendered desktop/mobile states for applicable screen outcomes                  |
| Safe session and form boundaries | Auth/cache/CSRF/validation tests plus controlled browser cookie walkthrough                       |
| Real management and recovery UI  | Disposable-account live browser results, including no false success on uncertain outcomes         |
| Usable interface                 | Shadcn controls, semantic labels, focus/keyboard checks, responsive data/form review              |
| Static delivery                  | Build/type/lint/format results, setup README, no server runtime or secret-bearing frontend config |
| Phase commits                    | Committed verified work, preserved unrelated changes, clean attributable process cleanup          |

This plan does not authorize database setup execution, infrastructure startup/migrations, deployment or changing existing endpoint behavior as an incidental frontend fix. If a genuine integration gap appears, first document the concrete contract change and its validation, then work within the user's authorization and project rules.
