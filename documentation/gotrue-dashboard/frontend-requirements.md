# GoTrue operator frontend requirements

Status: implemented in `apps/gotrue-admin-web`. The [frontend checklist](frontend-checklist.md) records local test/browser evidence and separate launch prerequisites. The stack and hook/view boundaries are agreed in [frontend architecture](frontend-architecture.md). [Implementation plan](frontend-implementation-plan.md) defines the phases and acceptance gates. Use shadcn components and default styling, as requested by the user.

This document owns screens, interactions and frontend usage of the existing backend. [Product features](features.md) owns V1 scope; [API reference](api.md) owns exact request/response contracts, validation, cookies and error codes. [Delivery checklist](checklist.md) records verified implementation. If a contract changes, update the API reference first and adjust this document's usage mapping.

## Purpose and boundaries

Give trusted operators a dashboard for global accounts in the shared GoTrue identity pool: sign in, recover their password, browse users, create accounts, ban/unban, permanently delete when enabled, inspect action history and check service health.

The frontend calls `gotrue-admin-api`. It never holds a GoTrue admin token, database credentials, session encryption key or GoTrue signing secret. Operator authority is enforced by the API; hiding a control is only a usability measure. No public operator signup or role editor is included.

## Screens and navigation

React Router destinations are listed below. Creation opens a Users dialog; `/users/new` redirects to Users and opens it, preserving pagination. Current verification and final SMTP setup belong in [GoTrue status](status.md). Protected screens share navigation to Dashboard, Users, Action history, Service status and Current account, plus Logout. Users is the default destination after sign-in. Dashboard uses bounded snapshots.

| Screen          | Browser path         | Required content                                                                   |
| --------------- | -------------------- | ---------------------------------------------------------------------------------- |
| Sign in         | `/login`             | Email/password form, safe failures, link to password recovery                      |
| Forgot password | `/forgot-password`   | Email form, generic acknowledgement, same-browser instructions                     |
| Reset password  | `/reset-password`    | New password and confirmation, expired/invalid context guidance, return to sign-in |
| Dashboard       | `/dashboard`         | Bounded user/audit snapshots, charts, recent attempts and health signals           |
| Users           | `/users`             | Paginated safe account table, create action, detail links                          |
| User details    | `/users/:id`         | Account information and confirmation flows for ban, unban and permanent deletion   |
| Create user     | Dialog from `/users` | Email/password/explicit policy; `/users/new` compatibility redirect                |
| Action history  | `/history`           | Paginated durable management attempts, outcomes and safe support identifiers       |
| Service status  | `/status`            | API liveness, dependency readiness and protected GoTrue version/reachability       |
| Current account | `/account`           | Signed-in operator UUID/email, session expiry and Logout                           |

## Complete endpoint coverage

Every current backend endpoint has a frontend use below. A recovery callback is used by browser navigation through the email flow; it must not be treated as an extra frontend JSON request. No endpoint needs to be called merely to tick a coverage box.

| Method | Backend endpoint                      | Frontend feature and trigger                                                                   | Expected handling                                                                                                            |
| ------ | ------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/health/live`                        | Service status; optional connection troubleshooting from sign-in                               | Show API reachable on 200; distinguish network failure from an HTTP failure                                                  |
| GET    | `/health/ready`                       | Service status and explicit retry of unavailable-backend diagnostics                           | Show dependencies ready on 200, unavailable on 503; no detailed connection information                                       |
| POST   | `/v1/operator/auth/login`             | Submit sign-in form                                                                            | On 200 use returned operator/expiry and browser cookie; open Users                                                           |
| GET    | `/v1/operator/auth/me`                | Restore session on app entry/reload, open current-account view, recheck after suspected expiry | Use operator UUID/email and expiry; 401 requires sign-in, 403 blocks access, 503 is a dependency failure                     |
| POST   | `/v1/operator/auth/logout`            | Select Logout                                                                                  | On 204 clear frontend account/user/history state and open sign-in; failed invalidation must not be reported as success       |
| POST   | `/v1/operator/auth/forgot-password`   | Submit recovery email                                                                          | On 202 display the same generic acknowledgement for every valid email; do not promise delivery                               |
| GET    | `/v1/operator/auth/recovery/callback` | Browser follows the email's GoTrue verification link and is redirected to this backend route   | API consumes same-browser proof and redirects with 303 to configured reset page; frontend never exchanges or stores the code |
| POST   | `/v1/operator/auth/reset-password`    | Submit matching new-password fields from reset page                                            | On 204 clear frontend session state and require normal sign-in; show invalid/consumed/expired and uncertain-outcome states   |
| GET    | `/v1/operator/users`                  | Open Users, change page/page size, explicitly refresh after mutations                          | Render `users`, `page`, `perPage`, `hasNextPage`; a failure is not an empty list                                             |
| GET    | `/v1/operator/users/:id`              | Open a user or refresh details after a mutation                                                | Render safe fields; 404 means missing/deleted, not a blank successful record                                                 |
| POST   | `/v1/operator/users`                  | Confirm create-user form                                                                       | On 201 show returned user, retain safe audit ID for result/support, refresh the current list                                 |
| POST   | `/v1/operator/users/:id/ban`          | Confirm a target and duration                                                                  | On 200 update account status and history; handle last-operator, contention and uncertain outcomes                            |
| POST   | `/v1/operator/users/:id/unban`        | Confirm restoring a target's access                                                            | On 200 update details/list/history; no automatic repeated mutation                                                           |
| DELETE | `/v1/operator/users/:id`              | Explicitly confirm permanent global deletion                                                   | On 200 leave removed details and refresh Users/history; handle disabled deletion, last-operator and uncertain outcomes       |
| GET    | `/v1/operator/audit`                  | Open Action history, change page, refresh after an action                                      | Render safe entries and pagination; retain pending/unknown distinction                                                       |
| GET    | `/v1/operator/health`                 | Open or manually refresh Service status while authenticated                                    | Show GoTrue reachability/version; 503 can carry `{status: "unavailable", version: null}` rather than a common error envelope |

## Account and session behavior

- Sign-in takes email and password only. Do not ask for an operator UUID, admin token or database account. UUID eligibility was configured on the backend.
- Keep the initial session check visibly loading. A 503 from `auth/me` is not proof that the user is signed out; show an unavailable state and allow a read retry without granting protected access.
- Populate the account view from `auth/me` and login responses, never from editable browser metadata. Show expiry in the user's locale. Sessions expire without automatic refresh; no refresh endpoint exists.
- On an authenticated request's 401, clear sensitive frontend data and require sign-in. Login's 401 means failed credentials instead. Explain eligibility denial on protected 403 without treating every 403 as expiry; mutation 403 can also mean Origin/CSRF failure or disabled deletion.
- Clear passwords after submission/response as appropriate; never persist them in storage, logs, URLs or telemetry. Logout failure needs an honest message and deliberate retry.
- Preserve a safe internal return destination when appropriate; never accept an arbitrary external redirect from query parameters.

## Password recovery

1. Request recovery from the configured frontend origin and preserve cookies. Display the generic acknowledgement with instructions to open the newest email in the same browser/profile. Guidance is provider-neutral, including on localhost. Explicit Mailpit capture setup and final Resend setup live in [local infrastructure](../../infrastructure/local/README.md).
2. The browser follows the email link to GoTrue, which redirects to the backend callback. The backend performs PKCE exchange and redirects to `RECOVERY_RESET_URL`, locally `http://localhost:5173/reset-password`. Ordinary application API requests continue to go only to our API; the email verification navigation is part of GoTrue's recovery flow.
3. Present new-password and confirmation inputs. Compare confirmation locally and send only `{password}`; there is no confirmation field in the API contract. Apply the referenced new-password limits and explain them before submission.
4. Successful reset returns 204. Clear frontend session data, explain that normal sign-in is required and link to `/login`. Do not automatically log in or grant operator access.
5. Missing/expired/consumed/ineligible context returns `INVALID_RECOVERY`; offer a fresh recovery request. The API has no recovery-status endpoint: rendering the reset form does not prove that its cookie/context is valid, and a mutation must not be used as a preflight.
6. For `PASSWORD_RESET_OUTCOME_UNKNOWN`, explain that the password may have changed and direct the user to ordinary sign-in or trusted assistance. For `PASSWORD_RESET_COMPLETION_FAILED`, explain that the password changed but local cleanup was not confirmed. Neither state should offer an automatic repeat of reset.

Backend callback failures currently return safe API errors rather than redirecting to a frontend error page. Do not promise that the UI can intercept every expired email-link navigation. If a branded callback-error page is desired later, document the required backend redirect contract change in the implementation plan. The reset screen itself must handle its API failures. Keep recovery destinations free of analytics that might capture codes or token-bearing links; never copy such values into frontend storage or support reports.

## Users and management actions

### Browse and details

Show UUID, email, email-confirmation information, creation time, available last-sign-in, ban state and ban expiry from safe API fields. Represent null/unknown values as unavailable; do not invent dates or interpret unknown status as active/verified. Provide readable local dates with an unambiguous timestamp available for inspection, copyable UUIDs and keyboard-accessible detail links.

Use page 1 initially and backend pagination limits/defaults from the API reference. Previous is available only above page 1; Next depends on `hasNextPage` and the maximum page bound. Do not invent a total count or total pages. Page contents may shift during concurrent changes. Loading, empty, failed, missing-user and successful states must be distinct. Global search and arbitrary server-side filters are deferred.

### Create

Require email/password and a deliberate choice between `require_verification` and `operator_confirmed`. Explain that operator confirmation bypasses email ownership verification. Both options create an account without sending an invitation/confirmation email; an unconfirmed account remains unable to complete normal verified login until a supported verification flow exists. Do not add resend/invite buttons.

Open the shadcn Dialog from the Users header or empty-state action, keeping the current table/page/pagination behind it. The breadcrumb remains Users. Provide an accessible title/description, focus trap, first-invalid-field focus and return to the initiating button (or header action for legacy navigation). Long content scrolls within the mobile viewport.

Validate using API limits, keep server validation authoritative and show duplicate/rate-limit/dependency failures. During submission, disable Cancel and repeat submission and block Escape/backdrop dismissal. Explain that navigating away does not cancel or undo creation. Clear the password when the request starts, after completion, on idle close and on route/session loss; reset visibility too.

Creation state lives above routes for the current session. Pending and uncertain/partial outcomes stay blocked through close/reopen/navigation with safe audit/request IDs and read-only history inspection. Closing a confirmed result retains it; only an intentional Create another user action resets the successful form/policy. Success shows safe details, offers Open account and refreshes Users/history/dashboard reads. Session loss clears this state and rejects stale responses. Never retain a password in result/history or claim email delivery.

### Ban and unban

Before submission identify the target UUID/email and explain global impact across applications. Ban requires an integer duration of 1–8760 hours and sends the exact `BAN_GLOBAL_USER` confirmation plus matching `targetId`; offer bounded duration choices or an integer field, not an unsupported indefinite ban. Unban sends `UNBAN_GLOBAL_USER` and matching `targetId` after confirmation.

Update displayed status only after a confirmed result, then re-read affected views as needed. Do not promise universal token revocation. Explain `LAST_USABLE_OPERATOR`: another configured usable operator must have signed in before the target can be removed. The browser cannot determine all operator eligibility from the user list, and no operator-roster endpoint exists.

### Permanent delete

Use a distinct destructive confirmation showing UUID and available email, explaining permanent shared-identity deletion. Send `DELETE_GLOBAL_USER_PERMANENTLY` and matching `targetId` in the DELETE JSON body. Cancel closes the confirmation without a request.

The backend can return `DELETION_DISABLED`. Show that deletion is unavailable and retain the user record; do not issue deletion as a capability check. No capabilities/settings endpoint exists, so any initial UI availability configuration is a later planning decision and never overrides backend enforcement. Production platform-reference reconciliation remains a launch prerequisite.

For confirmed deletion, remove the target from the visible view, refresh the list/history and leave details. A subsequent 404 is missing/already deleted, not evidence that an earlier uncertain action succeeded. Do not silently retry destructive requests.

## Action history and service status

Action history shows actor UUID, target UUID when known, action, outcome, creation/completion timestamps and request ID. Provide copyable safe IDs and a detail link when a target exists; that link can legitimately return 404 after deletion. No actor-profile lookup, email search, filters or audit-detail endpoint is promised.

Display `pending`, `succeeded`, `failed` and `unknown` distinctly. Pending and unknown are unresolved, not successful or definitely failed. Explain that reconciliation is handled by a trusted administrator; no frontend retry/reconciliation button can update audit records. Use bounded pagination and explicit refresh. Do not create fake frontend audit entries as durable evidence.

Service status distinguishes three results: API liveness, combined GoTrue/admin-storage readiness, and authenticated GoTrue reachability/version. Include loading, last-check time, unavailable and manual retry states. A successful health result is not proof that email delivery or sign-in works. Do not expose database URLs, server environment controls, Docker commands or fabricated metrics.

## Shared request and feedback requirements

- Read the public API base URL from frontend configuration. Local frontend origin is `http://localhost:5173` and API base is `http://localhost:3100`; keep hostname usage consistent. Frontend configuration never contains secrets.
- Send `credentials: 'include'` for API requests. The browser manages HttpOnly cookies; do not read them in JavaScript, copy them to local storage or add an Authorization token.
- For every POST/DELETE, send `X-CSRF-Protection: 1`; send `Content-Type: application/json` when a JSON body is required. The browser supplies Origin. Follow the exact request fields in the API reference, with no arbitrary forwarding.
- Handle 204 without parsing JSON. The recovery callback's 303 is navigation, not an ordinary JSON response. Health 503 bodies may be status objects; other failures normally use the common error envelope.
- Offer bounded read retries and explicit refresh. Disable duplicate mutation submissions while pending; do not automatically retry POST/DELETE after network failures, timeouts or partial outcomes. Aborting a browser request does not prove that a server mutation was cancelled.
- For 429, show a retry-later state. The backend sends `Retry-After`, but current cross-origin CORS exposes only `X-Request-ID`; a precise header-based countdown would require an explicit backend CORS change later. Do not assume that header is currently readable by frontend JavaScript.
- For `AUDIT_COMPLETION_FAILED` and `UPSTREAM_OUTCOME_UNKNOWN`, preserve safe `auditId`, `outcome` and `requestId`, explain what is known, and offer read-only inspection/history. Even an error response can mean the action applied. Do not show rollback or ordinary success without qualification.
- Explain `MUTATION_IN_PROGRESS` as an active conflicting operation and `RECONCILIATION_REQUIRED` as unresolved history requiring trusted assistance. Refresh reads deliberately; do not turn conflict handling into a mutation retry loop.
- Show field errors beside controls and global/dependency failures visibly. Announce asynchronous results accessibly, move focus sensibly in dialogs, provide keyboard access, and keep success/failure messages readable without color alone. Tables must remain usable on narrow screens.
- Keep passwords, cookies, credentials and recovery URL values out of logs, analytics, error capture, URLs and persistent caches. Clear account-specific state on logout, session loss and successful reset. Production origin/cookie requirements remain owned by the API reference and shared deployment document.

## Acceptance scenarios

### Requested dashboard extension (implemented, 2026-10-01)

The user requested shadcn analytics during UI polish. Add a protected `/dashboard` view using only existing read contracts: first Users page (20 records), first Audit page (20 records), and the three health signals. Show sample confirmation/ban distributions, audit outcome/action distributions, recent attempts and independent health signals with manual refresh. Label record counts and charts as bounded page snapshots, never global totals, growth rates, unique active users or complete time-series analytics. Keep missing/unknown fields separate, preserve pending/unknown outcomes as unresolved, expose readable count tables alongside charts and distinguish empty/error/refresh states. No backend endpoint, credential, mutation, storage schema or login destination change is required. This requested bounded dashboard supersedes the earlier broad analytics deferral only at this scope; verification is recorded in the frontend checklist. Preview tables use five desktop columns and ellipsis action menus; account pages and read-only action-details dialogs retain full records. The dashboard follows dashboard-01 summary-card and area-chart composition, with daily UTC attempt counts restricted to dates represented by its loaded audit page.

These checks govern delivery; their actual verification scope is recorded in the [frontend checklist](frontend-checklist.md):

1. Restore an eligible session on reload; sign in and inspect UUID/email/expiry; deny ordinary accounts; handle expiry, eligibility loss and logout failure honestly.
2. Complete same-browser Mailpit recovery through backend callback and reset; normal login is required afterward. Exercise invalid/expired context, direct reset-page access, replay, CSRF and uncertain-result messaging.
3. Browse multiple user pages, open details, show null values and missing users correctly, and distinguish failed list loads from empty results.
4. Create controlled users with both confirmation policies; display duplicate/validation errors and no false email-sent claim.
5. Confirm/cancel ban and unban; validate duration/target; refresh status and show last-operator/contention failures.
6. Confirm/cancel permanent deletion; handle disabled deletion, 404 and ambiguous outcomes without repeated mutations.
7. Browse paginated action history and distinguish all four outcomes, including deleted targets and safe support IDs.
8. Exercise all three health endpoints, show safe version/status, and preserve the difference between liveness and readiness.
9. Verify cookies/CSRF, pending submission controls, 204 handling, state cleanup, responsive layouts, keyboard/focus behavior and absence of secrets in frontend output.
10. Check this document's 16 endpoint mappings against the current API reference and actual route modules before final frontend delivery.

## Deferred and later decisions

Global search, bulk operations, editing user credentials/metadata, invitation/resend, operator-role management, full session/device administration, analytics, developer projects, provider settings and infrastructure controls remain outside V1.

The [frontend architecture](frontend-architecture.md) now records the agreed stack, folder boundaries, shared API/session behavior and complete state presentation. The [implementation plan](frontend-implementation-plan.md) divides all features and endpoint mappings above into reviewable phases with validation and commits. No capabilities endpoint, callback-error redirect change or precise rate-limit countdown is required for the current plan. Production deployment and natural upstream email-link expiry remain separate verification work, not completed by these documents.
