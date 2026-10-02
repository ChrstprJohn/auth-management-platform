# Codex Agent Rules

## Required project guidance

Follow this file for coding and delivery. Start at [documentation/README.md](documentation/README.md) for topic ownership. Before GoTrue work, read [GoTrue status](documentation/gotrue-dashboard/status.md) to learn what is implemented, what was verified, what remains and the latest prepared goal; then read the relevant topic documents. User instructions take precedence. Planned documentation is not completed implementation.

## Frontend constraint

The agreed frontend uses React and strict TypeScript with Vite, shadcn/ui, Tailwind CSS, Axios, React Router, TanStack Query, and React Hook Form with Zod. Follow [frontend architecture](documentation/gotrue-dashboard/frontend-architecture.md) and [frontend requirements](documentation/gotrue-dashboard/frontend-requirements.md). Do not introduce Next.js, server rendering, or a Node.js frontend application server. Node.js remains the backend runtime; Vite is frontend tooling.

### Frontend implementation practices

- Views render props and hook state, compose accessible components, and bind callbacks. Keep API requests, mutations, navigation decisions, form orchestration, derived business state, cache invalidation, session lifecycle and error interpretation in feature hooks or the shared client. Pure display formatting may use shared utilities. Do not put effects, request calls or business rules into page JSX.
- Feature hooks compose React Hook Form and TanStack Query; the Axios client owns HTTP configuration and safe response parsing. Keep server state in query caches, local interaction state in hooks, and pagination in validated URL parameters. Do not mirror query data in another global store or create generic feature frameworks.
- Every asynchronous flow needs deliberate initial/loading, refreshing, empty, success, validation, missing, forbidden, expired-session, rate-limited, dependency/network-error and ambiguous-outcome UI where applicable. Distinguish error from empty and pending/unknown from success. Disable duplicate submissions; never automatically retry mutations or claim an aborted request rolled back.
- Send credentialed cookie requests and the agreed CSRF header. Never put privileged credentials, passwords, cookies or recovery codes into frontend configuration, persistent storage, logs, telemetry or URLs. Clear account-specific caches on session loss, logout and reset. Guard stale in-flight responses from repopulating cleared state.
- Reuse shadcn components and theme tokens. Use semantic labels, keyboard/focus support, accessible dialog descriptions, status announcements, visible focus, sufficient contrast and text alongside status colors. Respect reduced motion. Ensure long IDs, tables and forms remain usable at mobile widths; preserve all information rather than hiding essential columns.
- Keep form validation aligned with the backend, including UTF-8 password byte limits and explicit destructive confirmation. Backend permissions are authoritative; frontend guards do not grant authority. Present safe request/audit IDs and deliberate read-only inspection for uncertain results.
- Test user behavior and security-relevant state transitions: session restoration/loss, validation, cookie/CSRF requests, 204 handling, mutation concurrency/retry rules, empty/error states and cache cleanup. Verify desktop and mobile rendering and keyboard interactions in a bounded review. Do not mark frontend scenarios complete from build success alone.

## Node / Next.js hygiene (Windows)

- Never run dev servers, builds, or watchers in background. Always run foreground, and terminate cleanly (Ctrl+C / kill the exact process) before the session ends.
- After any dev-server session, verify no orphaned `node .next\dev\build\*.js` worker processes remain:
  `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like '*samson-nextjs*' }`
  Kill leftovers before starting new work. Also inspect processes belonging to this repository; terminate only processes attributable to this session or confirmed project leftovers.
- Never delete or manually modify anything inside `node_modules` (links, store, state files) as cleanup.
- Never run `pnpm install --force`, `npm install --force`, `npm ci`, or nuke/recreate `node_modules` unless the user explicitly asks.
- If install looks broken: run plain `pnpm install`. If that reports "Already up to date" but binaries are missing, remove `node_modules\.pnpm-workspace-state-v1.json` and run `pnpm install` again — that is the only sanctioned recovery, and only after killing orphaned node processes.
- If `pnpm dev` fails with EBUSY / file-lock errors, kill orphaned node processes first, then retry. Do not delete node_modules.

## Coding and delivery rules

### Scope and sources of truth

This rulebook governs implementation, review, and documentation for this repository. Build the GoTrue operator API first, then the developer platform. Use the user's latest instructions and these project documents:

- `documentation/architecture-and-deployment.md`: shared boundaries, environment, and deployment.
- `documentation/gotrue-dashboard/features.md`: operator V1 scope.
- `documentation/gotrue-dashboard/backend-architecture.md`: stack, layers, session/audit policies, provisioning, and remaining upstream checks.
- `documentation/gotrue-dashboard/frontend-requirements.md`: screens, UI behavior and complete endpoint usage.
- `documentation/gotrue-dashboard/frontend-architecture.md`: agreed stack, hook/view boundaries, session/API behavior and state presentation.
- `documentation/gotrue-dashboard/status.md`: the single GoTrue implementation/verification summary, remaining work and latest prepared goal.
- `documentation/gotrue-dashboard/frontend-components.md`: current shadcn component choices and screen/state mapping.
- `documentation/platform/checklist.md`: developer platform implementation and verification status.

Edit the document that owns the changed topic; link to it elsewhere rather than repeating its details. Update other documents only when their actual scope, verification status, or integration instructions are affected. Document unresolved upstream behavior honestly and verify it against the pinned version before relying on it. Do not reopen agreed choices unnecessarily or silently change scope. Do not introduce new services, frameworks, abstractions, or features without a concrete requirement.

### GoTrue status maintenance

- Read `documentation/gotrue-dashboard/status.md` before planning or implementing GoTrue work. Do not treat a prepared goal as implemented behavior or as authorization for an unrelated task.
- For every GoTrue implementation, verification, setup or scope change, update the affected status entries in the same change. Record delivered behavior, the actual verification date/scope, remaining gaps and user-dependent steps. Review the summary for documentation-only changes and update it when ownership/navigation or recorded status changes; do not advance application-verification dates without new checks.
- Keep `status.md` as the only GoTrue delivery-status tracker. Replace superseded notes rather than adding duplicate checklists or phase histories. Requirements, architecture, API and setup documents keep their detailed topic ownership and link to the summary for status.
- On goal completion, consolidate its result/evidence/remaining limits into `status.md`, remove obsolete goal/plan files and fix their references. Preserve the latest goal while work remains; Git history preserves completed task detail.

### Architecture and separation of concerns

For backend code, follow the layer boundaries, class/constructor-injection convention, folder structure, and storage ownership in [backend architecture](documentation/gotrue-dashboard/backend-architecture.md). Keep business logic out of controllers and HTTP concerns out of services. Frontend code follows function components, feature hooks and thin views in [frontend architecture](documentation/gotrue-dashboard/frontend-architecture.md). Do not duplicate those architecture specifications here.

### Readable code, DRY, and simplicity

- Use strict TypeScript, descriptive names, small cohesive functions, explicit boundary types, and straightforward control flow. Prefer early returns over deeply nested conditions. Avoid `any`, unsafe casts, and non-null assertions as shortcuts; validate or narrow unknown data.
- Keep business rules close to their feature. Extract repeated behavior when it expresses the same stable rule; do not build a generic framework for two superficially similar operations.
- Reuse validation schemas and safe contracts where the meaning is identical. Do not create parallel DTOs, models, and interfaces containing the same data without a real boundary reason.
- Centralize cross-cutting request IDs, safe errors, configuration, logging, and upstream HTTP setup. Do not scatter timeout values or copy error mapping across controllers.
- Prefer composition and explicit dependencies. Avoid hidden side effects, mutable global request state, unnecessary inheritance, speculative abstractions, and unrelated refactoring.
- Comment why a non-obvious decision exists, not what obvious code does. Remove dead code and unused imports. Follow the project's formatter/linter once configured.

### API and security practices

- Define methods, payloads, validation, permissions, success/error responses, and side effects before implementing an endpoint. Validate body/query/path input and allowed fields; never forward arbitrary input to GoTrue admin APIs.
- Enforce authentication and authorization server-side. Recheck operator eligibility on each protected request. Preserve the distinct operator, console, and project credential boundaries.
- Follow the agreed cookie, Origin/custom-header CSRF, session hashing/encryption, expiry, and logout policy. Use bounded requests, body sizes, pagination, and upstream timeouts. Configure proxy trust for the actual topology.
- Return safe contracts and the common error envelope. Never log or expose credentials, cookies, authorization headers, token-bearing URLs, raw Axios errors, or arbitrary upstream payloads. Use safe metadata and request IDs.
- Do not automatically retry ambiguous upstream mutations. Follow durable audit intent/completion and manual reconciliation rules. Handle an already-applied upstream action honestly.
- Use SQL parameter binding and explicit transactions for owned database operations that require atomicity. Introduce migrations for schema changes; do not alter shared databases as incidental cleanup. Preserve concurrency requirements such as last-usable-operator protection.

### Implementation workflow

1. Read the applicable documents, including GoTrue `status.md` when relevant, and inspect existing code and Git changes. Preserve unrelated user work.
2. Identify the smallest complete flow, its acceptance criteria, and any unverified dependency behavior. Resolve routine implementation choices using the agreed design.
3. Document or update its endpoint contract before implementation. Clearly label planned endpoints until implemented and verified.
4. Implement the feature through the appropriate layers, including validation, permissions, safe failures, configuration, migrations, and shutdown where relevant.
5. Run relevant formatting/lint/type/build checks once available. Add meaningful tests for auth boundaries, business rules, failures, concurrency, and storage behavior as applicable. Avoid tests that merely mirror implementation or add ceremony for a documentation-only change.
6. Use controlled local accounts for GoTrue integration walkthroughs. Do not use production users. Health alone does not verify auth, email, or persistence.
7. Update the API reference for endpoint changes, architecture for changed internal design and setup instructions for changed setup. Update GoTrue `status.md` in the same change with delivered behavior, verification evidence and remaining work; use the platform checklist for platform delivery. Mark implemented/verified only with evidence; list remaining gaps honestly.
8. Report the behavior delivered, verification performed, documentation updated, and relevant limitations. Stop foreground dev/watch processes and inspect project-specific leftovers before finishing.

Initial sequence: workspace/tooling and configuration, admin storage migrations, health, operator login/current account/logout, then recovery, user management with durable audit and last-operator protection, and audit history. Deployment follows local verification. Do not run the local infrastructure stack on the VM.

### Database schema and migrations

The user handles database setup and execution every time. Agents prepare SQL and documentation; never apply migrations, execute full schema files, create databases/roles, run seed/setup/reset scripts, or trigger these actions indirectly through application startup, tests, containers, or deployment scripts. If an integration check requires database setup, provide the prepared files and report that the check awaits the user's execution. Ordinary application queries are separate from this restriction; do not automatically migrate at startup.

Use these locations when owned database implementation begins; do not create empty or invented schemas merely to fill the folders:

```text
packages/database/
  admin/
    schema.sql                 # Authoritative full current admin schema
    migrations/
      0001_descriptive_name.sql
      0002_descriptive_name.sql
    README.md                  # Setup, ordered migration ledger, execution notes
  platform/
    schema.sql                 # Authoritative full current platform schema
    migrations/
      0001_descriptive_name.sql
    README.md
```

- Treat each `schema.sql` as the authoritative full intended schema, including tables, columns, constraints, indexes, and schema-owned database objects. Keep it current with every schema change. It is not proof that the live database has been updated.
- Migrations describe incremental changes from the previous schema. For example, adding migration `0007_add_example.sql` also updates that database's `schema.sql` to the complete state after migration 7 in the same change. Never leave the original full schema at migration 6.
- Use ordered, uniquely numbered, descriptive migration filenames. Read existing migrations before choosing the next number. Do not modify or renumber already-applied migrations; add a corrective migration. If applied status is unknown, preserve existing migration history.
- Prepare migrations only for application-owned databases. GoTrue manages its own schema and migrations; never create our migrations against GoTrue tables.
- Explain prerequisites, target database, transaction behavior, data/backfill effects, and any destructive or irreversible operations in the database README. Keep an ordered migration ledger so the user can identify the newly prepared file. Do not claim a migration is applied without evidence from the user or a permitted read-only check.
- Clearly distinguish full-schema initialization for an empty database from incremental migration of an existing database. For a database already at migration 6, the user executes migration 7 only, not the updated full schema or previously applied migrations. A new database can be initialized from the current full schema with its baseline recorded; do not then replay the included migrations over it.
- Check SQL/schema consistency and update affected repository code and API docs only when their behavior changes. Report the exact new migration path and manual execution order. Do not run an execution-based database check without the user's explicit instruction to execute it.
- Never embed live credentials in SQL, documentation, or commands. The user supplies environment-specific connection details when executing prepared SQL.

### Endpoint documentation is part of delivery

Maintain each product's API reference in its documentation directory: `documentation/gotrue-dashboard/api.md` for operator endpoints and `documentation/platform/api.md` when platform work begins. Link each reference from its product README. Keep examples concise but usable.

For each implemented endpoint, document:

- Implementation status, method/path, purpose, required identity/permissions.
- Required headers, cookies, CSRF/origin rules, content type, and local/production base-URL behavior.
- Path/query/body fields, allowed values/defaults, validation limits, and pagination where relevant.
- Copyable request examples and representative success/error responses with status codes.
- Session, database, audit, and upstream side effects; global effects and destructive confirmation requirements where relevant.
- Retry/idempotency behavior, ambiguous outcomes, dependency failure behavior, and relevant limits.

Document the complete usage flow for dependent endpoints: sign in, preserve cookie, call a protected route, and sign out. Use placeholders for secrets and controlled example identities. Document configuration variable names and migrations/setup prerequisites without real values. Never include live credentials or reset links.

Every endpoint addition, behavior change, rename, or removal must update its reference and examples in the same change. Update shared contracts and affected integration instructions too. Distinguish breaking changes and migration steps. Keep planned behavior visibly separate from verified behavior; never invent a successful response for a flow that has not been checked. A feature is not complete while its usage documentation contradicts its implementation.

### Boundaries on completion claims

Decision checkboxes mean the design was documented. Delivery checkboxes mean behavior was implemented and verified. A successful build is not an end-to-end walkthrough. Report unavailable checks rather than claiming they passed. No backend deployment, database provisioning, or recovery verification is implied by these rules.
