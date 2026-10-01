# GoTrue operator backend

Express/TypeScript only. No frontend or database setup is performed by this application. Endpoint usage lives in [the API reference](../../documentation/gotrue-dashboard/api.md).

## Local setup

Use Node.js 24.15.0 (pinned in `.node-version`) and pnpm 11.19.0. From the repository root run `pnpm install`, then `pnpm run build` to build the server-only workspace packages. Do not force/recreate dependencies.

The user provisions the separate admin database/runtime role and executes the prepared SQL following [admin database instructions](../../packages/database/admin/README.md). Do not use GoTrue credentials as the API database role. GoTrue must already be available; local infrastructure instructions live [here](../../infrastructure/local/README.md).

Copy this folder's `.env.example` to `.env`, replace every placeholder, generate a dedicated encryption key with the command in the example, and configure verified controlled operator UUIDs. Obtain the UUID from a trusted supported GoTrue response, then put it in `OPERATOR_UUID_ALLOWLIST`; email or user metadata never grant authority. Environment changes require a restart. Secrets must remain Git-ignored.

Run `pnpm dev` from the root in the foreground. Stop with Ctrl+C. Production runs compiled JavaScript with `pnpm --filter @auth/gotrue-admin-api start`; set HOST to the container bind address, HTTPS same-site frontend origins, and TRUST_PROXY to the actual Caddy IP/subnet. No production deployment is included.

## Local management verification

The manual `pnpm exec tsx scripts/verify-local-management.ts` walkthrough passed on 2026-10-01 against existing PostgreSQL and pinned GoTrue. It uses disposable accounts and a temporary process-only allowlist/deletion flag; it never edits real operator configuration or runs setup SQL. It verifies operator authorization, safe bounded list/details, both creation modes without invitation email, ban duration and existing-token rejection, unban, permanent deletion, audit/session restart persistence, two-instance last-operator protection, eligibility removal and logout. It removes disposable identities and retains durable audit history. The walkthrough subsequently passed with admin_api_runtime after the user updated the connection; read-only metadata confirmed the expected restricted role flags.

The management probe also verifies persisted session expiry with a test-only two-second cap on the returned upstream lifetime. It checks that the session works before expiry, then that every protected route rejects absent, malformed and expired cookies through another gateway. Temporary process-only GoTrue/database URLs targeting a closed local port verify safe dependency failure: liveness succeeds, readiness/login return 503, and no dashboard cookie or credential-bearing response is issued. Infrastructure is not stopped and the production one-hour policy is unchanged. The compiled server's registered SIGTERM handler was verified in a temporary foreground process on port 3101 after readiness, exiting successfully and leaving no listener. Successful shutdown lets Node finish native-handle cleanup rather than forcing an immediate exit.

## First local operator

The setup command uses built-in Windows PowerShell (`powershell.exe`); PowerShell 7 (`pwsh`) is not required. Its execution-policy override applies only to this command's process and does not change the machine policy.

With local GoTrue/Mailpit running, run `pnpm operator:setup` from the repository root in your own PowerShell terminal. It opens a Windows setup dialog with pasteable email and masked password fields (Ctrl+V or right-click Paste), submits the supported signup flow, then waits while you verify the email at `http://localhost:8025`. After clicking OK, it validates password login/identity and saves the verified UUID in `OPERATOR_UUID_ALLOWLIST`, preserving existing configured operators and other `.env` values. You do not need to copy or manually enter the UUID. It does not save the password, display tokens, apply SQL or provision databases/roles. Restart the API afterward. For console prompts instead, run `pnpm operator:setup -Terminal`.

If signup already succeeded but setup was interrupted, select "I already created this account" in the window, or run `pnpm operator:setup -ExistingAccount`; this skips signup and verifies the existing account instead. Failed/uncertain signup is never automatically repeated. Confirmation redirects may fail until a frontend exists; login is the check that confirms verification actually succeeded. This is a trusted local-only tool, not a public signup/permission endpoint. Production and remote upstream URLs are refused.

## Local GoTrue admin token

After creating the backend `.env`, run `pnpm admin:token` from the repository root. This local-only helper reads the existing `GOTRUE_JWT_SECRET` and admin-role/audience configuration in `infrastructure/local/.env`, signs a sessionless HS256 `service_role` JWT valid for 30 days, and saves only `GOTRUE_ADMIN_TOKEN` into the backend `.env`. It never prints the token/signing secret, touches a database, or changes other configuration. Existing non-placeholder tokens are preserved; remove the token line deliberately and rerun to regenerate, then restart the API. It requires a loopback HTTP GoTrue URL and refuses production mode. Do not use this helper for VM/production secrets.

The pinned [admin credential middleware](https://github.com/supabase/auth/blob/v2.196.0/internal/api/middleware.go) accepts sessionless admin-role tokens, and the [JWT verifier](https://github.com/supabase/auth/blob/v2.196.0/internal/api/auth.go) supports signing with the configured HS256 secret.

## Password recovery setup

For an existing admin database at baseline 0002, the user executes only `packages/database/admin/migrations/0003_operator_recovery.sql` and grants the runtime role access as described in the [database README](../../packages/database/admin/README.md). Do not rerun the full schema on existing tables. Readiness now checks `operator_recovery`, so an unapplied migration returns unavailable.

Locally `RECOVERY_CALLBACK_URL` defaults to `http://localhost:3100/v1/operator/auth/recovery/callback`, and `RECOVERY_RESET_URL` defaults to `http://localhost:5173/reset-password`. The callback must be in GoTrue's URI allowlist; follow the [local infrastructure instructions](../../infrastructure/local/README.md#backend-and-later-deployment), preserving existing entries. The user restarts GoTrue for changed infrastructure configuration and restarts the API after database/configuration setup. Production requires explicit HTTPS same-site callback/reset URLs and an existing permitted frontend origin; old production configuration without them will fail validation. Defaults support the current local port only; configure the callback explicitly for another port.

Endpoint requests and cookie-preserving examples live in the [recovery API reference](../../documentation/gotrue-dashboard/api.md#password-recovery-implemented-isolated-verification). Open the email in the same browser that requested recovery. A different browser has no recovery cookie and is rejected. The final reset page is a frontend integration contract; it has not been built. No reset UI or deployment is included here. A generic forgot-password response does not guarantee delivery.

The manual `pnpm exec tsx scripts/verify-local-recovery.ts` probe validates the pinned upstream flow using its existing local frontend callback, a disposable account, and Mailpit. It never uses SQL or changes the configured operator account; it is not part of the automatic test suite. The upstream walkthrough passed on 2026-10-01. After user migration/callback setup, `pnpm exec tsx scripts/verify-local-gateway-recovery.ts` passed the actual gateway/PostgreSQL recovery flow, restart persistence, concurrent reset, session invalidation and new-password login/logout. Both manual probes use disposable accounts; they never apply schema SQL or edit the real operator allowlist.

## Checks

From the root: `pnpm run build`, `pnpm run typecheck`, `pnpm run test`, `pnpm run lint`, and `pnpm run format:check`. Tests substitute upstream/storage adapters and never execute SQL or provision accounts. The build must run before tests because workspace package exports point to compiled files. An isolated passing test does not establish live PostgreSQL or GoTrue behavior.

## Recovery from operator lockout

A trusted server administrator recovers/provisions a verified account through supported GoTrue operations, obtains its UUID, updates the allowlist, and restarts the API. There is no public emergency-access endpoint. Replacing the encryption key invalidates existing sessions; there is no automatic key rotation or token refresh.

The recovery gateway probe also accepts `--expiry`: run `pnpm exec tsx scripts/verify-local-gateway-recovery.ts --expiry` to verify persisted recovery-context expiry with a test-only two-second upstream lifetime cap. Both modes check browser/state/redirect restrictions, callback replay, premature reset and CSRF. The expiry mode confirms rejected reset preserves the password and working dashboard session. Natural upstream OTP expiry remains a separate unverified check.
