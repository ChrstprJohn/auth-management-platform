# Dashboard backend

Express API scaffold for the authentication dashboard. It currently serves only `GET /health`; project storage, dashboard authorization, and GoTrue admin calls have not been implemented.

## Local run

```bash
cd backend
pnpm install
pnpm start
```

The default listener is port 3000. Set `PORT` to change it.

## Docker / VM

```bash
docker build -t auth-dashboard-backend ./backend
docker run --rm -p 127.0.0.1:3000:3000 auth-dashboard-backend
```

Run the build command from the repository root. The image uses the backend's own lockfile. On the VM, place the container on the private Docker network used by PostgreSQL and GoTrue. Publish only through Caddy after authenticated API routes exist. Do not publish PostgreSQL, the GoTrue admin JWT, or database credentials to the browser.

When Docker Compose is added, its build context should be `./backend`. Use a VM-local `.env` or secret mount for future credentials.
