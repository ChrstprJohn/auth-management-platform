# Auth Management Platform

This repository contains the Auth Management Platform for the shared GoTrue service at `https://auth.chrbuilds.dev`: a global administration dashboard and a backend for protected administrative operations and reusable project membership APIs.

| Directory | Purpose | Current state |
|---|---|---|
| `frontend/` | React + Vite global administration dashboard | Real login, project/member/account/operator/audit services; no hardcoded sample data |
| `backend/` | Express API for projects, memberships, accounts, operators and audit | Protected routes with shared validation and GoTrue integration |
| `backend/prisma/` | Prisma schema and versioned dashboard database migration | Migration ready; not applied on VM |
| `backend/DATABASE.md` | Local PostgreSQL and VM database setup instructions | Local Compose added |
| `0-Documentation/` | GoTrue route catalog and request examples | Reference for v2.196.0 |
| `1-Virtual_Machine_Architecture/` | VM service and network notes | Deployment reference |

The backend is designed to run as a Docker container on the VM. Database and GoTrue admin credentials remain server-side. GoTrue admin operations require a privately configured `GOTRUE_ADMIN_TOKEN`; live VM deployment has not been performed. See [backend/README.md](backend/README.md) for local and Docker commands and [the API reference](0-Documentation/platform-api.md) for every endpoint.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the repository layout, system boundaries, and the pattern for new backend modules.

See the [main project plan](0-Documentation/PROJECT-PLAN.md) for the agreed product scope, frontend layout, membership/admin API separation, and implementation order.

## Frontend development

```bash
cd frontend
pnpm install
pnpm dev
```

Use `frontend/.env.example` for client configuration. Local Vite forwards `/api` to the backend on port 3000. The frontend uses GoTrue for normal login and the platform backend for administrative actions. Sessions stay in memory; reload requires signing in again. Never put privileged credentials in frontend environment variables.

Validation: backend `pnpm test` and `pnpm test:integration`; frontend `pnpm typecheck`, `pnpm lint`, and `pnpm build`; both packages `pnpm format:check`. Integration tests require local PostgreSQL and clean up temporary fixtures.
