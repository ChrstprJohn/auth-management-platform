# GoTrue request examples

Base URL: `https://auth.chrbuilds.dev`. Examples use placeholder credentials only. Do not commit real passwords, access tokens, refresh tokens, admin JWTs, or the JWT signing secret. The public API paths have no `/auth/v1` prefix.

## Read-only checks

```bash
curl.exe -i https://auth.chrbuilds.dev/health
curl.exe -i https://auth.chrbuilds.dev/health
```

Both returned HTTP 200 on 2026-09-30. Health verifies the public route and service response; it does not prove database writes. Settings shows enabled providers and capabilities.

## Email/password account
`
```bash
curl -i -X POST https://auth.chrbuilds.dev/signup \
  -H 'Content-Type: application/json' \
  -d '{"email":"user@example.com","password":"<PASSWORD>"}'

curl -i -X POST 'https://auth.chrbuilds.dev/token?grant_type=password' \
  -H 'Content-Type: application/json' \
  -d '{"email":"user@example.com","password":"<PASSWORD>"}'
```

Signup is enabled, but email autoconfirm is disabled and the recorded mailer is Noop. A new account may therefore need a confirmation path that is not yet deliverable. These calls create state or require a real user and were not run during documentation.

## Session and account

```bash
curl -i https://auth.chrbuilds.dev/user \
  -H 'Authorization: Bearer <ACCESS_TOKEN>'

curl -i -X POST 'https://auth.chrbuilds.dev/token?grant_type=refresh_token' \
  -H 'Content-Type: application/json' \
  -d '{"refresh_token":"<REFRESH_TOKEN>"}'

curl -i -X PUT https://auth.chrbuilds.dev/user \
  -H 'Authorization: Bearer <ACCESS_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{"data":{"display_name":"Example User"}}'

curl -i -X POST https://auth.chrbuilds.dev/logout \
  -H 'Authorization: Bearer <ACCESS_TOKEN>'
```

Replace stored refresh tokens after a successful refresh if rotation is enabled. User metadata is user-controlled; do not use it to grant admin access.

## Admin user management

Run admin calls from a private backend with an admin-role JWT. The current dashboard frontend must not hold this JWT. See the [VM auth notes](../1-Virtual_Machine_Architecture/5-auth-server.md) for deployment details.

```bash
curl -i https://auth.chrbuilds.dev/admin/users \
  -H 'Authorization: Bearer <ADMIN_JWT>'

curl -i -X POST https://auth.chrbuilds.dev/admin/users \
  -H 'Authorization: Bearer <ADMIN_JWT>' \
  -H 'Content-Type: application/json' \
  -d '{"email":"user@example.com","password":"<PASSWORD>","email_confirm":true}'

curl -i https://auth.chrbuilds.dev/admin/users/<USER_UUID> \
  -H 'Authorization: Bearer <ADMIN_JWT>'
```

For other routes and method names, use the [route catalog](gotrue-routes.md) and the [versioned OpenAPI file](https://github.com/supabase/auth/blob/v2.196.0/openapi.yaml).
