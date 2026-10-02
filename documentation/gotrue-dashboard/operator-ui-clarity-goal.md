# Operator UI clarity goal

Status: prepared on 2026-10-02 for a future implementation run. This document defines the requested work; the UI changes have not been implemented. [GoTrue status](status.md) owns delivery evidence and remaining work.

## Objective

Make the existing operator dashboard easier to use: short action labels, focused dialogs, concise notifications, readable history pages and consistent dates. Preserve the current shadcn styling and working authentication, recovery, hosted Resend email and management behavior.

Use the existing shadcn Dialog and AlertDialog components for every modal and confirmation. Do not build custom modal primitives, backdrops, portals or competing dialog systems. Reuse their accessibility and focus behavior; keep form/mutation orchestration in feature hooks.

## Implementation goal

Implement all of the following as one coherent improvement, using [AGENTS.md](../../AGENTS.md), the [frontend architecture](frontend-architecture.md), [frontend requirements](frontend-requirements.md), [component guide](frontend-components.md) and [API reference](api.md).

### 1. Invite users in a modal

- Replace the standalone invitation screen with a shadcn Dialog opened by **Invite user** on Users. Keep the current list and pagination behind it, matching the create-user dialog.
- Preserve `/users/invite` as a compatibility entry that opens the dialog over Users. Preserve validated pagination and useful Back navigation; do not strand existing links.
- Keep email validation, server-side permission checks, duplicate/rate-limit handling and the existing invitation API. Provide clear focus, first-invalid-field focus, keyboard operation and focus return.
- On confirmed acceptance, close the dialog on desktop and mobile, clear its form, show one notification and refresh affected user/history/dashboard reads. Use “Invitation requested” or similarly accurate copy; API acceptance does not prove delivery.
- Keep pending submissions protected from duplicate clicks and dismissal. Failed validation keeps the form available for correction; uncertain outcomes keep their retry lock and offer history inspection.

### 2. Simplify action labels

- Change **View account** to **View** in account row menus. Use **View** for action-history row inspection too, including equivalent dashboard previews.
- Keep meaningful accessible names identifying the relevant account or action. Preserve explicit labels for destructive commands and contextual links such as “View history.”
- Use readable action names instead of raw enum values such as `send_verification`.

### 3. Replace routine inline mutation alerts

- Review create, invite, verification send, reinvitation, ban, unban, delete, recovery/reset and sign-in/out feedback. Remove repeated page-level mutation banners, duplicate inline outcomes and normal-success UUID/request/audit displays.
- Reuse the existing Sonner notification system. A confirmed operation produces one concise notification, such as “User created,” “User banned,” “User unbanned,” or “User deleted.” Email requests use acceptance wording. Do not introduce browser `alert()` popups or a second notification framework.
- Confirmed create/invite/management actions automatically close their modal or confirmation dialog on desktop and mobile, clear transient form state and return focus. Opening the form again starts a fresh intentional action, while still preventing double submissions and duplicated completion notifications.
- Show loading on the initiating control. Navigation, refetching or reopening must not emit the same success again, lose a pending lock, or make an uncertain operation appear successful. Late responses must preserve newer sessions.
- Present actionable failure notifications and field-level validation where relevant. Do not auto-close a failed/uncertain form or automatically repeat a mutation. Critical pending/unknown/partial outcomes need persistent, accessible feedback with a clear **View history** action; they must not disappear with a short-lived success toast.
- Keep support identifiers available in an intentional technical-details disclosure or history detail page, rather than dumping them into normal notifications. Preserve authoritative account/audit identifiers internally and in deliberate inspection. Do not hide essential account identity or remove durable audit records.
- Retain necessary recovery instructions, destructive confirmation and session/access/dependency feedback. Clean up their presentation and duplication while keeping their meaning correct.

### 4. Open action history details as a page

- Replace the Action history “View details” modal with navigation to a protected, read-only `/history/:id` page. Dashboard action previews use the same destination.
- Provide a meaningful heading/breadcrumb, action and outcome, created/completed timestamps, available actor/target context, a target-account link when valid and Back to history preserving list pagination.
- Move UUIDs/request/audit IDs into a clearly named technical-details section. Explain pending/unknown or failed outcomes only when relevant; handle deleted targets honestly.
- Direct navigation and refresh must work from authoritative data, not solely cached rows or router state. Add the smallest required `GET /v1/operator/audit/:id` endpoint through the existing audit layers if needed. Its planned contract is an eligible-operator read, validated UUID, safe `{entry}` response, missing-record 404 and common authentication/dependency errors. Document the endpoint before implementation. No new schema is expected.
- Include loading, missing, forbidden, expired-session and dependency-error states. Do not turn inspection into reconciliation or repeat-action controls.

### 5. Remove redundant copy across every page

- Review Dashboard, Users, user details, Action history, the new history detail page, Service status, Current account, sign-in, forgot/reset password, email confirmation, invitation acceptance, email callback, creation/invitation dialogs and missing/blocked routes. Include desktop and mobile navigation, headers, captions, card descriptions, empty states and notifications.
- Remove repeated filler, verbose implementation explanations, duplicate status messages and redundant links. Dashboard should emphasize useful account/action/service information with concise headings and relevant controls.
- Preserve honest sample boundaries: dashboard counts are based on loaded data, not invented global totals. Express this once using clear labels or contextual help instead of repeating caveats on every card.
- Keep genuine loading/error/empty states distinct, retain necessary global/destructive consequences, and never fabricate information absent from the API.

### 6. Use one date/time presentation

- Use one shared date/time formatter across all pages and notifications. Standardize full timestamps on a readable format such as **02 Oct 2026, 9:15 AM**, consistently using the browser's local timezone.
- Apply it to dashboard health checks and recent records, account creation/confirmation/invitation/sign-in/ban dates, action-history timestamps and session expiry. Stop mixing raw ISO strings, unrelated locale formats and relative “ago” text in normal presentation.
- Chart date buckets may use the same formatter's date-only form; tooltips use the full timestamp. Keep exact source timestamps available for deliberate inspection without cluttering the page.
- Handle missing/invalid timestamps consistently without inventing dates or throwing rendering errors. Allow wrapping at mobile widths rather than losing information.

## Acceptance and verification

1. Invite opens over Users; legacy entry, pagination, idle close, focus return and mobile scrolling work. Confirmed create/invite/management actions close their dialogs and emit exactly one appropriate notification without IDs.
2. No routine create/action result remains as an inline page banner. Validation stays understandable; pending/unknown/partial states remain visible and cannot be silently retried across navigation or session changes.
3. Account and action row menus show “View.” History inspection opens a page from both History and Dashboard and survives direct navigation/refresh, including missing records and unavailable targets.
4. Every listed page is reviewed for redundant copy and uses the shared date policy. Dashboard still describes bounded data honestly.
5. Add meaningful tests for modal lifecycle, notification deduplication, mutation concurrency/uncertainty, stale responses/session cleanup, history routing/lookup authorization and date/null/timezone formatting. Update existing tests to the new intended behavior.
6. Run relevant tests, typecheck, lint, formatting, build and emitted-asset credential scan. Review desktop and mobile together in one bounded browser pass, covering keyboard/focus, long content and critical states; fix identified issues together and confirm at most once. A build alone does not establish UX completion.
7. Update topic-owning requirements, architecture, components and API documentation where behavior changes, and keep actual delivery evidence in `status.md`. Mark this goal delivered only after implementation and required checks pass.
8. Commit the complete implementation and documentation, stage only related changes, preserve unrelated work and exclude credentials. Do not push or deploy. Never execute schema/migration/setup SQL or recreate infrastructure; prepare any required commands for the user. Stop only agent-owned foreground sessions and inspect attributable leftovers.

Existing React/Vite/shadcn/TanStack Query/form and backend layer choices remain in place. This goal adds no provider-settings UI, analytics service, bulk management or unrelated platform features.
