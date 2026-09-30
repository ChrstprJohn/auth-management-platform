# Dashboard backend

Express API for the authentication dashboard. Project create/list/read routes use Prisma and the separate dashboard database. They now require a verified GoTrue access token and dashboard administrator permission. GoTrue admin calls and frontend integration are still pending.

The Prisma schema, local PostgreSQL Compose setup, and future VM database steps are in [DATABASE.md](DATABASE.md). No migration has been applied to the VM from this repository.

## Local run

```bash
cd backend
pnpm install
cp .env.example .env
docker compose -f compose.local.yml up -d
pnpm db:deploy
pnpm dev
```

The default listener is port 3000. Set `PORT` to change it. Use `pnpm build && pnpm start` to run the compiled production entry point locally.

## Project API

| Method | Path | Result |
|---|---|---|
| `POST` | `/api/projects` | Create a project from `slug`, `name`, and optional `description` |
| `GET` | `/api/projects?limit=20&cursor=<UUID>` | List projects newest first, with `nextCursor` for pagination |
| `GET` | `/api/projects/:id` | Get a project by UUID |
| `GET` | `/health` | Process liveness |
| `GET` | `/health/ready` | Database readiness |

Example local request:

```bash
curl -i -X POST http://127.0.0.1:3000/api/projects \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <YOUR_ACCESS_TOKEN>' \
  -d '{"slug":"crm","name":"CRM"}'
```

Project slugs are unique lowercase URL identifiers. Requests return `{ "data": ... }`; the list includes `nextCursor`. Validation errors use HTTP 400, duplicate slugs use 409, and missing projects use 404. Run `pnpm test:integration` with the local PostgreSQL container running to exercise the routes; the test deletes its own project.

## Code layers

- `src/modules/projects/project.routes.ts` maps HTTP methods and paths.
- `src/modules/projects/project.controller.ts` handles HTTP request and response objects.
- `src/modules/projects/project.service.ts` validates input and owns project rules.
- `src/modules/projects/project.repository.ts` contains Prisma queries.
- `src/db/prisma.ts` creates the shared database client.
- `src/middleware/error-handler.ts` maps known failures to API responses.

The frontend still shows mock projects. Connect its login to GoTrue and send access tokens with requests to these routes.

## Authentication and first administrator

Set `GOTRUE_URL=https://auth.chrbuilds.dev` in the local backend `.env`. On the VM set `GOTRUE_URL=http://gotrue:8081`. Use a trusted URL: the backend forwards the caller's token to GoTrue's `/user` endpoint with a five-second timeout. This check needs no GoTrue signing secret or operator credential.

Project requests require `Authorization: Bearer <access_token>`. After GoTrue verifies the user, the backend checks their UUID in `dashboard.dashboard_admins`. Missing/invalid tokens return 401, ordinary users return 403, and auth configuration/upstream failures return 503. Health routes stay accessible. User metadata cannot grant dashboard permission.

Confirm your existing GoTrue account's UUID, then bootstrap your first administrator in a trusted psql session connected to **dashboard_db**:

```sql
INSERT INTO dashboard.dashboard_admins (gotrue_user_id)
VALUES ('YOUR-GOTRUE-USER-UUID')
ON CONFLICT DO NOTHING;
```

This grants dashboard access only, not GoTrue operator privileges. Delete the corresponding row to revoke access; membership is checked on every project request.

Run `pnpm test` for authorization checks with mocked GoTrue/database responses. Run `pnpm test:integration` with local PostgreSQL for real project persistence. The integration test mocks GoTrue and creates/cleans up a temporary admin and project; it does not modify VM accounts.

## VM deployment layout

The VM runs each service as its own Docker Compose project on the external `app_network`. [docker-compose.yml](docker-compose.yml) follows that layout: it builds this backend from source, uses the `auth-dashboard-backend` container name, restarts unless stopped, and publishes **no host port**. Caddy can reach it privately at `auth-dashboard-backend:3000` after a route is added. PostgreSQL and GoTrue can be reached privately as `postgres:5432` and `gotrue:8081` once those integrations exist.

After pulling this repository on the VM, create a VM-local `backend/.env` with a `DATABASE_URL` for the separate `dashboard_db` at `postgres:5432`. Do not copy the local example's password or `127.0.0.1:5433` URL. Then:

```bash
cd backend
docker network inspect app_network
docker compose config
docker compose --profile maintenance build --pull
docker compose --profile maintenance run --rm migrate
docker compose up -d
docker compose ps
docker exec auth-dashboard-backend node -e "fetch('http://127.0.0.1:3000/health').then(async r => { console.log(r.status, await r.text()); process.exit(r.ok ? 0 : 1) })"
```

The production image uses the backend's own lockfile. The one-off `migrate` service uses a build stage containing Prisma CLI, applies pending migrations, then exits. `app_network` must already exist, as documented in the VM reference. The Compose file has no `ports:` mapping, matching GoTrue and the realtime server. Add a Caddy route only when authenticated browser-facing API routes are implemented and a dashboard API hostname is chosen. Do not publish PostgreSQL, the GoTrue admin JWT, or database credentials to the browser.

Keep the VM-local `.env` out of Git. The frontend is not currently deployed by this Compose project.
