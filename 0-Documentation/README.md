# Auth Management Platform documentation

This folder describes the self-hosted GoTrue service at **`https://auth.chrbuilds.dev`**. Its Caddy route forwards directly to GoTrue, so use paths such as `/signup`, **not** `/auth/v1/signup`.

- [Complete route catalog](gotrue-routes.md) — every route registered by the pinned GoTrue v2.196.0 router, grouped by feature and access level.
- [Main project plan](PROJECT-PLAN.md) — agreed architecture, frontend layout, application/admin API groups, feature scope, and implementation roadmap.
- [Platform endpoint reference](platform-api.md) — every implemented route, permissions, payloads, examples, error handling, and remaining deployment work.
- [Request examples](gotrue-examples.md) — starting points for the currently relevant email/password and admin flows.
- [Dashboard authentication and admin flow](dashboard-auth-flow.md) — current backend checks, local admin setup, protected GoTrue endpoints, and future VM/admin-token integration.
- [VM deployment notes](../1-Virtual_Machine_Architecture/5-auth-server.md) — infrastructure, configuration, and operations.

Checked against [GoTrue v2.196.0 router source](https://github.com/supabase/auth/blob/v2.196.0/internal/api/api.go) and its [versioned OpenAPI file](https://github.com/supabase/auth/blob/v2.196.0/openapi.yaml). The live `/health` and `/settings` endpoints returned HTTP 200 on 2026-09-30. The other routes are documented from source; they were not exercised against production.

The public settings reported email enabled, signup enabled, email autoconfirm disabled, phone disabled, all listed external providers disabled, and passkeys disabled. The VM notes record a Noop mailer, so email delivery flows need mail configuration before use. An endpoint being registered does not guarantee its feature is configured or its request will succeed.

GoTrue is the authentication API for this deployment. The dashboard backend now implements protected project create/list/read routes backed by its separate database. VM deployment, frontend integration, and backend GoTrue admin operations remain separate work; see the dashboard flow reference above.
