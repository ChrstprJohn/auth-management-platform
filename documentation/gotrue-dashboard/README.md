# GoTrue Operator Dashboard Documentation

Design documentation only; implementation has not started.

| Document | Purpose |
|---|---|
| [Features](features.md) | V1 scope and completion criteria |
| [Technology stack](tech-stack.md) | Backend dependencies, tooling, and environment |
| [Backend architecture](backend-architecture.md) | Class-based layers, folder structure, flows, and conventions |
| [Delivery checklist](checklist.md) | Implementation and verification tracking |
| [Shared architecture](../architecture-and-deployment.md) | Repository, deployment, database ownership, and platform boundaries |

## Agreed approach

Express + strict TypeScript, Axios, feature modules, and classes with constructor injection. Pino/pino-http, Helmet, Zod, CORS, and request limits support the API. Use tsx watch in the foreground; nodemon is unnecessary. JWT verification with jose is deferred until session design requires it.

## Before implementation

Finalize operator sessions and persistence, durable audit storage and partial-failure handling, initial operator provisioning, and exact API/recovery contracts. Recommendations are explicitly marked in the architecture document. No database, application scaffolding, or packages were created during this documentation step.
