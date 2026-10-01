# Repository and Deployment Layout

## Local repository

```text
apps/
  gotrue-admin-api/       # Express + TypeScript; operator management
  gotrue-admin-web/       # Operator frontend; Vercel
  platform-api/           # Express + TypeScript; developer/project auth
  platform-web/           # Developer frontend; Vercel
packages/
  gotrue-client/          # Shared server-only GoTrue API adapter
  contracts/              # Shared API types, separated by application
  database/               # Platform schema and migrations
infrastructure/
  local/                  # Local GoTrue, PostgreSQL, email capture
  vm/                     # Backend Docker/Compose deployment templates
documentation/
vm_infrastructure/        # Existing VM operational references
```

Both backends belong inside `apps/`, alongside the frontend apps. Create implementation folders when their phase starts. Each API has its own source, Dockerfile, runtime configuration, and deployable image. Shared packages are built into those images; the frontends never import server credentials or server-only GoTrue code.

## Target VM folders

```text
~/
  apps/
    gotrue-admin-api/
      docker-compose.yml
      .env
    platform-api/
      docker-compose.yml
      .env
  auth/gotrue/             # Existing shared auth service
  infrastructure/caddy/   # Existing public HTTPS routing
  postgres/
  mongodb/
  n8n/
  realtime/
```

Each API directory contains deployment configuration and, when building on the VM, its checkout/build context. The local repository and VM directories need not have identical layouts. Deploy frontend apps to Vercel, not to these VM folders.

The existing API deployment is documented as `~/apps/hello_api/`, container `hello_api:3000`, behind `api.chrbuilds.dev`. Reuse this pattern for `platform-api`; inspect consumers before replacing the old application and update Caddy/Compose together when renaming.

## Containers and traffic

```text
Vercel: gotrue-admin-web
        -> admin-api.chrbuilds.dev -> Caddy -> gotrue-admin-api:3000
                                                    -> gotrue:8081

Vercel: platform-web / customer applications
        -> api.chrbuilds.dev -> Caddy -> platform-api:3000
                                             -> gotrue:8081
                                             -> postgres:5432/platform_db

Shared GoTrue -> postgres:5432/auth_db
```

`admin-api.chrbuilds.dev` is a proposed hostname and needs DNS/Caddy configuration. Both API containers can listen on port `3000` because each has its own network namespace. Attach them to `app_network`; Caddy routes by container/service name. Do not publish their ports publicly. No API-to-API call is required for normal authentication: both use GoTrue directly.

Existing n8n, MongoDB, Centrifugo, and realtime-server remain separate services. Their presence does not make them dependencies of basic auth. The reference lists 1 GiB VM RAM; measure capacity before adding deployments. Frontend hosting stays on Vercel.

## Deployment sequence

1. Build/test `gotrue-admin-api` and `gotrue-admin-web` locally.
2. Deploy the admin API on the VM and configure its Caddy/DNS route.
3. Deploy its frontend to Vercel with the public admin API URL.
4. Build/test the platform API and frontend; deploy them independently.
5. Configure real email and gateway callbacks, then migrate existing direct GoTrue consumers.
6. Remove/replace `auth.chrbuilds.dev -> gotrue:8081` after those replacements work.

The operator dashboard alone does not replace existing signup, recovery, and verification integrations. GoTrue's container is already private at the port level, but the direct Caddy route exposes its API. In the target setup only the two APIs call GoTrue internally; public email/browser callbacks enter the platform API over HTTPS.

No production routes or services have been changed.

