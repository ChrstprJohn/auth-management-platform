# Auth Management Platform architecture

This is the current pattern for the Auth Management Platform. It describes what exists today and where new features should go. The frontend provides administration screens; the backend serves protected admin operations and provides project membership APIs for other applications.

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
│   │   ├── models/                    Domain data types; no Express dependencies
│   │   ├── integrations/              Trusted GoTrue client, safe account projection
│   │   ├── lib/                       Shared input validation
│   │   ├── modules/
│   │   │   ├── projects/              Project CRUD
│   │   │   ├── memberships/           Enrollment/access and admin membership actions
│   │   │   ├── users/                 Server-side GoTrue account administration
│   │   │   ├── operators/             Dashboard admin management
│   │   │   ├── identity/              Own verified identity/admin status
│   │   │   └── audit/                 Audit event listing
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
        │ authenticated requests
        ▼
Dashboard API (backend/Express)
        ├── Prisma ──► dashboard schema in PostgreSQL
        └── token verification (/user) ──► GoTrue

GoTrue ──► authentication, users and tokens
Dashboard database ──► projects, project memberships and dashboard admins
```

The frontend uses real GoTrue login and typed API services. Administrative routes require a GoTrue-verified token and a dashboard admin row; enrollment and own-membership routes require a verified user and their applicable project policy. Health routes remain unauthenticated. The backend implements project/account/member/operator administration and audit listing. GoTrue administrative operations additionally require a server-held operator credential. See [the endpoint reference](0-Documentation/platform-api.md) for exact behavior. VM configuration and integration of these checks into external project backends remain deployment work.

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
