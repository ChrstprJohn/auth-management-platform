# Local GoTrue and SMTP

GoTrue `supabase/gotrue:v2.196.0` runs at `http://localhost:8081` on the existing `local-database-server_default` network, using PostgreSQL 17 and `auth_local_db` / `auth_local` / `auth`. Compose defines no PostgreSQL server. The user owns database preparation and every infrastructure restart: GoTrue startup can run its own migrations.

The example prepares hosted Resend through GoTrue SMTP. No Resend instance, SDK, proxy mail API or extra token flow is deployed. Current ignored `.env` values are preserved until final setup; templates do not activate a provider. Historical Mailpit evidence and current live gaps belong in [GoTrue status](../../documentation/gotrue-dashboard/status.md).

## SMTP configuration and pinned TLS evidence

Resend requires a verified domain and API key. Its [SMTP settings](https://resend.com/docs/send-with-smtp) use `smtp.resend.com`, username `resend`, and the API key as the SMTP password. Port **465** is selected for implicit TLS. SMTP activity appears in Resend's email table; provider limits still apply.

Pinned GoTrue [mailmeclient](https://github.com/supabase/auth/blob/v2.196.0/internal/mailer/mailmeclient/mailmeclient.go) passes host/port/user/password into `gomail.NewDialer`. Its [go.mod](https://github.com/supabase/auth/blob/v2.196.0/go.mod) pins gomail commit `81ebce5c23df`; that [dialer](https://github.com/go-gomail/gomail/blob/81ebce5c23df/smtp.go) enables implicit TLS specifically on port 465 and validates hostname/certificates. Other ports attempt STARTTLS if advertised. Port 2465 does not automatically enable implicit TLS in this version. This is source/configuration verification, not an SMTP connection or inbox test.

| Ignored `infrastructure/local/.env` variable | Final value |
| --- | --- |
| `GOTRUE_SMTP_HOST` | `smtp.resend.com` |
| `GOTRUE_SMTP_PORT` | `465` |
| `GOTRUE_SMTP_USER` | `resend` |
| `GOTRUE_SMTP_PASS` | User-entered Resend sending key, only on the server |
| `GOTRUE_SMTP_ADMIN_EMAIL` | `auth@mail.chrbuilds.dev` (proposed sender; confirm before activation) |
| `GOTRUE_SMTP_SENDER_NAME` | Chosen sender display name |

Keep `GOTRUE_MAILER_AUTOCONFIRM=false` and all `GOTRUE_MAILER_URLPATHS_*=/verify`. Signup confirmation and recovery use this SMTP path. Admin creation from Users sends **no invitation or confirmation email under either policy**, including after Resend activation. An unconfirmed admin-created account still needs a supported verification flow before normal verified login. No invitation/resend controls are introduced.

## Final setup checklist (user-operated, after independent checks)

1. The user selected `mail.chrbuilds.dev` and reported adding it to Resend on 2026-10-02. Confirm its dashboard status is **verified**; adding the domain alone does not establish DNS verification. Publish the exact SPF and DKIM records Resend supplies and configure DMARC according to your domain policy. See [domain setup](https://resend.com/docs/dashboard/domains/introduction). Keep click/open tracking disabled for recovery links.
2. Create a dedicated key with **sending access**, restricted to `mail.chrbuilds.dev`. See [key permissions](https://resend.com/docs/api-reference/api-keys/create-api-key) and [domain restrictions](https://resend.com/docs/dashboard/api-keys/introduction). Enter the key only in the ignored `.env`, never in `.env.example`, chat, frontend configuration or Git. `auth@mail.chrbuilds.dev` is the selected local sender; display name `Auth` is the example.
3. Edit the existing ignored **`C:\Users\picar\Desktop\auth-management-platform\infrastructure\local\.env`** using the six SMTP variables above. Do not overwrite existing database/JWT credentials with the full example. No browser mail-mode setting is needed; recovery UI gives provider-neutral same-browser instructions.
4. Preserve local `API_EXTERNAL_URL=http://localhost:8081`, `GOTRUE_SITE_URL=http://localhost:5173` and existing `GOTRUE_URI_ALLOW_LIST` entries, including `http://localhost:3100/v1/operator/auth/recovery/callback`. Keep hostnames consistent. The API's ignored `apps/gotrue-admin-api/.env` retains matching `FRONTEND_ORIGINS`, `RECOVERY_CALLBACK_URL` and `RECOVERY_RESET_URL=http://localhost:5173/reset-password`; follow [API recovery setup](../../apps/gotrue-admin-api/README.md#password-recovery-setup). Production same-site HTTPS origins/callbacks remain a separate deployment task.
5. Confirm the existing database is ready, then run the following from `infrastructure/local/` yourself. Recreate, rather than plain restart, loads changed environment values. Use the base file alone to leave capture mode; there is no fallback when Resend fails.

```powershell
docker compose -f compose.yaml up -d --no-deps --force-recreate gotrue
docker compose -f compose.yaml ps
Invoke-RestMethod http://localhost:8081/health
# Optional: stop the old capture container when no longer needed.
docker compose -f compose.yaml --profile mailpit stop mailpit
```

These commands are prepared, not run by the agent. Health establishes reachability only. Do not print resolved Compose configuration, container environment, raw mail errors or token-bearing links into support reports.

## Controlled Resend delivery and recovery walkthrough (pending)

Before external email, explicitly authorize the controlled recipients and test scope. Use an existing controlled eligible operator mailbox for recovery, never a production user. Keep passwords, cookies, keys, links and codes local. Mailpit scripts below are not Resend live probes.

After authorization and user-operated restart:

1. With foreground API/Vite running, sign in normally and request recovery from `/forgot-password` in the same browser/profile. The generic 202 acknowledgement proves neither email delivery nor account eligibility.
2. Check Resend activity and recipient inbox/spam. Record provider acceptance separately from inbox arrival. Open only the newest `/verify` recovery link in that browser; preserve cookies through GoTrue, the PKCE gateway callback and `/reset-password`. Never paste the link into chat or capture it in logs/screenshots.
3. Submit a new password once. Confirmed 204 clears dashboard sessions. Verify normal new-password login and rejection of the old password/session, then logout. Record safe evidence/date. Timeout or `PASSWORD_RESET_OUTCOME_UNKNOWN` may mean the password changed; try normal sign-in or trusted assistance instead of repeating reset. `PASSWORD_RESET_COMPLETION_FAILED` means password update succeeded but cleanup was not confirmed.
4. Review provider rejection/rate-limit handling with controlled fixtures first. For an observed real rejection, preserve the generic acknowledgement and inspect safe provider activity; fix sender/key/domain locally. For a visible 429, wait before an intentional fresh request; never loop/retry automatically or invent a countdown. Never fall back to Mailpit or claim acknowledgement guarantees delivery. Do not send to unauthorized recipients to provoke failures.

If signup confirmation is authorized, use a disposable recipient the user controls and verify inbox arrival and `/verify` separately. `pnpm operator:setup` submits signup and changes the allowlist, so is excluded without separate authorization. Preserve operator eligibility, PKCE, callback allowlists and generic acknowledgements.

Status remains **implementation ready; setup/live delivery pending** until domain/key/sender setup, effective SMTP activation, inbox arrival and the complete recovery/new-password-login walkthrough have evidence.

## Explicit Mailpit capture option

For email regressions without provider credentials, the user selects `compose.mailpit.yaml` explicitly. It overrides only six SMTP values and starts Mailpit `axllent/mailpit:v1.27.0` with GoTrue. It does not deliver externally. Inbox is loopback `http://localhost:8025`; SMTP is internal `mailpit:1025` without authentication. Existing database/JWT secrets are still required. Mailpit data is disposable with no mailbox volume.

```powershell
# User-operated; GoTrue can run migrations during recreation.
docker compose -f compose.yaml -f compose.mailpit.yaml --profile mailpit up -d
docker compose -f compose.yaml -f compose.mailpit.yaml --profile mailpit ps
# Stops this stack without removing existing PostgreSQL databases.
docker compose -f compose.yaml -f compose.mailpit.yaml --profile mailpit down
```

Upstream/gateway recovery probes and `verify-local-web.ts --live` check the running container's effective capture SMTP settings with a silent read-only `docker compose exec` test. They stop before account/email mutations if capture mode cannot be confirmed, including unavailable Docker. This handles `.env`/Compose overrides disagreeing and prevents accidental Resend sends to `example.test` fixtures. Fixture-only web review uses no infrastructure or email.

For fresh installation only, copy `.env.example` and let the user supply the dedicated database connection and random JWT secret. Preserve existing `.env`. The user prepares database/role; GoTrue owns schema/migrations. Do not run this local stack on the VM; VM changes require separate authorization. Reference: [pinned upstream example](https://github.com/supabase/auth/blob/v2.196.0/example.env).
