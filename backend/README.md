# Dashboard backend

Express API for the authentication dashboard. Project create/list/read routes use Prisma and the separate dashboard database. Dashboard authorization and GoTrue admin calls are still pending, so do not add a public Caddy route yet.

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

The frontend still shows mock projects. Connect it to these routes after dashboard authorization is in place.

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
