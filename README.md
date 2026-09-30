# Auth Management Platform

This repository contains the Auth Management Platform for the shared GoTrue service at `https://auth.chrbuilds.dev`: an administration dashboard and a backend for protected admin operations and planned project membership APIs reusable by other applications.

| Directory | Purpose | Current state |
|---|---|---|
| `frontend/` | React + Vite dashboard | UI prototype with mock data |
| `backend/` | Express API for projects, planned membership APIs, and future GoTrue admin operations | Project create/list/read protected by GoTrue identity and dashboard admin checks |
| `backend/prisma/` | Prisma schema and versioned dashboard database migration | Migration ready; not applied on VM |
| `backend/DATABASE.md` | Local PostgreSQL and VM database setup instructions | Local Compose added |
| `0-Documentation/` | GoTrue route catalog and request examples | Reference for v2.196.0 |
| `1-Virtual_Machine_Architecture/` | VM service and network notes | Deployment reference |

The backend is designed to run as a Docker container on the VM. Its future database and GoTrue admin credentials must remain server-side. See [backend/README.md](backend/README.md) for local and Docker commands.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the repository layout, system boundaries, and the pattern for new backend modules.

See the [main project plan](0-Documentation/PROJECT-PLAN.md) for the agreed product scope, frontend layout, membership/admin API separation, and implementation order.

## Frontend development

```bash
cd frontend
pnpm install
pnpm dev
```

The existing frontend environment file was moved to `frontend/.env` if one existed. It is ignored by Git. The frontend does not yet call the new backend.
