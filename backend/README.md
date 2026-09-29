# Dashboard backend

Express API scaffold for the authentication dashboard. It currently serves only `GET /health`; project storage, dashboard authorization, and GoTrue admin calls have not been implemented.

The versioned PostgreSQL schema and VM setup steps are in [db/README.md](db/README.md). The SQL is ready for the existing VM PostgreSQL service; no migration has been applied to the VM from this repository.

## Local run

```bash
cd backend
pnpm install
pnpm start
```

The default listener is port 3000. Set `PORT` to change it.

## VM deployment layout

The VM runs each service as its own Docker Compose project on the external `app_network`. [docker-compose.yml](docker-compose.yml) follows that layout: it builds this backend from source, uses the `auth-dashboard-backend` container name, restarts unless stopped, and publishes **no host port**. Caddy can reach it privately at `auth-dashboard-backend:3000` after a route is added. PostgreSQL and GoTrue can be reached privately as `postgres:5432` and `gotrue:8081` once those integrations exist.

After pulling this repository on the VM:

```bash
cd backend
docker network inspect app_network
docker compose config
docker compose build --pull
docker compose up -d
docker compose ps
docker exec auth-dashboard-backend node -e "fetch('http://127.0.0.1:3000/health').then(async r => { console.log(r.status, await r.text()); process.exit(r.ok ? 0 : 1) })"
```

The image uses the backend's own lockfile. `app_network` must already exist, as documented in the VM reference. The Compose file has no `ports:` mapping, matching GoTrue and the realtime server. Add a Caddy route only when authenticated browser-facing API routes are implemented and a dashboard API hostname is chosen. Do not publish PostgreSQL, the GoTrue admin JWT, or database credentials to the browser.

Use a VM-local `.env` or secret mount for future credentials and reference it from Compose when those integrations are implemented. The example environment file contains no secrets. The frontend is not currently deployed by this Compose project.
