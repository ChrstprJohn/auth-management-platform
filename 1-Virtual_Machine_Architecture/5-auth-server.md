# GoTrue Auth Server Reference

> Current self-hosted deployment reference for the GoTrue service on the Azure VM. This document describes the verified layout around GoTrue v2.196.0. Passwords, JWT secrets, refresh tokens, API keys, and private connection strings are intentionally redacted.

## 1. What this server is

GoTrue is the authentication API used by the applications hosted on the VM. It is a standalone service based on GoTrue/Supabase Auth. It is responsible for:

- Creating user accounts.
- Hashing and checking passwords.
- Signing users in and issuing access and refresh tokens.
- Returning the current authenticated user.
- Handling sign-out and refresh-token revocation.
- Supporting email verification, password recovery, OTP/magic links, OAuth, MFA, passkeys, and operator APIs when those features are configured.

GoTrue is **not** an application database, an application API, or a web dashboard. It is the identity and token service.

There is no built-in admin dashboard in this deployment and no Supabase Studio installation. Use PostgreSQL tools or GoTrue's protected admin API to inspect and manage users. If a dashboard is added later, it should have its own authenticated backend; the browser must not connect directly to PostgreSQL.

## 2. Current deployment

| Item | Current value |
|---|---|
| Public auth URL | `https://auth.chrbuilds.dev` |
| Container | `gotrue` |
| Image | `supabase/gotrue:v2.196.0` |
| Internal listener | `gotrue:8081` |
| VM directory | `~/auth/gotrue` |
| Compose file | `~/auth/gotrue/docker-compose.yml` |
| Environment file | `~/auth/gotrue/.env` |
| Docker network | external `app_network` |
| PostgreSQL container | `postgres` |
| PostgreSQL database | `auth_db` |
| PostgreSQL role | `auth_user` |
| GoTrue schema | `auth` |
| JWT expiration configured | `3600` seconds |
| JWT audience configured | `authenticated` |
| Email delivery | Deferred; the latest startup logs showed the GoTrue Noop mail client |

The latest successful startup state included:

~~~text
Successfully applied 70 migrations.
GoTrue migrations applied successfully.
GoTrue API started on: :8081
version: v2.196.0
~~~

The public health check also returned HTTP 200 through Caddy.

## 3. Architecture and request flow

~~~text
Browser or application backend
        │ HTTPS
        ▼
https://auth.chrbuilds.dev
        │ DNS → Azure VM public IP
        ▼
Caddy :443
        │ reverse_proxy gotrue:8081
        ▼
GoTrue container
        │ private app_network
        ▼
PostgreSQL container postgres:5432
        │ database auth_db
        ▼
auth schema
        ├── auth.users
        ├── auth.identities
        ├── auth.sessions
        ├── auth.refresh_tokens
        └── other GoTrue-managed tables
~~~

The application does not need to know the password hash or query it to authenticate a user. The normal flow is:

~~~text
1. App sends email/password to GoTrue.
2. GoTrue validates the request and writes/reads auth_db.
3. GoTrue returns an access token and, when applicable, a refresh token.
4. App sends the access token to its own backend as:
       Authorization: Bearer <access-token>
5. The application backend verifies the JWT and uses the subject (user UUID)
   to authorize access to application-owned data.
~~~

The current Caddy route is a direct root-path route:

~~~caddy
auth.chrbuilds.dev {
    reverse_proxy gotrue:8081
}
~~~

Therefore the current public paths are `https://auth.chrbuilds.dev/signup`, `/token`, `/user`, and so on. This deployment does not currently require the Kong/Supabase gateway prefix `/auth/v1`.

## 4. Docker Compose and environment structure

The current Compose project is intentionally small and private to the shared Docker network:

~~~yaml
services:
  gotrue:
    image: supabase/gotrue:v2.196.0
    container_name: gotrue
    restart: unless-stopped
    env_file:
      - .env
    networks:
      - app_network

networks:
  app_network:
    external: true
~~~

The actual VM file may contain additional settings. Do not replace it with this abbreviated example without comparing the live file first.

The current environment structure is:

~~~env
# Public URLs
API_EXTERNAL_URL=https://auth.chrbuilds.dev
GOTRUE_SITE_URL=https://auth.chrbuilds.dev

# PostgreSQL
GOTRUE_DB_DRIVER=postgres
DATABASE_URL=postgres://auth_user:<REDACTED>@postgres:5432/auth_db?search_path=auth
GOTRUE_DB_MIGRATIONS_PATH=/usr/local/etc/auth/migrations

# JWT
GOTRUE_JWT_SECRET=<REDACTED>
GOTRUE_JWT_EXP=3600
GOTRUE_JWT_AUD=authenticated

# Current sign-up/provider settings
GOTRUE_EXTERNAL_EMAIL_ENABLED=true
GOTRUE_EXTERNAL_GOOGLE_ENABLED=false
~~~

Important details:

- The current deployment uses the variable name `DATABASE_URL` for the database connection. Some GoTrue examples use `GOTRUE_DB_DATABASE_URL`; do not rename the live variable casually.
- The database host is the Docker service/container name `postgres`, not `localhost` and not the public VM IP.
- The `search_path=auth` query parameter makes unqualified GoTrue table names resolve to the `auth` schema. This was required in the current setup because the tables are stored in `auth`.
- The real database password and `GOTRUE_JWT_SECRET` remain only in the VM-local environment.
- The current deployment has no direct host port mapping for GoTrue. Caddy reaches it across `app_network`.
- GoTrue environment variables take precedence over values supplied through a configuration file. Keep one clear source of truth for each setting.

### Email and n8n status

The current startup log reported:

~~~text
Noop mail client being used for https://auth.chrbuilds.dev
~~~

That means GoTrue is currently being used primarily for authentication and database-backed user management. Email delivery is planned for later through n8n and an email provider/workflow.

Until that work is complete:

- Do not assume that signup confirmation emails are delivered.
- Do not assume that password-recovery links are delivered.
- Do not assume that magic links or OTP emails are delivered.
- A successful HTTP response from `/recover` or `/otp` does not prove that a message reached the user.
- Keep confirmation/recovery testing separate from the basic signup, sign-in, JWT, and database tests.

## 5. Database ownership and access

### Auth database versus application databases

The PostgreSQL server can host several databases, but this GoTrue installation uses the dedicated database:

~~~text
PostgreSQL container: postgres
GoTrue database:     auth_db
GoTrue role:         auth_user
GoTrue schema:       auth
~~~

The application databases are separate from `auth_db`. An application should keep product-specific tables in its own application database or application-owned schema. It should store the GoTrue user UUID as a reference, for example:

~~~sql
CREATE TABLE app_profiles (
    id uuid PRIMARY KEY,
    auth_user_id uuid NOT NULL,
    display_name text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
~~~

The exact application schema is up to each product. The important boundary is:

~~~text
GoTrue-managed identity data → auth_db / auth schema
Product data               → application database or application schema
~~~

Do not copy password hashes into an application database. Do not let application ORM migrations alter the GoTrue-managed schema.

### GoTrue tables observed in the current database

The current database inspection showed 23 GoTrue tables:

~~~text
auth.audit_log_entries
auth.custom_oauth_providers
auth.flow_state
auth.identities
auth.instances
auth.mfa_amr_claims
auth.mfa_challenges
auth.mfa_factors
auth.oauth_authorizations
auth.oauth_client_states
auth.oauth_clients
auth.oauth_consents
auth.one_time_tokens
auth.refresh_tokens
auth.saml_providers
auth.saml_relay_states
auth.schema_migrations
auth.sessions
auth.sso_domains
auth.sso_providers
auth.users
auth.webauthn_challenges
auth.webauthn_credentials
~~~

This list can change when the GoTrue image is upgraded. The schema is service-managed, so use the current image and migration history as the authority.

The most important table for sign-up inspection is:

~~~text
auth.users
~~~

Useful non-secret fields commonly include:

~~~text
id
email
created_at
updated_at
email_confirmed_at
last_sign_in_at
phone
phone_confirmed_at
role
aud
app_metadata
user_metadata
~~~

Avoid selecting or displaying `encrypted_password`, token columns, refresh-token values, or other credential material.

### Inspect sign-ups with psql

Run these commands on the VM. They use the existing PostgreSQL container and role:

~~~bash
docker exec postgres psql -U auth_user -d auth_db -c "SELECT id, email, email_confirmed_at, created_at, last_sign_in_at FROM auth.users ORDER BY created_at DESC;"
~~~

Count users:

~~~bash
docker exec postgres psql -U auth_user -d auth_db -c "SELECT count(*) AS user_count FROM auth.users;"
~~~

Find one user by email:

~~~bash
docker exec postgres psql -U auth_user -d auth_db -c "SELECT id, email, created_at, email_confirmed_at, last_sign_in_at FROM auth.users WHERE lower(email) = lower('user@example.com');"
~~~

List the tables without reading their data:

~~~bash
docker exec postgres psql -U auth_user -d auth_db -c "\dt auth.*"
~~~

Inspect a table definition:

~~~bash
docker exec postgres psql -U auth_user -d auth_db -c "\d auth.users"
~~~

Inspect the database, schema, and search path without printing the password:

~~~bash
docker exec postgres psql -U auth_user -d auth_db -c "SELECT current_database(), current_user, current_schema(), current_setting('search_path');"
~~~

From another container on `app_network`, PostgreSQL is reached as:

~~~text
postgres:5432
~~~

From the VM itself, PostgreSQL is host-bound to `127.0.0.1:5432`. Keep it private and do not put a database password into shell history or documentation.

## 6. Migrations and schema_migrations

GoTrue owns the schema migrations in `auth.schema_migrations`. The current table was observed to contain only a `version` column, which is valid for this installation; it does not have a `dirty` column.

Check the migration table without changing it:

~~~bash
docker exec postgres psql -U auth_user -d auth_db -c "SELECT version FROM auth.schema_migrations ORDER BY version;"
~~~

Count the recorded migrations:

~~~bash
docker exec postgres psql -U auth_user -d auth_db -c "SELECT count(*) AS applied_migrations FROM auth.schema_migrations;"
~~~

The latest successful startup reported 70 migrations applied.

Migration rules:

- Start GoTrue with the intended image so it can run its own migrations.
- Back up `auth_db` before upgrading the image.
- Review the image version and release notes before an upgrade.
- Do not manually insert rows into `auth.schema_migrations` as a routine fix.
- Do not manually drop or recreate GoTrue tables to clear a startup error.
- Do not add guessed columns to resolve a migration mismatch.
- If a migration fails, stop the restart loop, preserve the database, inspect the exact image migration files, and restore/reconcile from a backup using a version-specific plan.
- Do not let Prisma, Sequelize, TypeORM, or another application ORM manage the `auth` schema.

The earlier setup encountered an OAuth migration mismatch where `auth.oauth_clients` already existed in a different shape from the migration history. That incident is why the database and migration state should be treated as a single GoTrue-managed unit.

## 7. API reference

All examples use this base URL:

~~~text
https://auth.chrbuilds.dev
~~~

Requests use JSON unless noted. The direct root paths below match the current Caddy route.

| Purpose | Method and path | Authentication |
|---|---|---|
| Health check | `GET /health` | None |
| Public settings | `GET /settings` | None |
| Sign up | `POST /signup` | None |
| Password sign-in | `POST /token?grant_type=password` | None |
| Refresh session | `POST /token?grant_type=refresh_token` | Refresh token in body |
| Get current user | `GET /user` | User access token |
| Update current user | `PUT /user` | User access token |
| Sign out | `POST /logout` | User access token |
| Send recovery email | `POST /recover` | None; email provider required |
| Verify a token/link | `GET /verify` or `POST /verify` | Token in query/body |
| Resend confirmation | `POST /resend` | Usually email/phone details |
| Passwordless OTP | `POST /otp` | Email/phone provider required |
| Magic link | `POST /magiclink` | Email provider required |
| External provider start | `GET /authorize` | Provider must be configured |
| Admin user list | `GET /admin/users` | Admin credentials |
| Admin create user | `POST /admin/users` | Admin credentials |
| Admin user operations | `GET/PUT/DELETE /admin/users/{user_id}` | Admin credentials |
| Admin action link | `POST /admin/generate_link` | Admin credentials |

The GoTrue v2.196.0 route map supports both GET and POST for `/verify`. Use GET when following an email link; use POST when submitting a verification/OTP token from an application.

### Health check

~~~bash
curl -i https://auth.chrbuilds.dev/health
~~~

Expected shape:

~~~json
{
  "version": "v2.196.0",
  "name": "GoTrue",
  "description": "GoTrue is a user registration and authentication API"
}
~~~

A 200 response verifies DNS, Caddy, the GoTrue container, and the public route. It does not by itself verify that signup can write to PostgreSQL.

### Public settings

~~~bash
curl -sS https://auth.chrbuilds.dev/settings
~~~

This exposes public capability/configuration information such as whether signup, email, phone, or external providers are enabled. It must not be treated as a secret configuration dump.

### Sign up with email and password

~~~bash
curl -i -X POST https://auth.chrbuilds.dev/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "<PASSWORD>"
  }'
~~~

A successful response returns a user and may return a session depending on email-confirmation/autoconfirm settings. Never reuse a real password in documentation or test commands.

Optional application metadata can be sent as user data:

~~~bash
curl -i -X POST https://auth.chrbuilds.dev/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "<PASSWORD>",
    "data": {
      "display_name": "Example User"
    }
  }'
~~~

Treat user metadata as user-controlled input. Do not use it as an authorization source.

### Sign in with a password

The password grant is the normal email/password login endpoint:

~~~bash
curl -i -X POST "https://auth.chrbuilds.dev/token?grant_type=password" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "<PASSWORD>"
  }'
~~~

The response normally contains:

~~~json
{
  "access_token": "<ACCESS_TOKEN>",
  "token_type": "bearer",
  "expires_in": 3600,
  "refresh_token": "<REFRESH_TOKEN>",
  "user": {
    "id": "<USER_UUID>",
    "email": "user@example.com"
  }
}
~~~

Access tokens and refresh tokens are credentials. Do not paste them into chat, source control, screenshots, issue trackers, or permanent logs.

### Get the current user

~~~bash
curl -i https://auth.chrbuilds.dev/user \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
~~~

The token must be a valid GoTrue access JWT. The response identifies the user associated with that token.

### Refresh a session

~~~bash
curl -i -X POST "https://auth.chrbuilds.dev/token?grant_type=refresh_token" \
  -H "Content-Type: application/json" \
  -d '{
    "refresh_token": "<REFRESH_TOKEN>"
  }'
~~~

Store the new refresh token returned by the server if refresh-token rotation is enabled. Do not keep using a stale refresh token after a successful rotation.

### Sign out

~~~bash
curl -i -X POST https://auth.chrbuilds.dev/logout \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
~~~

A successful response is normally HTTP 204. Sign-out revokes refresh tokens for the user. Already-issued access JWTs remain valid for stateless authentication until their expiration time, so keep the access-token lifetime short enough for the application’s risk profile.

### Start password recovery

~~~bash
curl -i -X POST https://auth.chrbuilds.dev/recover \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com"
  }'
~~~

The normal response is an empty success object. The request does not prove delivery. In the current deployment, email delivery remains deferred until the n8n/provider workflow is configured.

When a recovery link is available, it normally reaches the verification route with a recovery type and token. The browser/application should process the resulting session and let the user choose a new password.

### Verify an email link

The link sent by GoTrue is normally a GET request with query parameters. A safe shape for testing is:

~~~bash
curl -i -G https://auth.chrbuilds.dev/verify \
  --data-urlencode "type=signup" \
  --data-urlencode "token=<VERIFICATION_TOKEN>" \
  --data-urlencode "redirect_to=https://your-app.example/auth/callback"
~~~

Do not put the real token into a document or paste it into a public terminal transcript.

For an OTP/code-based verification, the v2.196.0 service also accepts POST:

~~~bash
curl -i -X POST https://auth.chrbuilds.dev/verify \
  -H "Content-Type: application/json" \
  -d '{
    "type": "signup",
    "token": "<OTP_OR_TOKEN>",
    "email": "user@example.com"
  }'
~~~

Use `type` values appropriate to the flow, such as `signup`, `recovery`, `magiclink`, or `invite`. The precise redirect behavior depends on the configured site URL and allow-list.

### Set a new password after recovery

After the recovery flow produces a valid authenticated session, update the user:

~~~bash
curl -i -X PUT https://auth.chrbuilds.dev/user \
  -H "Authorization: Bearer <RECOVERY_ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "password": "<NEW_PASSWORD>"
  }'
~~~

Do not log the recovery access token or new password.

### Resend confirmation

The v2.196.0 API exposes `POST /resend` for resending a confirmation or recovery-related message when the appropriate email provider is configured. Check the image/API reference for the exact flow fields before enabling it. The current Noop mailer means a successful request still does not prove delivery.

### OTP and magic links

Email OTP/magic-link requests use:

~~~bash
curl -i -X POST https://auth.chrbuilds.dev/otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "create_user": false
  }'
~~~

The older `/magiclink` endpoint is also available:

~~~bash
curl -i -X POST https://auth.chrbuilds.dev/magiclink \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com"
  }'
~~~

These require an operational email provider. Do not enable them as a production user journey until delivery, rate limiting, and redirect allow-lists are tested.

### Admin API

The admin API is protected by admin credentials and is not the same as a normal user access token. A protected operator backend may list users:

~~~bash
curl -i https://auth.chrbuilds.dev/admin/users \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
~~~

Admin endpoints can create, read, update, delete, invite, or generate action links depending on the enabled feature set. Keep the admin token on a private operator backend only. Never put it in a browser bundle, mobile app, public n8n workflow, or user-facing log.

## 8. JWT behavior and application backends

### Current JWT configuration

The current VM configuration includes:

~~~env
GOTRUE_JWT_SECRET=<REDACTED>
GOTRUE_JWT_EXP=3600
GOTRUE_JWT_AUD=authenticated
~~~

This means:

- GoTrue signs access tokens with the configured private secret.
- Access tokens are configured to expire after 3600 seconds.
- The expected audience is `authenticated`.
- The token subject `sub` is the GoTrue user UUID.
- Common claims include `sub`, `aud`, `role`, `exp`, `iat`, and issuer/user metadata claims depending on the version and configuration.
- Refresh tokens are separate credentials used to obtain new access sessions.
- A decoded JWT is not trusted until its signature and registered claims have been verified.

The JWT secret is not a frontend key. Do not expose it to a browser or put it in a public application environment variable.

### How an application backend should use the JWT

For every protected application request:

~~~text
1. Read the Authorization header.
2. Require the Bearer scheme.
3. Verify the JWT signature using the server-side GoTrue verification configuration.
4. Validate expiration and not-before timing when present.
5. Validate the expected audience: authenticated.
6. Read sub as the authenticated GoTrue user UUID.
7. Load the application's own membership/permissions for that UUID.
8. Authorize the requested resource.
~~~

Do not use a user-provided email, display name, metadata field, or URL parameter as the identity. Derive identity from the verified `sub` claim.

A backend using a JWT library should implement the equivalent of:

~~~text
verify_signature(access_token, GOTRUE_JWT_SECRET)
require_claim(access_token, "aud", "authenticated")
require_unexpired(access_token, "exp")
user_id = require_uuid_claim(access_token, "sub")
~~~

Use the official JWT library for the backend language. Do not write a custom JWT parser. Do not merely Base64-decode the middle segment.

The current configuration is secret-based and is commonly used for symmetric verification. GoTrue can evolve its token/signing configuration over time, so keep the verifier aligned with the deployed version and do not assume a signing algorithm permanently.

### Application roles and authorization

The GoTrue role is not a replacement for product authorization. For multiple products, use application-owned membership records such as:

~~~text
auth_user_id
application_key
tenant_id
role
status
~~~

Then the backend checks both:

~~~text
verified JWT identity
        +
application membership/permissions
~~~

Do not let a shared `role: authenticated` claim grant access to every product, tenant, admin function, or realtime channel.

## 9. Multi-project considerations

The current design uses one shared GoTrue service and one shared GoTrue database:

~~~text
auth.chrbuilds.dev
        │
        ▼
one GoTrue container
        │
        ▼
one auth_db
        │
        ▼
one shared auth.users identity pool
~~~

This is acceptable for the current stage, but it has important consequences:

- All products share the same `auth.users` table.
- Email uniqueness is global within this GoTrue instance.
- The same user UUID can be recognized by multiple products.
- A user who signs up for one product is still an identity in the shared auth pool; GoTrue does not automatically know product membership.
- Product separation must be enforced in application-owned data and backend authorization.
- A channel prefix, URL prefix, or frontend route is not security isolation by itself.
- Application tables should include a product/application key or tenant membership when the same identity pool serves more than one product.
- Do not filter or delete from `auth.users` as if it were a per-product user table.

A practical shared-server model is:

~~~text
auth.users
    │
    ├── dental_app_memberships
    ├── saas_app_memberships
    ├── portfolio_app_memberships
    └── other product tables
~~~

If a product later needs strict identity, billing, compliance, backup, or deletion boundaries, run a separate GoTrue instance/database for that product while still sharing the same VM and PostgreSQL server. That is a future architecture choice; it is not required for the current shared setup.

## 10. Health checks, logs, and restarts

### Check the container

~~~bash
cd ~/auth/gotrue
docker compose ps
docker inspect gotrue --format '{{.State.Status}}'
docker inspect gotrue --format '{{json .NetworkSettings.Networks}}'
~~~

The container should be running and attached to `app_network`.

### Check GoTrue internally

~~~bash
docker exec gotrue wget -qO- http://127.0.0.1:8081/health
~~~

Expected response:

~~~json
{"version":"v2.196.0","name":"GoTrue","description":"GoTrue is a user registration and authentication API"}
~~~

### Check through Caddy

~~~bash
curl -i https://auth.chrbuilds.dev/health
~~~

The successful path should show an HTTP 200 response and Caddy as the reverse proxy.

### Read logs safely

~~~bash
docker logs --tail 100 gotrue
~~~

Logs can contain request paths, error IDs, email addresses, forwarded hosts, and database error details. Do not publish full logs without reviewing and redacting them.

### Restart after a safe configuration change

~~~bash
cd ~/auth/gotrue
docker compose up -d --force-recreate gotrue
docker compose ps
docker logs --tail 100 gotrue
curl -i https://auth.chrbuilds.dev/health
~~~

Use `docker compose down` only when intentionally taking the service down. It does not replace a database backup and should not be used as a first response to a migration error.

### Caddy and network checks

~~~bash
docker exec caddy caddy validate --config /etc/caddy/Caddyfile
docker network inspect app_network
docker logs --tail 100 caddy
~~~

If the route is changed, reload Caddy using the VM's normal Caddy procedure and then test `/health`.

## 11. Common troubleshooting

### Root URL returns 404

`GET /` is not the health endpoint. Use:

~~~text
GET /health
~~~

A 404 for `/`, `/favicon.ico`, `/.env`, `/.git/config`, or random scanner paths is not evidence that GoTrue is down.

### Public endpoint returns 502

A 502 normally means Caddy cannot reach the GoTrue upstream. Check:

~~~bash
docker ps --filter name=gotrue
docker inspect gotrue --format '{{json .NetworkSettings.Networks}}'
docker network inspect app_network
docker logs --tail 100 gotrue
docker logs --tail 100 caddy
~~~

Confirm that:

~~~text
Caddy and gotrue share app_network
Caddy upstream is gotrue:8081
GoTrue is listening on :8081
~~~

### Signup returns 500 with a database error

Check the GoTrue logs immediately after one test request:

~~~bash
docker logs --tail 100 gotrue
~~~

If the log says a relation such as `identities` does not exist while `auth.identities` exists, check the database URL/search path:

~~~bash
docker exec gotrue env | grep -E '^(DATABASE_URL|GOTRUE_DB_DRIVER|GOTRUE_DB_MIGRATIONS_PATH)='
~~~

Do not print the complete output if the database URL contains a password. The current deployment needs the `auth` schema available through the database connection search path.

### GoTrue enters a restart loop during migration

Stop the restart loop without deleting the database:

~~~bash
cd ~/auth/gotrue
docker compose stop gotrue
docker logs --tail 200 gotrue
~~~

Then inspect:

~~~bash
docker exec postgres psql -U auth_user -d auth_db -c "SELECT version FROM auth.schema_migrations ORDER BY version DESC;"
docker exec postgres psql -U auth_user -d auth_db -c "\dt auth.*"
~~~

Do not drop `auth.oauth_clients`, `auth.users`, or other referenced tables just to make the container start. Resolve the exact schema/image mismatch from a backup and the v2.196.0 migration files.

### Signup succeeds but no confirmation email arrives

The current service has a Noop mail client and email delivery is deferred. Confirm the account directly:

~~~bash
docker exec postgres psql -U auth_user -d auth_db -c "SELECT id, email, email_confirmed_at, confirmation_sent_at, created_at FROM auth.users ORDER BY created_at DESC;"
~~~

Do not treat an unconfirmed account as a database failure. Finish the n8n/email-provider workflow before depending on confirmation or recovery messages.

### Sign-in is rejected after signup

Check whether email confirmation is required:

~~~bash
curl -sS https://auth.chrbuilds.dev/settings
~~~

Review the configured mailer/autoconfirm behavior and the user row's confirmation fields. If confirmation is required but email delivery is not configured, sign-in may be blocked until the account is confirmed through an appropriate controlled setup.

### DNS or TLS issue

Verify the domain resolves to the current VM public IP and confirm Caddy is valid:

~~~bash
getent hosts auth.chrbuilds.dev
docker exec caddy caddy validate --config /etc/caddy/Caddyfile
curl -i https://auth.chrbuilds.dev/health
~~~

The IP recorded in the VM reference is example/current infrastructure data and must be verified before DNS changes.

### Browser calls fail while curl works

Check:

- The browser is calling the direct root paths, not assuming `/auth/v1`.
- CORS and allowed origins are configured for the actual application origin.
- `Authorization` and `Content-Type` headers are allowed.
- Redirect targets are included in the GoTrue URI allow-list.
- The application is not exposing an admin token or database credential.
- Preflight requests are reaching the expected GoTrue route.

## 12. Security notes

- Keep the VM-local `.env` file out of GitHub and backups that are not protected.
- Never expose `GOTRUE_JWT_SECRET`, the database password, admin credentials, access tokens, or refresh tokens.
- Keep PostgreSQL on `127.0.0.1:5432` and GoTrue on the private Docker network; expose only HTTPS through Caddy.
- Always run the public auth API behind TLS. The current public entry point is Caddy on ports 80/443.
- Use strong, unique passwords for the database and operator credentials.
- Rotate secrets deliberately, with a plan for existing sessions and all token verifiers.
- Treat access tokens as short-lived credentials and refresh tokens as high-value credentials.
- Validate JWT signatures and registered claims on every protected backend request.
- Never authorize a product, tenant, admin operation, or realtime channel from an unverified claim or user-supplied value.
- Do not let application ORMs modify the `auth` schema.
- Do not query password hashes, refresh-token values, or one-time-token material into application logs.
- Rate-limit signup, token, recovery, OTP, and resend flows at the proxy/application boundary as appropriate.
- Restrict admin API access to a private operator backend or controlled administrative network.
- Do not call `/admin` from frontend code.
- Keep redirect allow-lists narrow; do not allow arbitrary `redirect_to` destinations.
- Review Caddy and GoTrue logs for scanner traffic without treating ordinary 404 scans as a service failure.
- Back up `auth_db` and test restoring it before making a production migration or image upgrade.
- Email delivery through n8n must use protected credentials, verified webhook/authentication, retry controls, and anti-abuse limits before production use.
- The current shared server is not a product-isolation boundary; enforce product and tenant authorization in each application backend.

## 13. Operational quick reference

~~~text
Public:
  https://auth.chrbuilds.dev/health
  https://auth.chrbuilds.dev/signup
  https://auth.chrbuilds.dev/token?grant_type=password
  https://auth.chrbuilds.dev/user
  https://auth.chrbuilds.dev/logout
  https://auth.chrbuilds.dev/recover
  https://auth.chrbuilds.dev/verify

Private Docker:
  gotrue:8081
  postgres:5432

VM files:
  ~/auth/gotrue/docker-compose.yml
  ~/auth/gotrue/.env
  ~/infrastructure/caddy/Caddyfile

Database:
  database: auth_db
  role: auth_user
  schema: auth
  main signup table: auth.users

Current scope:
  GoTrue = authentication and JWTs
  PostgreSQL auth_db = GoTrue-managed auth data
  n8n = later email/workflow delivery
  application databases = product-owned data
~~~

## 14. Official references

- [Supabase self-hosted Auth API reference](https://supabase.com/docs/reference/self-hosting-auth)
- [Supabase self-hosted Auth configuration](https://supabase.com/docs/guides/self-hosting/auth/config)
- [GoTrue v2.196.0 source tree](https://github.com/supabase/auth/tree/v2.196.0)
- [GoTrue v2.196.0 API route definitions](https://github.com/supabase/auth/blob/v2.196.0/internal/api/api.go)
- [Supabase Auth guide](https://supabase.com/docs/guides/auth)

The official GoTrue service and its migrations are the authority for version-specific behavior. This document is an operational reference for the current VM layout; re-check the image, environment, routes, migrations, and email configuration after any deployment change.

