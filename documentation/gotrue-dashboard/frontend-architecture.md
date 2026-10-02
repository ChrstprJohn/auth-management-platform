# Operator frontend architecture

Status: implemented in `apps/gotrue-admin-web`; local verification and remaining launch prerequisites are recorded in the [frontend checklist](frontend-checklist.md). This file owns the stack and implementation boundaries. [Frontend requirements](frontend-requirements.md) owns screens and all 21 endpoint mappings; [implementation plan](frontend-implementation-plan.md) owns phases and acceptance gates; [API reference](api.md) owns HTTP contracts; [AGENTS.md](../../AGENTS.md) owns coding and delivery rules.

## Stack

| Area           | Choice                            | Responsibility                                                                              |
| -------------- | --------------------------------- | ------------------------------------------------------------------------------------------- |
| Application    | React + strict TypeScript         | Browser UI with explicit safe contracts                                                     |
| Tooling        | Vite                              | Local development and static production build                                               |
| Components     | shadcn/ui                         | Owned accessible component source, dialogs, buttons, tables and controls                    |
| Styling        | Tailwind CSS                      | Shared tokens, responsive layout and interaction states                                     |
| Requests       | Axios                             | Cookie/CSRF configuration, bounded HTTP requests and safe errors                            |
| Server state   | TanStack Query                    | Reads, mutation state, cancellation and cache invalidation                                  |
| Navigation     | React Router, browser SPA         | Public recovery/login routes and protected dashboard destinations                           |
| Forms          | React Hook Form + Zod             | Field state, validation and feature-hook submit orchestration                               |
| Icons/feedback | Lucide + Sonner                   | Consistent icons and supplemental success notifications; errors remain inline               |
| Tests          | Vitest + React Testing Library    | User interactions and boundary/state regression checks                                      |
| Tables         | shadcn Table + backend pagination | Safe account/history rows; TanStack Table deferred until richer column behavior is required |

Use the existing pnpm workspace and ESLint/Prettier. Pin dependencies in the app manifest. No extra global state library, frontend auth SDK or server runtime is needed.

Use the official shadcn/ui registry and generated component source, with its default theme tokens. The user asked to use shadcn components and current catalog guidance; do not create a separate bespoke design system or independently restyle each component. Follow the [component map](frontend-components.md) for each screen/state, including current Field, Empty, Spinner, Input Group and other appropriate primitives. Use the current default Base UI generation for this new app and its matching composition APIs. Sonner remains the approved supplemental notifier. Do not mix primitive families or introduce a second toast system without a documented reason.

Exact package versions are selected and pinned at scaffold time after checking compatibility with the repository's Node/pnpm versions and release-age policy. A recommendation is not evidence that dependencies have been installed.

## Boundaries

`src/app` composes providers, routes and the protected shell. `src/features/<feature>` contains feature hooks and presentation views. `src/components/ui` holds shadcn source; `src/components` holds shared presentation for errors, loading, empty states and pagination. `src/lib` owns the Axios boundary, runtime response schemas, query configuration and pure display helpers.

Views call their feature hook and render its returned state/callbacks. Hooks own forms, effects, navigation, dialogs, query parameters, mutations and invalidation. Shared API modules do not import views. Response schemas validate unknown network data against safe contracts; browser code never imports the server-only GoTrue client or backend environment.

Separate a thin page connector from a presentational view when useful: the connector calls `useUsersPage()` and passes its model to `UsersView`. A view may choose markup for named states and attach callbacks; it does not make requests, orchestrate effects, parse URLs, interpret backend outcomes or duplicate validation. Business/form/interaction behavior lives in hooks; pure formatting and validation remain reusable utilities/schemas rather than becoming artificial hooks. React components and hooks are functions; the backend class convention does not require React class components.

Proposed structure:

```text
apps/gotrue-admin-web/
  src/
    app/                 # Providers, routes, session boundary, responsive shell
    components/
      ui/                # Generated shadcn component source
      feedback/          # Shared loading, empty, failure and result presentation
    features/
      dashboard/         # Bounded read snapshots, pure summaries and lazy-loaded charts
      auth/              # Login/logout/current account and session hooks/views
      recovery/          # Request/reset hooks/views and form schemas
      users/             # List/detail/create/action hooks/views and schemas
      history/           # Paginated audit hooks/views
      status/            # Three health-check hooks/views
    lib/
      api/               # Axios client, safe errors, response schemas, feature calls
      query/             # Query client, keys, cancellation/session generation
      format/            # Pure date/status/identifier formatting
    test/                # Test providers, fixtures and user-behavior tests
  index.html
  vite.config.ts
  tsconfig.json
  .env.example
  README.md
```

Keep test fixtures clearly separate from production data. Use existing safe shared contract types with type-only imports where appropriate; runtime schemas are justified at the network boundary. Do not create duplicate application models with the same meaning.

Keep authentication as a credentialed `auth/me` query with an in-memory session generation. Session loss cancels reads and clears account-specific caches; responses from earlier generations cannot populate the next session. Login/logout/reset clear sensitive form/mutation data. Public recovery routes remain accessible while signed in. Query data is not persisted to local storage.

Use feature-scoped query keys for the current session, paginated users, individual users, paginated audit and each health check. Protected keys include session identity/generation so another login cannot reuse a former operator's data. Pass query cancellation signals to Axios. A read failure must not silently replace valid data with an empty array. Do not use previous-account data as placeholder content. Expiry timers prompt sign-in and invalidate local state; they never refresh upstream tokens or substitute for server checks.

Axios uses the public API origin, `withCredentials: true`, bounded timeout and custom CSRF headers on POST/DELETE. 204 is empty success. Readiness and protected upstream-health 503 status objects remain distinct from common error envelopes. Never expose raw Axios errors or retry mutations automatically. Reads use explicit user retry so health/session failures remain visible.

Mutation success invalidates affected reads. Failure preserves request/audit IDs and safe outcome metadata. Ambiguous or completion-failure results block repeat submission and offer read-only inspection; they do not show a rollback claim. The create-user controller/provider lives above routes in `features/users/creation.tsx`, retaining pending/error/success safety across close/navigation. Users owns the thin dialog presentation; a compatibility hook redirects `/users/new` to Users with consumed in-memory open intent and unchanged pagination. Passwords clear when the request starts, on idle close/navigation and on session change; no password-bearing mutation variables or persistent store is introduced. URLs contain pagination and user IDs, never passwords or recovery values.

Use one bounded HTTP timeout defined in the client, no retry interceptor, and explicit read retry controls. Normalize unknown network failures into safe frontend errors, without retaining raw Axios objects in UI/query errors. Keep mutation variables containing passwords short-lived; reset form and mutation state after completion or unmount. Authorization failures are contextual: login's 401 is bad credentials, protected 401 is session loss, and mutation 403 may be disabled deletion or browser-policy rejection. Session/bootstrap 503 blocks access without claiming logout.

The public configuration is `VITE_API_BASE_URL`, locally `http://localhost:3100`. Vite serves the browser app on `http://localhost:5173` with a strict port so a fallback port cannot silently break trusted origins. Validate the configured HTTP(S) origin without embedded credentials/query/fragment. Production requires the existing same-site HTTPS policy and static-host history fallback for direct routes, including `/reset-password`; deployment remains separately authorized work. No frontend variable contains a database URL or GoTrue credential.

## Visual and state model

Use shadcn's default styling and components, readable neutral surfaces and semantic status labels. Navigation includes Dashboard, Users, history, service status and account; Users remains the default post-login destination. Use the shadcn Sidebar/Sheet pattern on narrow screens; wide tables scroll in their own region and retain all fields. Forms use labeled fields, inline errors and persistent result messages. Destructive dialogs identify the target and action before submission. A dark-mode selector is not required for V1; keep theme choice separate from functional completeness.

Protected routes compose `SidebarProvider`, extracted `AppSidebar`, `SidebarInset`, sticky breadcrumb/account header and one padded main region. `PageHeader` standardizes titles/descriptions/actions; actions stack below the title at tablet widths. Dashboard metrics use two/four-column grids; details, account and charts use seven-column desktop splits with single-column mobile order. Creation uses a viewport-bounded shadcn Dialog over Users and preserves its pagination/breadcrumb. Card headers reserve a nonshrinking menu column and let text shrink. Keep these compositions in views.

Sign-in and both recovery routes use `AuthLayout` with Card/Field forms and a separate CardFooter navigation region. Session loading/denied/unavailable and unmatched routes use `RouteState`; protected account data and navigation are withheld until session verification succeeds. The shell is never an authentication bypass. Five-column table previews appear at large widths; compact previews retain links to full account details or read-only audit dialogs, as specified in [requirements](frontend-requirements.md).

Every screen supplies loading and error UI, then its real/empty/missing state. Background refresh keeps real data visible with an explicit refresh indicator. Session failure blocks protected content; 503 does not imply successful logout. Status checks show individual timestamps and unavailable states rather than fabricated metrics. Recovery uses same-browser email navigation through the backend callback; no frontend callback exchange or recovery-status endpoint is introduced.

## State presentation

Hooks return explicit named states rather than a collection of booleans that permits contradictory combinations. Avoid speculative universal state-machine frameworks; each feature keeps the states it needs.

| State                       | Required UI                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------------ |
| Initial/session check       | Accessible loading screen; protected content is not exposed                                |
| First read loading          | Shape-appropriate shadcn Skeleton with loading announcement                                |
| Background refresh          | Keep current-session content visible with refresh indicator; avoid content jump            |
| Empty list/history          | Explain what is empty and offer the relevant permitted action or page navigation           |
| Loaded                      | Real safe fields, readable timestamps, copyable identifiers and available actions          |
| Invalid form                | Associated field errors, preserved non-secret input and focus on the first error           |
| Mutation pending            | Disabled repeat submission, named progress text; prevent accidental dialog resubmission    |
| Confirmed success           | Persistent result or destination feedback; refresh affected queries; toast is supplemental |
| Missing/deleted             | Clear not-found result and return to Users                                                 |
| Session expired             | Clear private state and provide sign-in; safe internal return route only                   |
| Access denied               | Block protected content and explain access was denied; do not impersonate another identity |
| Rate limited                | Retry-later message without an invented readable Retry-After countdown                     |
| Dependency/network failure  | Safe explanation, request ID if available and deliberate read retry; not an empty result   |
| Unknown/partial mutation    | Known outcome, audit/request IDs and read-only inspection; no ordinary repeat action       |
| Unsupported/disabled action | Explain the backend restriction and preserve the target view                               |
| Copy failure                | Selectable identifier and a visible fallback message                                       |

Dialog focus, Escape/cancel, route changes and reduced-motion behavior need explicit handling. During a pending or uncertain mutation, closing an overlay must not discard outcome feedback or imply cancellation of the backend action. Ordinary read failures can retain current data with an error banner; session loss removes it.

Implementation status and verification belong in the [frontend checklist](frontend-checklist.md), with overall product status in the existing delivery checklist. Follow [implementation phases and gates](frontend-implementation-plan.md). Production hosting/origin checks, natural upstream OTP expiry, platform-reference reconciliation and branded backend callback-error redirects remain separately scoped work. A reusable [AI handoff goal](frontend-ai-goal.md) points to the complete documentation and autonomous-work boundaries.

## Email extension

Email feature hooks own invitation form/mutation state in an app-level provider and public proof orchestration. Views render accessible fields, safe outcomes and callbacks. Invited state comes from safe invitedAt; it selects reinvitation instead of signup resend in details. Codes/passwords are cleared before the request settles and never retained in mutation variables or persistent storage. Definite invalid-code/limit rejection permits deliberate re-entry; consumed or uncertain results remain blocked. Completion clears private account state only if the submission's session generation is still current. Legacy callback credentials are removed before React renders. Operator recovery remains PKCE and uses its separate server-held context.
