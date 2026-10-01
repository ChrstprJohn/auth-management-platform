# Local GoTrue using existing PostgreSQL

This setup starts one pinned GoTrue image only. It does not start or replace PostgreSQL. No local Caddy is required. Application directories are scaffolding, not implemented apps yet.

Verified local Docker layout: PostgreSQL 17, container `local-database-server-postgres-1`, network `local-database-server_default`, host binding `127.0.0.1:5432`. GoTrue joins that external network and connects directly to the existing container on port 5432.

## PostgreSQL preparation

Use a dedicated empty development database, not an existing application or production database: GoTrue runs its migrations on startup. Suggested name: `auth_local_db`, owned by a dedicated login `auth_local` that can create/manage its `auth` schema. Create the role/database with your existing PostgreSQL admin tool and choose a development password there. Do not store passwords in committed SQL or shell history.

The supplied Compose file already attaches GoTrue to your existing database network. Keep the PostgreSQL project running before starting GoTrue. If you rename that network/container, update Compose and the local database URL. Do not use `localhost` in GoTrue's database URL: it would point at the GoTrue container itself.

Create a separate `platform_db` and restricted application role later when implementing the platform. GoTrue's role must not own that database.

## Configuration and start

From this directory:

```powershell
Copy-Item .env.example .env
```

Edit `.env` locally: set the correct database host/port/name/role/password and a random JWT secret. URL-encode connection-string credentials containing special characters. Configure local SMTP capture for email verification/recovery; otherwise those flows are not ready. Never reuse VM credentials.

```powershell
docker compose config --quiet
docker compose pull gotrue
docker compose up gotrue
```

Run in the foreground initially so startup/migration errors are visible. Stop with Ctrl+C. In another terminal:

```powershell
Invoke-RestMethod http://localhost:8081/health
```

A health response proves the service responds; test signup/database persistence and actual email capture separately. Local backend host processes will use `http://localhost:8081`. Containerized backends use `http://gotrue:8081` on the shared local network.

## Shutdown

```powershell
docker compose down
```

This removes the local GoTrue container, not your existing PostgreSQL data. Never delete auth tables to repair failed migrations; inspect logs and configuration first.

The direct local GoTrue URL is temporary while building the APIs. Production auth/callback traffic will enter the VM backends through Caddy. No VM configuration is changed here.

Configuration reference: [pinned upstream example](https://github.com/supabase/auth/blob/v2.196.0/example.env).
