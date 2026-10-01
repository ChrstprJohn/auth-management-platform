# Frontend shadcn component map

Status: implemented using shadcn CLI 4.21.0, Base UI `base-nova`, neutral default tokens and Lucide. Registry guidance was checked on 2026-10-01; generated source and configuration live in `apps/gotrue-admin-web`. Use this map with [frontend architecture](frontend-architecture.md), [requirements](frontend-requirements.md) and [delivery checklist](frontend-checklist.md).

## Current official guidance

Use the official [component catalog](https://ui.shadcn.com/docs/components), [Vite setup](https://ui.shadcn.com/docs/installation/vite) and [React Hook Form integration](https://ui.shadcn.com/docs/forms/react-hook-form). The current catalog includes newer state/form primitives such as Field, Empty, Spinner, Input Group, Button Group and Item; use them throughout the required interface rather than hand-building their equivalent controls.

The official [July 2026 change](https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default) makes Base UI the default primitive base for new shadcn projects while retaining Radix support. Use the current default Base UI generation for this new app and its matching examples. Confirm the registry/CLI versions at scaffold time and pin the chosen setup. Do not paste an older Radix `asChild` example into a Base UI component that expects different composition APIs.

## Component usage by screen

These mappings are our application decisions; availability and primitive behavior are owned by the linked official docs. Use all mapped components where they express a real interaction/state, keeping the shadcn default theme consistent.

| Screen or area                | Components                                                                              | Purpose                                                                                                          |
| ----------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Protected shell               | Sidebar, Sheet, Separator, Breadcrumb, Button, Tooltip                                  | Desktop/mobile navigation, current location, accessible icon actions                                             |
| Account menu                  | Dropdown Menu, Avatar, Item                                                             | Safe operator identity and Account/Logout navigation; use a fallback initial rather than invented profile photos |
| Sign-in                       | Field, Input, Input Group, Button, Spinner, Alert                                       | Labels/help/errors, credential inputs, optional password visibility, pending and failed sign-in                  |
| Forgot password               | Field, Input, Button, Spinner, Alert                                                    | Email request, generic acknowledgement, same-browser guidance and errors                                         |
| Reset password                | Field, Input, Input Group, Button, Spinner, Alert                                       | Password/confirmation, byte-limit help, invalid context and uncertain-result feedback                            |
| Users                         | Table, Badge, Pagination, Select/Native Select, Button, Skeleton, Empty, Alert          | Safe rows, status, bounded page/page-size controls, loading/empty/failure                                        |
| User details                  | Breadcrumb, Item, Separator, Badge, Button, Tooltip, Skeleton, Empty, Alert             | Safe fields, copy actions, available management actions and missing-user state                                   |
| Create user                   | Field, Input, Input Group, Radio Group, Button, Spinner, Alert                          | Explicit confirmation policy, validation and persistent success/failure results                                  |
| Ban                           | Alert Dialog, Field, Input/Select, Button, Spinner, Alert                               | Protected target confirmation, bounded duration and mutation feedback                                            |
| Unban                         | Alert Dialog, Button, Spinner, Alert                                                    | Explicit target/access confirmation and pending/outcome presentation                                             |
| Permanent delete              | Alert Dialog, Button, Spinner, Alert                                                    | Destructive target/global-impact confirmation, backend restrictions and uncertain outcomes                       |
| Action history                | Table, Badge, Pagination, Select/Native Select, Button, Tooltip, Skeleton, Empty, Alert | Durable outcomes, safe identifiers, page controls and loading/empty/error                                        |
| Service status                | Item, Badge, Button, Button Group, Skeleton, Spinner, Alert                             | Independent liveness/readiness/upstream results, check time and manual refresh                                   |
| Account                       | Item, Separator, Button, Tooltip, Skeleton, Alert                                       | Safe ID/email/expiry, copy feedback and logout                                                                   |
| Missing/denied/expired routes | Empty, Alert, Button                                                                    | Clear explanation and safe return/sign-in/retry actions                                                          |
| Supplemental feedback         | Approved Sonner notifier                                                                | Brief copy/success feedback in addition to persistent inline results                                             |

For larger areas, use semantic sections and headings with shadcn primitives. Card may group a standalone account/status/form section when useful; do not turn every field/state into a nested card. Dialog is available for a task requiring protected focus; ordinary create-user work stays on its documented page. Alert Dialog is the deliberate confirmation primitive for destructive actions. See [Alert Dialog](https://ui.shadcn.com/docs/components/base/alert-dialog).

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

The catalog supplies many specialized controls. Select from it for genuine requirements; it does not add backend features. Data Table/TanStack Table remains deferred under the agreed simple table/server-pagination choice. Calendar/Date Picker, Chart, Carousel, Input OTP, attachment/chat/questionnaire components and infrastructure controls do not have a V1 feature contract here. Adding those to the dashboard merely to use the catalog would create unsupported workflows or fabricated content.

If a real requirement later needs Accordion, Collapsible, Tabs, Popover, Scroll Area, Drawer or another catalog component, reuse the current official primitive rather than implementing an equivalent from scratch, and document the interaction. Do not add global search/command palettes, charts or editable profile/settings through component selection alone.

## Scaffold-time and review checks

1. Verify current official registry/CLI compatibility and select the default Base UI style for Vite; record the choice in `components.json` and pin dependencies.
2. Add mapped components as their features are built, using generated source under `src/components/ui` and the documented package-manager policy.
3. Preserve default tokens and use the same primitive family across features; composition, accessibility and styling checks apply to generated source too.
4. Check every mapped state/control through behavior tests and desktop/mobile/keyboard review. A component being installed is not evidence that a feature/state works.
5. Update frontend checklist items only with actual implementation/verification evidence. Recheck source guidance when a registry API changes; never mechanically copy stale examples.
