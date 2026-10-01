# GoTrue operator frontend

React/strict TypeScript static SPA. Uses the existing operator API; never calls GoTrue directly or applies database setup. Feature scope and contracts live in the [frontend requirements](../../documentation/gotrue-dashboard/frontend-requirements.md) and [API reference](../../documentation/gotrue-dashboard/api.md).

Use Node 24.15.0 and pnpm 11.19.0. From the repository root run ordinary `pnpm install`, then `pnpm build`. Run `pnpm web:dev` in the foreground at `http://localhost:5173`, and stop with Ctrl+C. The strict port prevents accidental trusted-origin changes. Run the separately configured API at `http://localhost:3100`; database/infrastructure preparation remains user-managed.

The sole public setting is `VITE_API_BASE_URL`, defaulting to `http://localhost:3100`. Copy `.env.example` only if you need to change it. It must be an HTTP(S) origin without credentials, path, query or fragment. Never add backend credentials to Vite configuration. Keep `localhost` consistent across browser/API/recovery configuration.

`pnpm web:test`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, and `pnpm build` verify the frontend and repository. Isolated browser fixtures do not prove real GoTrue, cookie/CORS, mail or storage integration. Verification evidence and remaining checks are tracked in the [frontend checklist](../../documentation/gotrue-dashboard/frontend-checklist.md).

After building, `pnpm exec tsx scripts/check-web-assets.ts` checks emitted assets for server-only markers and locally configured credential values without printing those values. No server environment is imported by the browser app.

Manual foreground review uses `pnpm exec tsx scripts/verify-local-web.ts` with headless Microsoft Edge installed. It starts/stops its own Vite listener and captures controlled fixture screenshots under ignored `artifacts/web-review/`. `--live` is Mailpit-only, checks the running container capture settings before mutations, and requires already running local GoTrue, explicit Mailpit capture mode and user-prepared admin database, plus the existing ignored API `.env`. It creates disposable identities, uses temporary API listeners on 3101/3102 with a process-only allowlist/deletion policy, and performs ordinary application queries. It never starts infrastructure or runs setup SQL. Since GoTrue keeps the existing callback URL, the test browser rewrites only the verification response's callback origin to 3101; the real gateway callback and reset run with the same browser cookies. It removes owned identities/mail, retains durable audit and closes its resources. This verifies local integration, not production deployment or a changed infrastructure callback configuration.

shadcn CLI 4.21.0 generated the `base-nova` style with Base UI, neutral default tokens and Lucide. Owned component source lives under `src/components/ui`; the official current registry supplied Field, Empty, Spinner and Input Group alongside screen controls. Sonner is the single supplemental notifier.

Production output is `dist/`. Static hosting must route direct destinations (including `/reset-password`) to `index.html`. The API and frontend require the documented same-site HTTPS custom domains and exact trusted origins. Hosting and deployment are separately authorized work.

For final hosted Resend setup and user-operated restart/live checks, follow [SMTP setup](../../infrastructure/local/README.md). Recovery UI stays provider-neutral; the API key is server-only. Review the create dialog with `pnpm exec tsx scripts/verify-local-web.ts --create-review --ui-review=after --review-port=5174`; `confirm` is the single confirmation pass. This fixture run sends no email.
