# Frontend polish goal

Polish the working operator frontend, preserving feature hooks, session behavior, endpoint contracts and backend patterns. Generate and integrate a project logo. Use official shadcn components and reference layouts for login, navigation, cards, tables, badges, forms and feedback.

- Compare controlled desktop/mobile screenshots with official shadcn references, then complete one batched review and at most one confirmation pass.
- Keep tables as compact previews with five default desktop columns and `…` row action menus. Users open their account page for full details; action history and dashboard attempts open an accessible read-only action-details dialog. Mobile uses compact previews with all omitted fields available in Details; avoid horizontal scrolling.
- Remove redundant copy while retaining shared-account effects, confirmation policies, uncertain outcomes and recovery constraints.
- Keep typography, spacing, actions, status badges and navigation consistent across pages.
- Adapt official `dashboard-01` and the user's pasted area-chart example to existing hooks and contracts. Add summary counts, daily activity, a confirmation donut, outcome pie, action columns and ban progress rows. Show readable counts and honest loading, empty, error and stale states. The existing API returns pages without global totals: label counts as snapshots rather than inventing totals or adding endpoints.
- Run relevant regression, type, lint, format, build and keyboard checks; record evidence in the frontend checklist and component mapping. Commit verified changes and close agent-owned foreground servers.

No deployment, push, database setup or real operator account changes. Make routine choices autonomously. This brief incorporates the user's table, dashboard, copy and consistency refinements to the active goal; goal status remains active until delivery is verified.

The application-wide layout overhaul also requires one shared protected shell with an extracted AppSidebar, breadcrumb/account header and padded content region, consistent page headers, responsive two/four-column metrics and seven-column content splits, constrained text/menu columns, and composed public and blocked-route layouts. Cover every existing route and sub-route. Preserve feature hooks, backend integrations and route parameters; commit each distinct page or shared component set. Verify against the official dashboard-01 reference in one desktop/mobile review plus at most one confirmation pass. Record actual evidence in the frontend checklist.
