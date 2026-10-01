# Local GoTrue and Mailpit

## Running setup

- GoTrue `supabase/gotrue:v2.196.0`: `http://localhost:8081`.
- Mailpit `axllent/mailpit:v1.27.0`: inbox at `http://localhost:8025`.
- Existing PostgreSQL 17 container: `local-database-server-postgres-1`.
- Dedicated database/role/schema: `auth_local_db` / `auth_local` / `auth`.
- Docker network: existing `local-database-server_default`.

Compose starts GoTrue and Mailpit only, not another PostgreSQL. GoTrue's 70 migrations applied successfully. Credentials are generated development secrets stored in the Git-ignored `.env`; do not reuse them on the VM.

## Email behavior

`GOTRUE_MAILER_AUTOCONFIRM=false`: signup creates an unconfirmed user and sends a confirmation email to Mailpit. Open the inbox and follow the link to verify; normal password login requires confirmation. Recovery messages also use Mailpit. Mailpit captures messages locally and does not deliver them to real recipients.

GoTrue uses SMTP host `mailpit`, port `1025`, with no SMTP authentication for this isolated local setup. Only the inbox UI is published, on loopback port `8025`.

Verified: signup starts unconfirmed, confirmation email arrives, its link confirms the identity. The temporary test identity/message was removed. Earlier password login, refresh/logout, and admin API smoke checks passed before enabling confirmation.

## Commands

From `infrastructure/local/`:

```powershell
docker compose up -d
docker compose ps
docker compose logs --tail 30 gotrue
Invoke-RestMethod http://localhost:8081/health
```

Stop this local stack:

```powershell
docker compose down
```

This does not remove your existing PostgreSQL databases. Mailpit messages are disposable container data; no persistent mailbox volume is configured.

## Recreating configuration

Copy `.env.example` to `.env` only for a fresh setup; do not overwrite current generated credentials. Fill in the dedicated database connection and a randomly generated JWT secret. URL-encode special characters in connection credentials. Prepare a dedicated empty auth database and owning role before first startup; GoTrue manages its auth migrations.

If the existing database container/network is renamed, update Compose and `DATABASE_URL`. Use Docker container/service names between containers, never `localhost` to reach another container.

## Backend and later deployment

Host-run local APIs use `http://localhost:8081`. Containerized APIs use the GoTrue service name on the local network. Current email links go directly to local `/verify`; frontend redirects may not open until the frontend exists. Later route links through the implemented public backend callbacks.

On the VM, reuse the existing GoTrue/PostgreSQL; do not run this local Compose stack. Configure the chosen real email provider there using that provider's SMTP/authentication requirements, or an explicitly implemented alternative delivery integration. Mailpit is development-only. Keep confirmation required and test delivery/callbacks before launch.

`platform_db`, operator onboarding, and the admin API are not yet implemented. No VM configuration has been changed.

Configuration reference: [pinned upstream example](https://github.com/supabase/auth/blob/v2.196.0/example.env).
