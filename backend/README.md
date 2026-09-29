# Dashboard backend

Express API scaffold for the authentication dashboard. It currently serves `GET /health` and a database readiness check at `GET /health/ready`; project storage, dashboard authorization, and GoTrue admin calls have not been implemented.

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
