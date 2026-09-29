# Self-hosted auth dashboard

This repository contains the dashboard for the shared GoTrue service at `https://auth.chrbuilds.dev`.

| Directory | Purpose | Current state |
|---|---|---|
| `frontend/` | React + Vite dashboard | UI prototype with mock data |
| `backend/` | Express API for projects and protected GoTrue admin operations | Scaffold with `GET /health` only |
| `backend/prisma/` | Prisma schema and versioned dashboard database migration | Migration ready; not applied on VM |
| `backend/DATABASE.md` | Local PostgreSQL and VM database setup instructions | Local Compose added |
| `0-Documentation/` | GoTrue route catalog and request examples | Reference for v2.196.0 |
| `1-Virtual_Machine_Architecture/` | VM service and network notes | Deployment reference |

The backend is designed to run as a Docker container on the VM. Its future database and GoTrue admin credentials must remain server-side. See [backend/README.md](backend/README.md) for local and Docker commands.

## Frontend development

```bash
cd frontend
pnpm install
pnpm dev
```

The existing frontend environment file was moved to `frontend/.env` if one existed. It is ignored by Git. The frontend does not yet call the new backend.
