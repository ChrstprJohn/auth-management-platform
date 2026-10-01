# GoTrue operator backend

Express/TypeScript only. No frontend or database setup is performed by this application. Endpoint usage lives in [the API reference](../../documentation/gotrue-dashboard/api.md).

## Local setup

Use Node.js 24.15.0 (pinned in `.node-version`) and pnpm 11.19.0. From the repository root run `pnpm install`, then `pnpm run build` to build the server-only workspace packages. Do not force/recreate dependencies.

The user provisions the separate admin database/runtime role and executes the prepared SQL following [admin database instructions](../../packages/database/admin/README.md). Do not use GoTrue credentials as the API database role. GoTrue must already be available; local infrastructure instructions live [here](../../infrastructure/local/README.md).

Copy this folder's `.env.example` to `.env`, replace every placeholder, generate a dedicated encryption key with the command in the example, and configure verified controlled operator UUIDs. Obtain the UUID from a trusted supported GoTrue response, then put it in `OPERATOR_UUID_ALLOWLIST`; email or user metadata never grant authority. Environment changes require a restart. Secrets must remain Git-ignored.

Run `pnpm dev` from the root in the foreground. Stop with Ctrl+C. Production runs compiled JavaScript with `pnpm --filter @auth/gotrue-admin-api start`; set HOST to the container bind address, HTTPS same-site frontend origins, and TRUST_PROXY to the actual Caddy IP/subnet. No production deployment is included.

## Local GoTrue admin token

After creating the backend `.env`, run `pnpm admin:token` from the repository root. This local-only helper reads the existing `GOTRUE_JWT_SECRET` and admin-role/audience configuration in `infrastructure/local/.env`, signs a sessionless HS256 `service_role` JWT valid for 30 days, and saves only `GOTRUE_ADMIN_TOKEN` into the backend `.env`. It never prints the token/signing secret, touches a database, or changes other configuration. Existing non-placeholder tokens are preserved; remove the token line deliberately and rerun to regenerate, then restart the API. It requires a loopback HTTP GoTrue URL and refuses production mode. Do not use this helper for VM/production secrets.

The pinned [admin credential middleware](https://github.com/supabase/auth/blob/v2.196.0/internal/api/middleware.go) accepts sessionless admin-role tokens, and the [JWT verifier](https://github.com/supabase/auth/blob/v2.196.0/internal/api/auth.go) supports signing with the configured HS256 secret.

## Checks

From the root: `pnpm run build`, `pnpm run typecheck`, `pnpm run test`, `pnpm run lint`, and `pnpm run format:check`. Tests substitute upstream/storage adapters and never execute SQL or provision accounts. The build must run before tests because workspace package exports point to compiled files. An isolated passing test does not establish live PostgreSQL or GoTrue behavior.

## Recovery from operator lockout

A trusted server administrator recovers/provisions a verified account through supported GoTrue operations, obtains its UUID, updates the allowlist, and restarts the API. There is no public emergency-access endpoint. Replacing the encryption key invalidates existing sessions; there is no automatic key rotation or token refresh.
