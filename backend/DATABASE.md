# Dashboard database

The dashboard uses a separate `dashboard_db` on the existing VM PostgreSQL server. GoTrue keeps its own `auth_db`. The [Prisma schema](prisma/schema.prisma) models the dashboard tables, and [Prisma migrations](prisma/migrations/) are the single source of schema changes. Do not run an older standalone SQL copy as well.

## Local development

Start Docker Desktop, then from `backend/`:

```bash
docker compose -f compose.local.yml up -d
cp .env.example .env
pnpm install
pnpm db:deploy
pnpm dev
```

The local container uses PostgreSQL 17 and binds only to `127.0.0.1:5433`. Its password is a **local-only example** in `compose.local.yml`; never use it on the VM. The named Docker volume keeps local data between container restarts. `docker compose -f compose.local.yml down` stops/removes the container while preserving its data volume.

Check it with:

```bash
docker compose -f compose.local.yml ps
docker compose -f compose.local.yml exec postgres psql -U dashboard_app -d dashboard_db -c "\dt dashboard.*"
curl http://127.0.0.1:3000/health/ready
```

The readiness route returns HTTP 200 only when the backend can query PostgreSQL. The normal `/health` route checks only the Express process.

## VM database setup later

After pulling the repository on the VM, create a separate login and database on the existing `postgres` container. Use the VM's actual PostgreSQL admin role (shown as `postgres` here):

```bash
docker exec -it postgres psql -U postgres -d postgres
```

In the interactive `psql` session:

```sql
CREATE ROLE dashboard_app LOGIN;
\password dashboard_app
CREATE DATABASE dashboard_db OWNER dashboard_app;
\q
```

The backend's VM-local `DATABASE_URL` should point to `postgres:5432/dashboard_db?schema=dashboard` with the `dashboard_app` password. Do not commit that URL. Create the VM-local `backend/.env`, then run `docker compose --profile maintenance run --rm migrate` from `backend/` after building the migration image. That one-off container joins `app_network` and can reach `postgres:5432`. Do **not** use `prisma migrate dev` against the VM database.

Prisma records applied migrations in its own `_prisma_migrations` table. Never run the initial migration twice by hand. The initial migration creates `dashboard.projects`, `dashboard.project_memberships`, and `dashboard.dashboard_admins`. The second migration adds the checked open/closed enrollment policy and `dashboard.audit_events`. Both migrations are applied locally; deploy them through the migration job on the VM.

The UUIDs in memberships/admins refer to GoTrue users in a different database, so PostgreSQL cannot enforce a cross-database foreign key. The backend checks user IDs through GoTrue before administrative grants. Self-enrollment uses the verified caller identity. User-supplied `app_id` metadata is not an authority for project access.
