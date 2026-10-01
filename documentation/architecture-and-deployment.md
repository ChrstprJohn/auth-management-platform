# Shared Architecture and Deployment

Agreed design; no application deployment or VM route change has been performed.

## Repository

```text
apps/
  gotrue-admin-api/       # Operator Express/TypeScript backend
  gotrue-admin-web/       # Operator frontend: Vercel
  platform-api/           # Developer/project Express/TypeScript backend
  platform-web/           # Developer frontend: Vercel
packages/
  gotrue-client/          # Shared server-only upstream adapter
  contracts/              # API types, separated by application
  database/               # Platform schema/migrations
infrastructure/
  local/                  # Local GoTrue setup using existing PostgreSQL
  vm/                     # API Docker/Compose templates
documentation/
vm_infrastructure/        # Existing VM references
```

Create application folders when implementation starts. Both APIs belong in `apps/` and build/deploy independently. Shared code is included in their images; server credentials never enter frontend packages.

## VM and routing

```text
Vercel admin UI -> admin-api.chrbuilds.dev -> Caddy -> gotrue-admin-api:3000
                                                          -> gotrue:8081
Vercel platform UI / customer apps -> api.chrbuilds.dev -> platform-api:3000
                                                          -> gotrue:8081
                                                          -> postgres/platform_db
Shared GoTrue -> postgres/auth_db
```

The platform route also enters through Caddy. `admin-api.chrbuilds.dev` is proposed and needs DNS. Both containers can use internal port 3000 on `app_network`; Caddy selects by service name. No public backend port mappings or normal API-to-API calls are needed.

One repository checkout on the VM:

```text
~/apps/auth-management-platform/
  apps/                   # Both API and frontend source folders
  packages/               # Shared source used when building apps
  infrastructure/         # Local setup and VM API deployment templates
  documentation/
~/auth/gotrue/             # Existing auth service
~/infrastructure/caddy/
~/postgres/
```

Existing MongoDB, n8n, and realtime folders/services remain separate. The prepared deployment is documented as `~/apps/hello_api/`, `hello_api:3000`, behind `api.chrbuilds.dev`; inspect consumers before replacing it with `platform-api`. The documented VM has 1 GiB RAM: measure resource capacity before adding services. Frontend hosting/builds stay on Vercel.

Clone the complete repository into `~/apps/auth-management-platform/` once; later run `git pull` there. Pulling downloads source only, not running services. Build each API image with the repository root as its build context so it can include the shared packages. Only the resulting two API containers run on the VM. Separate copies of the APIs under `~/apps/` are unnecessary.

Frontend source will also be present in the checkout, but Vercel builds/deploys it. `packages/` contains shared code included in application builds; it is not another deployed service.

## One identity pool, distinct permissions

Both APIs use the existing single GoTrue. One email/password identity can be an operator, developer, and member of multiple projects. Verification, recovery, and provider configuration are global; project access is local membership data. No per-project GoTrue containers/databases.

| Store | Ownership |
|---|---|
| `auth_db` | GoTrue identities, password hashes, verification, upstream sessions; GoTrue-managed migrations |
| `platform_db` | Platform profiles/workspaces/projects/memberships/keys/scoped sessions; platform-managed migrations |
| Admin configuration and durable audit sink | Explicit operator eligibility and global management action history; no duplicate password store |

Both databases can use one PostgreSQL server. Reference GoTrue UUIDs without copying hashes or assuming cross-database foreign keys. APIs use separate runtime credentials. Do not give the admin API unrestricted access to platform tables.

GoTrue proves identity; backend records supply authority. Operator eligibility is server-controlled. Developers manage workspace projects, never global identities. Project sessions/keys cannot authorize console/operator actions. Global bans/deletion can affect all products and need explicit impact handling.

## Local development and browser connections

Use the existing local PostgreSQL 17 container, `local-database-server-postgres-1`, on `local-database-server_default`. The [local Compose setup](../infrastructure/local/README.md) runs one development GoTrue container on that network; it does not create another PostgreSQL server. The dedicated `auth_local_db` and `auth_local` role are prepared. Local GoTrue and Mailpit are running; signup requires email verification and messages appear at `http://localhost:8025`. Automatic confirmation is disabled. Use a real provider on the VM later; create platform data/credentials when the platform phase begins.

Use separate host ports for the APIs, e.g. admin 3100 and platform 3200. Containers resolve service names; host processes use local ports. Local data/secrets do not synchronize automatically to production.

Each API configures its private/local GoTrue URL; the platform additionally configures its restricted database connection and session encryption key. Admin credentials and operator eligibility remain server-side. Follow the supplied foreground Node and orphan-worker cleanup rules.

Vercel frontends call public HTTPS API URLs. Configure exact trusted origins, cookie credentials, HttpOnly/Secure settings, and CSRF protection. `vercel.app` and the API domain are cross-site: test browser cookie behavior. Prefer production frontend custom domains under `chrbuilds.dev`; do not give arbitrary preview origins production operator access.

## Local versus VM: what runs

| Component | Local development | VM / production |
|---|---|---|
| GoTrue | Development container from `infrastructure/local/` | Reuse existing `~/auth/gotrue/`; do not start local Compose |
| PostgreSQL | Reuse existing local container with dedicated development databases | Reuse existing private PostgreSQL; create `platform_db` and restricted role if absent |
| API backends | Run locally against local services | Build/recreate two API containers with VM configuration |
| Frontends | Local frontend dev processes | Deploy on Vercel |
| Shared packages | Imported by applications | Included in builds; no separate running service |
| Caddy | Not required for normal local development | Reuse existing Caddy and add/update API hostname routes |
| Data and secrets | Development-only | Separate production data and protected credentials |

The goal is the same code with environment-specific configuration: locally test without calling the VM; later deploy backends that call private VM GoTrue/PostgreSQL. `infrastructure/local/` may exist in the VM checkout but is never started there. `infrastructure/vm/` is reserved for backend deployment configuration, not replacement GoTrue/PostgreSQL services.

Deployment means pull code, build/recreate the relevant API, apply platform migrations when needed, and verify health/auth flows. Pull alone does not deploy, migrate, or transfer local users.

## Deployment order and GoTrue privacy

1. Build/test and deploy operator API/UI first.
2. Build/test and deploy developer platform API/UI independently.
3. Configure delivered email and public gateway callback flows.
4. Migrate existing direct GoTrue integrations.
5. Remove/replace the current `auth.chrbuilds.dev -> gotrue:8081` proxy route.

GoTrue's private container port does not make its current Caddy route private. The dashboard alone does not replace public signup/recovery integrations. After migration, supported auth/admin traffic enters one of the two APIs; email/browser callbacks remain public gateway URLs while GoTrue's upstream URL is internal.

References: [existing VM](../vm_infrastructure/vm-infrastructure-reference-updated.md), [existing GoTrue](../vm_infrastructure/5-auth-server.md). Those documents describe deployed infrastructure, not the proposed product contract.
