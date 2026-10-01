# GoTrue Admin API: Technology Stack

| Component | Choice | Purpose |
|---|---|---|
| Runtime | Node.js supported LTS | Run compiled JavaScript in production; pin exact version during scaffolding |
| Language | TypeScript, strict mode | Explicit contracts and compile-time checks |
| HTTP framework | Express | Routes, controllers, and middleware |
| Upstream HTTP | Axios | Configured GoTrue client with timeouts and safe error mapping |
| Validation | Zod | Validate environment, parameters, queries, and request bodies |
| Application/request logging | Pino + pino-http | Structured logs, request correlation, configured secret redaction |
| Security headers | Helmet | API-appropriate HTTP security headers |
| Browser origins | cors | Exact trusted frontend origins with explicit credentials policy |
| Request limits | express-rate-limit | Separate login/recovery and general API limits |
| Development | tsx watch | Run/restart TypeScript in the foreground; nodemon is unnecessary |
| Build | TypeScript compiler | Type-check and emit production JavaScript |
| Tests | Vitest + Supertest | Meaningful service and HTTP integration tests |
| Formatting/checks | ESLint + Prettier | Consistent code and static checks |
| Package/workspace management | pnpm workspaces | Independent apps and shared packages in one repository |
| JWT verification | Deferred: jose if needed | Add only if the session design uses local JWT verification |
| Persistence | Decision pending | Durable audit sink and session persistence must be selected before their modules are implemented |

Pin compatible dependency versions when scaffolding. No Redis, queue, ORM, or additional service is assumed for V1. Cookie parsing and CSRF implementation depend on the chosen session design; document their concrete dependencies before implementation.

Pino redaction must explicitly cover sensitive fields. Prefer logging an allowlist of safe metadata; omit bodies, cookies, authorization headers, token-bearing query strings, and raw Axios request/error objects. Operational logs do not replace durable audit history.


## Status and environment

Documented backend choices only; dependencies have not been installed. Local development uses existing GoTrue/Mailpit and PostgreSQL. The host-run admin API is planned on port 3100, calling GoTrue on localhost:8081. Production reuses VM services behind Caddy; frontend hosting stays on Vercel. Frontend technology is not selected here. See [backend architecture](backend-architecture.md) and [shared deployment architecture](../architecture-and-deployment.md).

