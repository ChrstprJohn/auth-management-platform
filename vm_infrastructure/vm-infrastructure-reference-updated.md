# Azure VM Infrastructure Reference

> Updated for the current reusable realtime and authentication layout. No passwords, API keys, JWT secrets, or other secret values are included. Values shown as placeholders must remain local to the VM.

## VM

- **Platform:** `Azure VM`
- **OS:** `Ubuntu 22.04 LTS`
- **SSH user:** `azureuser`
- **Current/example public IP:** `13.70.4.46`
- **Memory:** 1 GiB
- **vCPUs:** 2
- **Threads per core:** 2

Verify the public IP before changing DNS or firewall rules; the address above is infrastructure reference data, not a permanent guarantee.

## Architecture

Internet traffic enters through **Caddy**, which provides HTTPS/TLS and routes to private Docker services on the shared external Docker network `app_network`.

~~~text
Internet
  └─ chrbuilds.dev subdomains
       └─ Caddy (:80, :443)
            ├─ n8n.chrbuilds.dev → n8n:5678
            ├─ api.chrbuilds.dev → hello_api:3000
            ├─ realtime.chrbuilds.dev → centrifugo:8000
            └─ auth.chrbuilds.dev → gotrue:8081

Docker network: app_network
  ├─ caddy
  ├─ n8n
  ├─ hello_api
  ├─ postgres
  ├─ mongodb
  ├─ centrifugo
  ├─ realtime-server
  └─ gotrue
~~~

The realtime path has two separate responsibilities:

~~~text
Future app backend
       │ HTTP, private Docker network
       ▼
realtime-server:3000
       │ Centrifugo HTTP API, private Docker network
       ▼
centrifugo:8000
       │ WebSocket through Caddy
       ▼
Browser or app client
~~~

There is one shared Centrifugo instance for current and future applications. Applications are separated logically with application-prefixed channel names and authorization rules; they do not need one Centrifugo container per app.

The authentication path is separate from application data and realtime delivery:

~~~text
Application frontend or backend
       │ HTTPS auth requests
       ▼
auth.chrbuilds.dev
       │ Caddy reverse proxy
       ▼
gotrue:8081
       │ GoTrue auth API and JWT issuer
       ▼
PostgreSQL → auth_db → auth schema
~~~

`auth_db` is the private database used by GoTrue. Application databases remain separate; application tables should store their own data and reference the GoTrue user UUID when needed.

## Containers and ports

| Container | Internal port | Host exposure | Purpose |
|---|---:|---|---|
| `caddy` | 80, 443 | Public `80`, `443` | Reverse proxy and HTTPS/TLS |
| `n8n` | 5678 | Via Caddy | n8n service and future workflow/email automation |
| `hello_api` | 3000 | `127.0.0.1:3000:3000` | API service; local host binding |
| `postgres` | 5432 | `127.0.0.1:5432:5432` | PostgreSQL; local host binding |
| `mongodb` | 27017 | Not exposed | Private MongoDB database |
| `centrifugo` | 8000 | Via Caddy only | WebSocket, HTTP API, dashboard, and health endpoint |
| `realtime-server` | 3000 | Not exposed | Reusable JWT and publish API for app backends |
| `gotrue` | 8081 | Via Caddy only | Self-hosted GoTrue authentication API |

Applications and containers on `app_network` use Docker service/container names for private communication:

~~~text
postgres:5432
mongodb:27017
centrifugo:8000
realtime-server:3000
gotrue:8081
~~~

Do not use the VM public IP for internal service-to-service traffic. Do not use `localhost` from one container to reach another container.

## Realtime infrastructure

The complete realtime system is grouped under one VM directory:

~~~text
~/realtime/
├── centrifugo/
│   ├── config.json
│   └── docker-compose.yml
└── server/
    ├── .env
    ├── Dockerfile
    ├── docker-compose.yml
    ├── package.json
    └── src/
        └── index.js
~~~

### Centrifugo

- **Container:** `centrifugo`
- **Image:** `centrifugo/centrifugo:v6` (runtime previously observed as `6.9.3`; verify the local Compose file)
- **Internal port:** `8000`
- **Network:** external `app_network`
- **Host port:** not directly published
- **Public URL:** `https://realtime.chrbuilds.dev`
- **WebSocket URL:** `wss://realtime.chrbuilds.dev/connection/websocket`
- **Current engine:** memory engine for the single-server setup

Caddy routes `realtime.chrbuilds.dev` to `centrifugo:8000`. Centrifugo's internal port must remain private; Caddy is the public entry point.

The configuration contains functional areas for client JWT verification, allowed browser origins, the admin interface, the HTTP API, health checks, presence, join/leave events, and short channel history. Secret values remain only in the VM-local `config.json`.

### Realtime server

The `realtime-server` is the reusable application-facing control layer around Centrifugo. It is a separate container and is not placed inside the Centrifugo container.

Current API:

| Method | Path | Purpose | Intended caller |
|---|---|---|---|
| `GET` | `/health` | Check that the Node service is alive | VM/operator or internal monitor |
| `POST` | `/token` | Create a one-hour Centrifugo connection JWT for a user ID | Authenticated app backend |
| `POST` | `/publish` | Publish a JSON event to one Centrifugo channel | App backend |

The server listens on `:3000` inside its container. Its Compose project intentionally has no `ports:` mapping, so it is reachable only by containers on `app_network`, for example:

~~~text
http://realtime-server:3000/health
http://realtime-server:3000/token
http://realtime-server:3000/publish
~~~

It calls Centrifugo internally through:

~~~text
CENTRIFUGO_URL=http://centrifugo:8000
~~~

The browser does not call `realtime-server` directly in the current layout. The app backend requests a token, returns that token through the app's own authenticated flow, and the browser connects to the public Centrifugo WebSocket URL.

### Realtime environment variables

The server's `~/realtime/server/.env` contains names like these:

| Variable | Non-secret purpose |
|---|---|
| `PORT` | Internal HTTP listener, currently `3000` |
| `CENTRIFUGO_URL` | Internal Centrifugo URL, currently `http://centrifugo:8000` |
| `CENTRIFUGO_JWT_SECRET` | Secret used by the server to sign client JWTs; must match Centrifugo's `client.token.hmac_secret_key` |
| `CENTRIFUGO_API_KEY` | Secret used for server-to-Centrifugo HTTP API calls; must match Centrifugo's `http_api.key` |

Never print the actual `.env` contents in chat, documentation, GitHub, browser code, or public logs.

## Authentication infrastructure

GoTrue is deployed as a standalone self-hosted authentication service, not as the full Supabase platform. It is currently used primarily for:

- Email/password account creation and sign-in.
- Access and refresh token issuance.
- Current-user/session operations.
- Future user verification, recovery, OAuth, MFA, and administrative operations as those features are enabled.

Current deployment facts:

| Item | Current value |
|---|---|
| Public URL | `https://auth.chrbuilds.dev` |
| Container | `gotrue` |
| Image | `supabase/gotrue:v2.196.0` |
| Internal listener | `gotrue:8081` |
| Compose directory | `~/auth/gotrue` |
| PostgreSQL container | `postgres` |
| Database | `auth_db` |
| Database role | `auth_user` |
| GoTrue schema | `auth` |
| Docker network | external `app_network` |
| JWT lifetime configured | `3600` seconds |
| JWT audience configured | `authenticated` |
| Email delivery | Deferred; current logs showed the GoTrue Noop mail client |

The current GoTrue Compose project uses an external `app_network`, loads a VM-local `.env`, and does not publish port `8081` to the host. Caddy is the only public entry point.

The current VM-local environment includes the following configuration names. Values are intentionally redacted here:

~~~env
API_EXTERNAL_URL=https://auth.chrbuilds.dev
GOTRUE_SITE_URL=https://auth.chrbuilds.dev
GOTRUE_DB_DRIVER=postgres
DATABASE_URL=postgres://auth_user:<REDACTED>@postgres:5432/auth_db?search_path=auth
GOTRUE_DB_MIGRATIONS_PATH=/usr/local/etc/auth/migrations
GOTRUE_JWT_SECRET=<REDACTED>
GOTRUE_JWT_EXP=3600
GOTRUE_JWT_AUD=authenticated
GOTRUE_EXTERNAL_EMAIL_ENABLED=true
GOTRUE_EXTERNAL_GOOGLE_ENABLED=false
~~~

The `search_path=auth` portion is important in this deployment because GoTrue's tables live in the `auth` schema. Do not expose or copy the real connection string or JWT secret.

SMTP/email delivery is intentionally deferred to a later n8n-based workflow/provider setup. Until that is configured, do not assume that confirmation, recovery, magic-link, or OTP email messages can reach users even though the auth API and database are working.

For the full API, database, JWT, maintenance, and troubleshooting reference, see `auth-server-reference.md` in this documentation set.

## MongoDB

MongoDB runs as a private, server-side Docker database using:

~~~text
mongodb/mongodb-community-server:latest
~~~

The container is named `mongodb`, uses internal port `27017`, is attached to `app_network`, and has no host or public port exposure. Applications connect through:

~~~text
mongodb:27017
~~~

MongoDB data is stored in the named Docker volume:

~~~text
mongodb_mongodb_data
~~~

MongoDB authentication is enabled using credentials stored in its local `.env` file. That file must not be committed to GitHub.

## VM directory structure

~~~text
~/apps/hello_api/
~/infrastructure/caddy/Caddyfile
~/n8n/docker-compose.yml
~/postgres/docker-compose.yml
~/mongodb/docker-compose.yml
~/mongodb/.env
~/auth/gotrue/docker-compose.yml
~/auth/gotrue/.env
~/realtime/centrifugo/config.json
~/realtime/centrifugo/docker-compose.yml
~/realtime/server/.env
~/realtime/server/Dockerfile
~/realtime/server/docker-compose.yml
~/realtime/server/package.json
~/realtime/server/src/index.js
~~~

The services are managed as separate Docker Compose projects. The external/shared `app_network` allows those projects to communicate privately using service names.

## Caddy routes

~~~text
n8n.chrbuilds.dev       → n8n:5678
api.chrbuilds.dev       → hello_api:3000
realtime.chrbuilds.dev  → centrifugo:8000
auth.chrbuilds.dev      → gotrue:8081
~~~

The `auth.chrbuilds.dev` route is a root-path GoTrue route. For this direct GoTrue deployment, the health and auth endpoints are `/health`, `/signup`, `/token`, `/user`, `/logout`, `/recover`, and `/verify`; there is no required `/auth/v1` prefix in the current Caddy configuration.

Caddy is the intended public web entry point. The realtime server and GoTrue's internal ports are not public host mappings in the current design.

## DNS

~~~text
n8n.chrbuilds.dev       → 13.70.4.46
api.chrbuilds.dev       → 13.70.4.46
realtime.chrbuilds.dev  → 13.70.4.46
auth.chrbuilds.dev      → 13.70.4.46
~~~

If the VM public IP changes, update DNS and verify Caddy certificate and routing behavior.

## Deployment workflow

~~~text
Local development or VM edit
        ↓
Versioned source/configuration update
        ↓
Pull/update on VM
        ↓
Validate Compose/configuration
        ↓
Build or recreate the affected container
        ↓
Health check and logs
        ↓
End-to-end test for the affected service
~~~

Keep application source and infrastructure configuration versioned where appropriate. Keep secrets outside committed files.

## Important commands

General VM checks:

~~~bash
ssh azureuser@YOUR_VM_IP
docker ps
docker network ls
docker network inspect app_network
docker logs <container_name>
~~~

Run Compose commands from the relevant directory. For the realtime services:

~~~bash
cd ~/realtime/centrifugo
docker compose ps
docker compose up -d

cd ~/realtime/server
docker compose ps
docker compose up -d
~~~

For GoTrue:

~~~bash
cd ~/auth/gotrue
docker compose ps
docker compose up -d
docker logs --tail 100 gotrue
~~~

Test GoTrue inside the container and through Caddy:

~~~bash
docker exec gotrue wget -qO- http://127.0.0.1:8081/health
curl -i https://auth.chrbuilds.dev/health
~~~

The public health response should identify `GoTrue` and version `v2.196.0`. Never paste access tokens, refresh tokens, passwords, connection strings, or JWT secrets into logs, tickets, or documentation.

### Centrifugo checks and updates

~~~bash
cd ~/realtime/centrifugo
docker compose config
docker compose ps
docker logs centrifugo --tail 50
docker inspect centrifugo --format '{{.State.Status}}'
docker inspect centrifugo --format '{{json .NetworkSettings.Networks}}'
~~~

The expected startup log includes:

~~~text
serving websocket, api, admin, health endpoints on :8000
~~~

Validate the local configuration without exposing its contents:

~~~bash
cd ~/realtime/centrifugo
docker run --rm \
  -v "$PWD:/centrifugo" \
  centrifugo/centrifugo:v6 \
  centrifugo checkconfig -c /centrifugo/config.json
~~~

For an intentional image/configuration update:

~~~bash
cd ~/realtime/centrifugo
docker compose pull
docker compose up -d
docker compose ps
docker logs centrifugo --tail 50
~~~

Do not replace `config.json` with a template containing placeholder secrets unless you are deliberately editing the VM-local file and restoring the real values before startup.

### Realtime-server checks and updates

~~~bash
cd ~/realtime/server
docker compose ps
docker logs realtime-server --tail 50
docker inspect realtime-server --format '{{.State.Status}}'
docker inspect realtime-server --format '{{json .NetworkSettings.Networks}}'
~~~

View only safe environment entries:

~~~bash
cd ~/realtime/server
grep -E '^(PORT|CENTRIFUGO_URL)=' .env
~~~

When source or the Dockerfile changes:

~~~bash
cd ~/realtime/server
docker compose build --pull
docker compose up -d
docker compose ps
docker logs realtime-server --tail 50
~~~

When only environment values change, recreate the container so Compose reloads `.env`:

~~~bash
cd ~/realtime/server
docker compose up -d
docker compose ps
~~~

The server has no persistent Docker volume. `docker compose down` removes its container, not application database data; secrets remain in the VM-local `.env` file.

### GoTrue checks and updates

~~~bash
cd ~/auth/gotrue
docker compose ps
docker logs --tail 100 gotrue
docker inspect gotrue --format '{{.State.Status}}'
docker inspect gotrue --format '{{json .NetworkSettings.Networks}}'
~~~

View only non-secret configuration entries:

~~~bash
cd ~/auth/gotrue
grep -E '^(API_EXTERNAL_URL|GOTRUE_SITE_URL|GOTRUE_DB_DRIVER|GOTRUE_DB_MIGRATIONS_PATH|GOTRUE_JWT_EXP|GOTRUE_JWT_AUD|GOTRUE_EXTERNAL_EMAIL_ENABLED|GOTRUE_EXTERNAL_GOOGLE_ENABLED)=' .env
~~~

When the GoTrue image or configuration changes, validate the Compose file, recreate the affected service, then check migrations and health:

~~~bash
cd ~/auth/gotrue
docker compose config
docker compose up -d --force-recreate gotrue
docker compose ps
docker logs --tail 100 gotrue
curl -i https://auth.chrbuilds.dev/health
~~~

Do not manually edit `auth` tables or `auth.schema_migrations` as part of a normal deployment. GoTrue owns those migrations; use a backup and a version-specific recovery plan if an upgrade reports schema drift.

### Realtime health and connectivity tests

Test the server from inside its container:

~~~bash
docker exec realtime-server wget -qO- http://127.0.0.1:3000/health
~~~

Expected response:

~~~json
{"status":"ok","service":"realtime-server"}
~~~

Test server-to-Centrifugo Docker connectivity:

~~~bash
docker exec realtime-server wget -qO- http://centrifugo:8000/
~~~

A normal Centrifugo response proves Docker DNS and `app_network` connectivity. Test the public route separately:

~~~bash
curl -I https://realtime.chrbuilds.dev
~~~

The public WebSocket path is:

~~~text
wss://realtime.chrbuilds.dev/connection/websocket
~~~

Test token generation only in a private VM terminal. The returned JWT is a secret credential and must not be pasted into documentation or chat:

~~~bash
docker exec realtime-server wget -qO- \
  --header="Content-Type: application/json" \
  --post-data='{"userId":"YOUR_TEST_USER_ID"}' \
  http://127.0.0.1:3000/token
~~~

An end-to-end publish test also needs an authorized client subscription. A successful `/publish` response by itself proves only that the server called Centrifugo; it does not prove a browser was allowed to subscribe or received the event.

### MongoDB checks and connectivity tests

~~~bash
cd ~/mongodb
docker compose ps
docker logs mongodb --tail 50
docker volume inspect mongodb_mongodb_data
~~~

Test MongoDB through the shared Docker network:

~~~bash
docker run --rm --network app_network mongo:latest mongosh \
  --host mongodb \
  --eval "db.adminCommand({ ping: 1 })"
~~~

Test authenticated access using the local MongoDB credentials without placing them in a command history or document:

~~~bash
docker exec -it mongodb mongosh \
  -u "mongo_admin" \
  -p \
  --authenticationDatabase admin \
  --eval "db.adminCommand({ ping: 1 })"
~~~

## Security model and crucial rules

- Do not commit passwords, API keys, JWT secrets, tokens, or private connection strings to GitHub.
- Keep PostgreSQL bound to `127.0.0.1`; do not expose port `5432` publicly unless deliberately secured.
- Keep MongoDB private on `app_network` with no host or public port binding.
- Keep MongoDB accessible internally through `mongodb:27017`, not through the VM public IP.
- Keep `realtime-server` private on `app_network`; do not add a public host mapping for port `3000` casually.
- Keep Centrifugo port `8000` private to Docker; publish it through Caddy at `realtime.chrbuilds.dev`.
- Keep GoTrue port `8081` private to Docker; publish it through Caddy at `auth.chrbuilds.dev`.
- Keep GoTrue's JWT secret, database password, and any admin credentials private and VM-local.
- `auth_db` is GoTrue's database. Do not mix application tables into the `auth` schema or let application migrations modify GoTrue-managed tables.
- The GoTrue auth database is not a public application database. Application backends should use GoTrue's API/JWTs and their own application database tables.
- Treat user UUIDs as the stable link between `auth.users` and application-owned tables; do not copy password hashes into application databases.
- The current GoTrue instance is shared by multiple products. Enforce product/tenant access in application membership tables and backend authorization; a shared `auth.users` table is not product isolation by itself.
- Treat the current `/admin` API as an operator-only surface. Never call it from an untrusted browser and never place admin credentials in frontend code.
- Do not rely on the current Noop mailer for production confirmation, recovery, or OTP delivery. Complete and secure the later n8n/email-provider workflow before enabling those user journeys.
- Keep Centrifugo's generated HMAC secret, admin password/secret, and HTTP API key private and VM-local.
- `CENTRIFUGO_JWT_SECRET` and `CENTRIFUGO_API_KEY` are different credentials with different purposes; do not swap them.
- The current `/token` implementation accepts a supplied `userId`, and the current `/publish` implementation has no app-auth middleware. Treat these endpoints as development/internal-only until app-to-server authentication and authorization are added.
- In production, an app backend—not an untrusted browser—must establish the authenticated user identity before requesting `/token`.
- In production, `/publish` must be restricted to trusted app backends and should validate application ownership of the requested channel.
- A channel prefix such as `app1:user:123` is an isolation convention, not authorization by itself.
- Use application-prefixed channel names and authorize each private channel according to the owning app, user, team, room, or membership rules.
- Use JWTs generated from the appropriate application identity for Centrifugo client authentication.
- Expose only the required public web ports: `80` and `443`.
- Use Docker service/container names for internal traffic: `postgres`, `mongodb`, `n8n`, `hello_api`, `centrifugo`, `realtime-server`, and `gotrue`.
- Ensure all required services join the external `app_network`.
- Restrict Azure firewall/security-group rules to required ports and trusted administrative access.
- Back up PostgreSQL and MongoDB data, including `mongodb_mongodb_data`, and protect n8n data/credentials.
- Treat `13.70.4.46` as current/example infrastructure data; verify it before DNS or firewall changes.

## Final infrastructure reference

~~~text
VM
├── infrastructure/caddy/
│   └── Caddyfile
├── auth/gotrue/
│   ├── .env                        # VM-local; contains secrets
│   └── docker-compose.yml
├── realtime/
│   ├── centrifugo/
│   │   ├── config.json             # VM-local; contains secrets
│   │   └── docker-compose.yml
│   └── server/
│       ├── .env                    # VM-local; contains secrets
│       ├── Dockerfile
│       ├── docker-compose.yml
│       ├── package.json
│       └── src/index.js
├── apps/hello_api/
├── n8n/
├── postgres/
└── mongodb/

Public clients
├── https://auth.chrbuilds.dev
│       │
│       ▼
│   Caddy → gotrue:8081 → PostgreSQL auth_db/auth schema
└── wss://realtime.chrbuilds.dev/connection/websocket
        │
        ▼
    Caddy → centrifugo:8000

App backends on app_network
├── http://realtime-server:3000
│       │
│       ▼
│   http://centrifugo:8000/api
└── http://gotrue:8081   # private service-to-service access only
~~~

