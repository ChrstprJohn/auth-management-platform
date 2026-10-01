# Frontend AI implementation goal

Copy the prompt below into an AI task opened at the repository root. It authorizes frontend implementation, ordinary dependency installation, controlled local verification and commits. It does not authorize database setup, infrastructure migrations/startup, production deployment or sharing credentials.

```text
Implement the complete GoTrue operator frontend in this repository, inside apps/gotrue-admin-web, using the documented requirements and the existing backend. Finish the working UI and its verification, not just scaffolding or a subset of screens.

Start by inspecting Git changes and reading these files:
1. AGENTS.md — coding/delivery rules, Windows process hygiene and frontend best practices.
2. documentation/README.md — source-of-truth ownership and navigation.
3. documentation/gotrue-dashboard/frontend-requirements.md — every feature/screen, all 16 endpoint mappings, safety and error behavior.
4. documentation/gotrue-dashboard/frontend-architecture.md — agreed stack, folder structure, thin views/feature hooks, API/session/cache and UI-state boundaries.
5. documentation/gotrue-dashboard/frontend-implementation-plan.md — implementation phases, concrete decisions and acceptance gates.
6. documentation/gotrue-dashboard/frontend-checklist.md — completion tracking; check items only with evidence.
7. documentation/gotrue-dashboard/api.md — authoritative methods, payloads, validation, cookies/CSRF, safe errors and mutation outcomes.
8. documentation/gotrue-dashboard/features.md and checklist.md — product scope, deferred features and existing backend evidence.
9. apps/gotrue-admin-api/README.md, apps/gotrue-admin-api/src/modules/*/*.routes.ts, and packages/contracts/src/operator/index.ts — backend setup, actual route implementation and safe shared types.
10. documentation/architecture-and-deployment.md — shared boundaries and later deployment constraints.
11. documentation/gotrue-dashboard/frontend-components.md — current official shadcn guidance and component mapping for every screen/state; use the default Base UI generation and matching APIs.

Use React + strict TypeScript + Vite, shadcn/ui components with default styling, Tailwind CSS, Axios, React Router, TanStack Query, React Hook Form + Zod, Lucide and supplemental Sonner feedback. Use Vitest + React Testing Library. Use shadcn Table with backend pagination initially; no additional table engine or global state library unless a concrete documented need appears. Do not introduce Next.js, SSR or a frontend Node server.

Check current official shadcn documentation/registry at scaffold time and use its mapped components throughout, including Field, Empty, Spinner and Input Group for complete states. Keep one primitive family and one notifier. Do not hand-build equivalent controls or add unsupported features merely to consume more components.

Views render UI and bind callbacks only. Put API calls, mutations, form orchestration, navigation decisions, effects, validation orchestration, dialog state, session lifecycle and cache invalidation in feature hooks/shared boundaries. Pure schemas and display helpers can remain utilities. Do not put business logic into JSX or duplicate server state in another store.

Implement login/logout/current account, forgot/reset password, paginated users/details, create with both confirmation policies, explicit ban/unban/permanent-delete flows, last-operator/disabled/conflict feedback, paginated durable history, and all three health views. Integrate all 16 endpoints in their intended flow; the recovery callback is browser email navigation through the backend, not a frontend token exchange. Follow the documented missing-capability/callback limitations without inventing endpoints or silently changing backend contracts.

Complete applicable initial/loading/refreshing/empty/data/success/validation/not-found/denied/expired/rate-limit/dependency/network/pending/disabled/unknown/partial states. Provide accessible labels, keyboard/focus/dialog behavior, copy feedback and usable desktop/mobile layouts. Never show a failed read as empty data, fake metrics, or an uncertain mutation as definite success/rollback.

Use the public API base URL (locally http://localhost:3100) with cookie credentials and exact CSRF headers. Preserve session isolation and clear sensitive caches on logout/reset/session loss; prevent stale requests repopulating a previous account. Never automatically retry mutations, retain passwords/recovery codes, or expose privileged environment values. Production restrictions remain in the API reference.

I am away. Do not ask me routine questions or wait for design/package/setup preferences. Use the explicit documents and shadcn defaults, make sensible reversible decisions, and record assumptions. Focus on all work that can be completed without me. If something genuinely requires my credentials, manual database execution, infrastructure restart or deployment authorization, do not do it, guess credentials or weaken the requirement: record the exact outstanding step and continue independent frontend work. No secrets in chat, commands, screenshots or Git.

Verify relevant behavior tests, typecheck, lint, formatting, static build, complete endpoint coverage, and bounded desktop/mobile/keyboard review. Use disposable controlled accounts for local browser walkthroughs when existing services are available. Do not modify real operator accounts or auto-run migrations/setup. If a service/check is unavailable, record the limitation honestly and finish the rest; do not call the blocked feature verified.

Commit after every small coherent completed change, including documentation and each implemented flow, after its applicable checks. Do not save every commit until the end, create empty commits, commit secrets, or include unrelated user changes. Keep the working tree reviewable. Do not push or deploy unless separately authorized. Preserve user-owned processes; stop foreground servers you start and check attributable Node leftovers before finishing.

Update frontend-checklist.md with verified evidence and actual phase commits, update setup/architecture/API documentation only in its owning file when affected, and report delivered flows, checks, commits and exact remaining user-dependent work. Continue until the complete documented local frontend scope is implemented and verified to the extent possible without me; never substitute a smaller convenient scope or claim unavailable checks passed.
```
