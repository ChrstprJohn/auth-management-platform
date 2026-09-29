# GoTrue API reference

This folder describes the self-hosted GoTrue service at **`https://auth.chrbuilds.dev`**. Its Caddy route forwards directly to GoTrue, so use paths such as `/signup`, **not** `/auth/v1/signup`.

- [Complete route catalog](gotrue-routes.md) — every route registered by the pinned GoTrue v2.196.0 router, grouped by feature and access level.
- [Request examples](gotrue-examples.md) — starting points for the currently relevant email/password and admin flows.
- [VM deployment notes](../VM/5-auth-server.md) — infrastructure, configuration, and operations.

Checked against [GoTrue v2.196.0 router source](https://github.com/supabase/auth/blob/v2.196.0/internal/api/api.go) and its [versioned OpenAPI file](https://github.com/supabase/auth/blob/v2.196.0/openapi.yaml). The live `/health` and `/settings` endpoints returned HTTP 200 on 2026-09-30. The other routes are documented from source; they were not exercised against production.

The public settings reported email enabled, signup enabled, email autoconfirm disabled, phone disabled, all listed external providers disabled, and passkeys disabled. The VM notes record a Noop mailer, so email delivery flows need mail configuration before use. An endpoint being registered does not guarantee its feature is configured or its request will succeed.

GoTrue is the authentication API for this deployment. The current VM notes do not document a public project-management API; the dashboard's project records will need their own backend or storage.
