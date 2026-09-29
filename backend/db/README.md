# Dashboard PostgreSQL schema

This schema is for the **existing PostgreSQL container on the VM**, in a **new database** named `dashboard_db`. It must not be run in GoTrue's `auth_db` or `auth` schema. The backend will use a separate role, `dashboard_app`. No new PostgreSQL container or public database port is needed.

## One-time VM setup

After pulling this repository on the VM, open a PostgreSQL admin session using the VM's actual PostgreSQL admin role (shown as `postgres` below):

```bash
docker exec -it postgres psql -U postgres -d postgres
```

In that interactive `psql` session:

```sql
CREATE ROLE dashboard_app LOGIN;
\password dashboard_app
CREATE DATABASE dashboard_db OWNER dashboard_app;
\q
```

`\password` prompts privately instead of putting the password in shell history. If the role/database already exists, inspect it first instead of rerunning creation statements.

From the checked-out repository root on the VM, apply the versioned migration. The redirected file is read by the VM shell and sent to `psql` inside the existing container:

```bash
docker exec -i postgres psql -X -v ON_ERROR_STOP=1 -U dashboard_app -d dashboard_db < backend/db/migrations/001_initial_schema.sql
```

If local `psql` authentication requires a password, use the VM's established credential procedure rather than putting the password on a command line. Run each migration once and in filename order. This migration is transactional, so an error rolls it back.

Verify the result:

```bash
docker exec postgres psql -U dashboard_app -d dashboard_db -c "SELECT version, applied_at FROM dashboard.schema_migrations;"
docker exec postgres psql -U dashboard_app -d dashboard_db -c "\dt dashboard.*"
```

The future backend container will connect to `postgres:5432` across `app_network` using a VM-local database URL for `dashboard_db`. Add that URL to the backend's VM-local environment only when database access is implemented. Do not reuse GoTrue's `auth_user` credential or modify GoTrue-managed tables.

## Data model

| Table | Purpose |
|---|---|
| `dashboard.projects` | Dashboard projects with stable UUIDs and unique URL slugs |
| `dashboard.project_memberships` | Links a GoTrue user UUID to one or more projects, with `member` or `manager` role |
| `dashboard.dashboard_admins` | GoTrue user UUIDs allowed to operate this dashboard |
| `dashboard.schema_migrations` | Records applied dashboard migrations |

The UUID columns intentionally have no foreign key into `auth_db`: PostgreSQL cannot create a foreign key across separate databases. The future backend must verify GoTrue user IDs before adding memberships or admins. A `user_metadata.app_id` value supplied during signup is not authoritative for membership.
