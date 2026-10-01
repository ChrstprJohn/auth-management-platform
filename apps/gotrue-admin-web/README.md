# GoTrue operator frontend

React/strict TypeScript static SPA. Uses the existing operator API; never calls GoTrue directly or applies database setup. Feature scope and contracts live in the [frontend requirements](../../documentation/gotrue-dashboard/frontend-requirements.md) and [API reference](../../documentation/gotrue-dashboard/api.md).

Use Node 24.15.0 and pnpm 11.19.0. From the repository root run ordinary `pnpm install`, then `pnpm build`. Run `pnpm web:dev` in the foreground at `http://localhost:5173`, and stop with Ctrl+C. The strict port prevents accidental trusted-origin changes. Run the separately configured API at `http://localhost:3100`; database/infrastructure preparation remains user-managed.

The sole public setting is `VITE_API_BASE_URL`, defaulting to `http://localhost:3100`. Copy `.env.example` only if you need to change it. It must be an HTTP(S) origin without credentials, path, query or fragment. Never add backend credentials to Vite configuration. Keep `localhost` consistent across browser/API/recovery configuration.

`pnpm web:test`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, and `pnpm build` verify the frontend and repository. Isolated browser fixtures do not prove real GoTrue, cookie/CORS, mail or storage integration. Verification evidence and remaining checks are tracked in the [frontend checklist](../../documentation/gotrue-dashboard/frontend-checklist.md).

shadcn CLI 4.21.0 generated the `base-nova` style with Base UI, neutral default tokens and Lucide. Owned component source lives under `src/components/ui`; the official current registry supplied Field, Empty, Spinner and Input Group alongside screen controls. Sonner is the single supplemental notifier.

Production output is `dist/`. Static hosting must route direct destinations (including `/reset-password`) to `index.html`. The API and frontend require the documented same-site HTTPS custom domains and exact trusted origins. Hosting and deployment are separately authorized work.
