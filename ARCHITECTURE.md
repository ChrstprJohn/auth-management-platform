# Repository structure and architecture

This is the current pattern for the shared GoTrue dashboard. It describes what exists today and where new features should go.

## Folder structure

```text
SelfHostedAuthDashboard/
├── frontend/                         React + Vite dashboard UI
│   └── src/                          Pages, components, context, hooks, services, types
├── backend/                          Express + TypeScript API and deployment files
│   ├── src/
│   │   ├── app.ts                     Express setup, health routes, module mounting
│   │   ├── server.ts                  Listener and shutdown
│   │   ├── db/prisma.ts               Shared Prisma client
│   │   ├── middleware/                Shared HTTP error handling
│   │   ├── modules/
│   │   │   └── projects/              Project routes, controller, service, repository
│   │   └── generated/prisma/          Generated client; do not hand edit
│   ├── prisma/                        Schema and versioned SQL migrations
│   ├── tests/                         API integration tests
│   ├── compose.local.yml              Local PostgreSQL
│   ├── docker-compose.yml             VM API container and migration job
│   ├── Dockerfile                     Backend production image
│   └── DATABASE.md                    Database setup and migration steps
├── 0-Documentation/                  GoTrue endpoint reference and examples
└── 1-Virtual_Machine_Architecture/   Existing VM service/network notes
```

## System boundaries

```text
Browser dashboard (frontend)
        │ future authenticated requests
        ▼
Dashboard API (backend/Express)
        ├── Prisma ──► dashboard schema in PostgreSQL
        └── future server-side calls ──► GoTrue

GoTrue ──► authentication, users and tokens
Dashboard database ──► projects, project memberships and dashboard admins
```

The frontend currently uses mock data and a placeholder login; it does not call the backend. The backend currently offers project create, list and read routes plus health checks. Those project routes are **not authorized yet**, so the API should remain private until authentication and admin checks are added. GoTrue admin calls and membership/admin management are future work. The Prisma schema defines `Project`, `ProjectMembership` and `DashboardAdmin`; only the project routes are implemented.

Keep database credentials and any GoTrue admin credential in the backend environment. The browser should call the dashboard API for protected administration, never connect to PostgreSQL or hold an admin credential.

## Backend module pattern

Put each feature in `backend/src/modules/<feature>/`. Follow the existing `projects` module:

| File | Responsibility |
|---|---|
| `<feature>.routes.ts` | Declare paths and HTTP methods; connect middleware and controller handlers. |
| `<feature>.controller.ts` | Read HTTP inputs, call the service, and send HTTP responses. |
| `<feature>.service.ts` | Validate inputs and enforce feature rules. |
| `<feature>.repository.ts` | Read and write dashboard data through Prisma. |

The normal request path is **route → controller → service → repository → Prisma**. Keep Express request/response objects in routes and controllers. Services own the rules; repositories own queries. Shared database setup belongs in `src/db/`, and shared HTTP middleware belongs in `src/middleware/`. Mount new routes in `src/app.ts`. Add schema changes as Prisma migrations in `prisma/migrations/`; do not edit an already applied migration.

When a feature needs GoTrue, put its HTTP client behind a dedicated backend integration module, then call it from the feature service. Avoid scattering direct GoTrue requests across controllers. Authenticate and authorize a caller before exposing project or admin operations to the browser.

## Local and VM runtime

For local development, `backend/compose.local.yml` runs PostgreSQL on `127.0.0.1:5433`; the API can run locally with `pnpm dev` after applying migrations. On the VM, `backend/docker-compose.yml` builds the API container on the existing external `app_network`, with no published host port. Its one-off `migrate` service applies the same Prisma migrations to the separate dashboard database. The VM database has not been migrated from this repository yet. See [backend/DATABASE.md](backend/DATABASE.md) and [backend/README.md](backend/README.md) for commands.

For GoTrue endpoints, see [0-Documentation](0-Documentation/README.md). For existing VM network and services, see [VM infrastructure reference](1-Virtual_Machine_Architecture/vm-infrastructure-reference-updated.md).
