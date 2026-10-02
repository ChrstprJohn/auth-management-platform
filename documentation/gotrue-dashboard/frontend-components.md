# Frontend shadcn component map

Status: implemented using shadcn CLI 4.21.0, Base UI `base-nova`, neutral default tokens and Lucide. Registry guidance was checked on 2026-10-01; generated source and configuration live in `apps/gotrue-admin-web`. Use this map with [frontend architecture](frontend-architecture.md), [requirements](frontend-requirements.md) and [delivery checklist](frontend-checklist.md).

## Current official guidance

Use the official [component catalog](https://ui.shadcn.com/docs/components), [Vite setup](https://ui.shadcn.com/docs/installation/vite) and [React Hook Form integration](https://ui.shadcn.com/docs/forms/react-hook-form). The current catalog includes newer state/form primitives such as Field, Empty, Spinner, Input Group, Button Group and Item; use them throughout the required interface rather than hand-building their equivalent controls.

The official [July 2026 change](https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default) makes Base UI the default primitive base for new shadcn projects while retaining Radix support. Use the current default Base UI generation for this new app and its matching examples. Confirm the registry/CLI versions at scaffold time and pin the chosen setup. Do not paste an older Radix `asChild` example into a Base UI component that expects different composition APIs.

## Component usage by screen

These mappings are our application decisions; availability and primitive behavior are owned by the linked official docs. Use all mapped components where they express a real interaction/state, keeping the shadcn default theme consistent.

| Screen or area                | Components                                                                              | Purpose                                                                                                          |
| ----------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Protected shell               | Sidebar, Sheet, Separator, Breadcrumb, Dropdown Menu, Avatar, Button, Tooltip           | Desktop/mobile navigation, current location, accessible icon actions                                             |
| Account menu                  | Dropdown Menu, Avatar, Item                                                             | Safe operator identity and Account/Logout navigation; use a fallback initial rather than invented profile photos |
| Sign-in                       | Field, Input, Input Group, Button, Spinner, Alert                                       | Labels/help/errors, credential inputs, optional password visibility, pending and failed sign-in                  |
| Forgot password               | Field, Input, Button, Spinner, Alert                                                    | Email request, generic acknowledgement, same-browser guidance and errors                                         |
| Reset password                | Field, Input, Input Group, Button, Spinner, Alert                                       | Password/confirmation, byte-limit help, invalid context and uncertain-result feedback                            |
| Users                         | Table, Badge, Pagination, Select/Native Select, Button, Skeleton, Empty, Alert          | Safe rows, status, bounded page/page-size controls, loading/empty/failure                                        |
| User details                  | Breadcrumb, Item, Separator, Badge, Button, Tooltip, Skeleton, Empty, Alert             | Safe fields, copy actions, available management actions and missing-user state                                   |
| Create user                   | Dialog, Field, Input, Input Group, Radio Group, Button, Spinner, Alert                  | Creation over Users, explicit policy, validation, persistent outcome and pending close protection                |
| Ban                           | Alert Dialog, Field, Input/Select, Button, Spinner, Alert                               | Protected target confirmation, bounded duration and mutation feedback                                            |
| Unban                         | Alert Dialog, Button, Spinner, Alert                                                    | Explicit target/access confirmation and pending/outcome presentation                                             |
| Permanent delete              | Alert Dialog, Button, Spinner, Alert                                                    | Destructive target/global-impact confirmation, backend restrictions and uncertain outcomes                       |
| Action history                | Table, Badge, Pagination, Select/Native Select, Button, Tooltip, Skeleton, Empty, Alert | Durable outcomes, safe identifiers, page controls and loading/empty/error                                        |
| Service status                | Card, Dropdown Menu, Badge, Button, Skeleton, Spinner, Alert                            | Independent liveness/readiness/upstream results, check time and manual refresh                                   |
| Account                       | Card, Item, Button, Tooltip, Skeleton, Alert                                            | Safe ID/email/expiry, copy feedback and logout                                                                   |
| Missing/denied/expired routes | Empty, Alert, Button                                                                    | Clear explanation and safe return/sign-in/retry actions                                                          |
| Supplemental feedback         | Approved Sonner notifier                                                                | Brief copy/success feedback in addition to persistent inline results                                             |

Use semantic sections/headings with shadcn primitives. Card may group standalone account/status/form content; avoid nested field/state cards. Creation uses Dialog over Users with DialogTrigger actions, title/description, viewport scrolling and hook-owned close/focus behavior. Pending disables Cancel and blocks Escape/backdrop; uncertain results retain read-only inspection. Legacy `/users/new` redirects into the dialog. Alert Dialog remains the destructive confirmation primitive. See [Dialog](https://ui.shadcn.com/docs/components/base/dialog) and [Alert Dialog](https://ui.shadcn.com/docs/components/base/alert-dialog).

## Use the newer state/form components

- [Field](https://ui.shadcn.com/docs/components/base/field): compose labels, descriptions and associated validation feedback. Hook form state supplies invalid/disabled conditions; the view renders them.
- [Input Group](https://ui.shadcn.com/docs/components/base/input-group): group input adornments, password visibility and contextual actions with accessible names. Never rely on an icon or placeholder as the field label.
- [Empty](https://ui.shadcn.com/docs/components/base/empty): make empty lists/history and missing-resource states explain what happened and what the operator can do next. Errors stay errors, not empty results.
- [Spinner](https://ui.shadcn.com/docs/components/base/spinner): show pending submit/refresh with named action text; use Skeleton for an initial content read instead of a page of spinning controls.
- [Sidebar](https://ui.shadcn.com/docs/components/base/sidebar): use its provider, trigger and mobile behavior rather than a separately invented navigation system. Only its navigation state is persisted if the generated pattern does so; it must never persist identity/token/query data.
- Button Group: group related read actions such as refresh controls without introducing unsupported bulk mutations.
- Item: keep account/status/identifier rows consistent and readable; each row remains real API information.

## Component behavior remains in hooks

Generated primitives provide keyboard/focus/composition behavior. Feature hooks still own form orchestration, open/pending/result state, API requests, navigation and cache changes. Views select the matching primitive/state and bind callbacks. Do not put backend logic into a generated UI component or fork separate error/loading logic per screen.

Controls must have default, hover, visible focus, disabled and pending behavior where applicable. Statuses need text as well as color. Confirmation dialogs need title/description, target context, safe cancel/focus return and persistent pending/unknown result handling. Preserve server outcomes when a dialog closes; closing a dialog is not cancellation of an upstream action.

Use one notification system. Sonner is already approved in the stack; current official [Toast documentation](https://ui.shadcn.com/docs/components/base/toast) describes another primitive implementation. Do not silently install both or assume an old registry entry still exists: retain Sonner as the supplemental notifier and use current registry components for the rest. Permanent/uncertain errors belong in Alert and persistent result views, not only temporary toast messages.

## Catalog coverage without scope changes

The catalog supplies many specialized controls. Select from it for genuine requirements; it does not add backend features. Data Table/TanStack Table remains deferred under the agreed simple table/server-pagination choice. Calendar/Date Picker, Carousel, Input OTP, attachment/chat/questionnaire components and infrastructure controls do not have a V1 feature contract here. Adding those to the dashboard merely to use the catalog would create unsupported workflows or fabricated content.

If a real requirement later needs Accordion, Collapsible, Tabs, Popover, Scroll Area, Drawer or another catalog component, reuse the current official primitive rather than implementing an equivalent from scratch, and document the interaction. Do not add global search/command palettes or editable profile/settings through component selection alone. The user-requested bounded analytics extension is specified in frontend requirements.

## Requested polish component composition (2026-10-01)

The [expanded working goal](frontend-polish-goal.md) captures the user's refinements. New source uses the same pinned Base UI `base-nova` registry and default neutral tokens. Card, Chart, Progress and Dialog are official registry components; Recharts is pinned at 3.8.0 and loaded with the dashboard route.

| Area                        | Composition and rendered comparison                                                                                                                                                                                                                                                                                  |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Login and recovery          | `login-03` centered muted surface, brand and Card; existing Field/Input Group forms retain their hooks. No unsupported social login/sign-up controls.                                                                                                                                                                |
| Shell                       | `sidebar-07` brand/header/user-menu composition, icon collapse, inset content and breadcrumbs. Tooltips mount only on collapsed desktop: hidden tooltip behavior consumed Escape in the mobile Sheet.                                                                                                                |
| Users                       | Five desktop preview columns: email, confirmation, ban status, created date, ellipsis actions. Dropdown Menu opens the account page. Mobile prioritizes email/actions; full fields remain on account details.                                                                                                        |
| History and recent attempts | Five desktop columns: action, outcome, abbreviated target, created date, ellipsis actions. Dropdown Menu opens a read-only Dialog with full IDs, timestamps, actor/target and outcome. Mobile keeps action/outcome/actions.                                                                                          |
| Cards and badges            | Base Nova Card spacing/header/footer, default Table row density and Badge variants. Reported failures/unavailability use destructive; reported healthy/succeeded states use secondary; pending/unknown stay outline and include text.                                                                                |
| Dashboard                   | `dashboard-01` summary cards and full-width area-chart composition adapted to existing contracts. Confirmation donut, outcomes pie, action columns and ban Progress rows answer different questions. Visible count lists accompany charts. All counts are bounded snapshots, never global totals or invented growth. |

Official rendered references: [login blocks](https://ui.shadcn.com/blocks/login), [dashboard-01](https://ui.shadcn.com/view/new-york-v4/dashboard-01), [Card](https://ui.shadcn.com/docs/components/base/card), [Table](https://ui.shadcn.com/docs/components/base/table), [Badge](https://ui.shadcn.com/docs/components/base/badge), [Chart](https://ui.shadcn.com/docs/components/base/chart), [Dialog](https://ui.shadcn.com/docs/components/base/dialog). Public block previews currently render the New York family; implementation follows the matching Base Nova registry APIs and tokens.

Captured references and controlled application screenshots live in ignored `artifacts/web-review/polish-before`, `polish-after` and `polish-confirm`. Capture public references with `pnpm exec tsx scripts/capture-shadcn-references.ts`; run fixture verification with `pnpm exec tsx scripts/verify-local-web.ts --ui-review=confirm --review-port=5174`. `--table-review` limits new screenshots to user-requested table/menu refinements; `--behavior-only` diagnoses interactions without another visual pass. These foreground utilities close their browser and Vite resources and do not use live accounts.

## Scaffold-time and review checks

### Application-wide layout composition

The current overhaul covers `/login`, `/forgot-password`, `/reset-password`, `/dashboard`, `/users`, `/users/new`, `/users/:id`, `/history`, `/status`, `/account`, unmatched destinations and session-blocked screens. The shell and page composition are owned by [frontend architecture](frontend-architecture.md); verification evidence is owned by the [frontend checklist](frontend-checklist.md).

`AppSidebar`, `PageHeader`, `AuthLayout` and `RouteState` compose existing Base UI shadcn primitives. Metric and service-card ellipsis menus use `DropdownMenu` with Lucide `MoreHorizontal`; table menus retain their account/detail destinations. Service checks use equal-height Card sections with aligned footers. Account/details/chart areas use responsive seven-column splits; creation uses a viewport-bounded Dialog above Users. Card headers use `minmax(0,1fr)` for the text column so menu triggers cannot collide with titles. Email previews truncate with the full address available in account details; full identifiers remain selectable/copyable and wrap in details.

Forms retain the official current Field/Input Group + React Hook Form pattern; tables retain the agreed shadcn Table with server pagination. No legacy Radix Form wrappers, client-side pagination engine, sample dashboard records or unsupported reference-block controls are introduced.

Run the expanded fixture-only audit with `pnpm exec tsx scripts/verify-local-web.ts --ui-review=after --layout-review --review-port=5174`; use `confirm` for the single confirmation pass or `--behavior-only` for diagnostics without new screenshots. Captures live in ignored `artifacts/web-review/layout-after` and `layout-confirm`; public references remain in `polish-before`. The audit checks every route at 320/390/768/1024/1440px, keyboard header-menu focus, collapsed/mobile navigation, dark-token renders and blocked routes, and closes its foreground resources.

1. Verify current official registry/CLI compatibility and select the default Base UI style for Vite; record the choice in `components.json` and pin dependencies.
2. Add mapped components as their features are built, using generated source under `src/components/ui` and the documented package-manager policy.
3. Preserve default tokens and use the same primitive family across features; composition, accessibility and styling checks apply to generated source too.
4. Check every mapped state/control through behavior tests and desktop/mobile/keyboard review. A component being installed is not evidence that a feature/state works.
5. Update frontend checklist items only with actual implementation/verification evidence. Recheck source guidance when a registry API changes; never mechanically copy stale examples.

## Email extension controls

Invite user uses the existing PageHeader/Card/Field/Button conventions. Recipient proof pages use AuthLayout, TextField, new-password PasswordField, FieldGroup and safe status/alert feedback. Account email actions use the existing AlertDialog with bounded viewport height and scrolling, explicit target context and confirmation. No provider settings or privileged credentials enter the UI. Fixture review: pnpm exec tsx scripts/verify-local-web.ts --email-review --ui-review=after --review-port=5174; captures use dummy HTTP responses and send no email.
