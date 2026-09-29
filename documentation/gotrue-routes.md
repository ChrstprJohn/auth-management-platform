# GoTrue v2.196.0 route catalog

Base URL: `https://auth.chrbuilds.dev`. Paths below are relative to that URL. `{...}` denotes a path parameter. GoTrue accepts JSON for ordinary API calls. `Authorization: Bearer <ACCESS_TOKEN>` is required for user routes; admin routes require an admin-role JWT, not an ordinary user token. Never put an admin JWT or signing secret in browser code.

**Availability labels:** **Current** means the route matches a feature shown enabled by the live public settings or is a general utility route. **Configured** means a related service or provider must be enabled or verified. **Gated** means the router explicitly requires a feature flag; its live state has not been established unless noted. These are planning labels, not successful end-to-end test results.

## General and authentication

| Method | Path | Purpose | Availability |
|---|---|---|---|
| GET | `/health` | Service health and version | Current; live 200 |
| GET | `/settings` | Public auth capabilities | Current; live 200 |
| GET | `/.well-known/jwks.json` | Public JWT signing keys, if configured | Configured |
| GET | `/.well-known/openid-configuration` | OIDC discovery metadata | Configured |
| POST | `/signup` | Create email/password or phone account; anonymous sign-in when enabled | Current for email; confirmation/delivery needs mailer |
| POST | `/token?grant_type=password` | Sign in with email/phone and password | Current |
| POST | `/token?grant_type=refresh_token` | Rotate/refresh a session | Current |
| POST | `/token?grant_type=pkce` | Exchange a PKCE authorization code | Configured |
| POST | `/token?grant_type=id_token` | Exchange an external ID token | Configured |
| POST | `/token?grant_type=web3` | Web3 sign-in | Configured |
| GET, POST | `/verify` | Verify email/phone token, OTP, or link | Configured; email delivery currently Noop |
| POST | `/resend` | Resend confirmation or other supported message | Configured; email delivery currently Noop |
| POST | `/recover` | Begin password recovery | Configured; email delivery currently Noop |
| POST | `/otp` | Send one-time password or magic link | Configured; email delivery currently Noop |
| POST | `/magiclink` | Legacy magic-link request | Configured; email delivery currently Noop |
| GET | `/authorize` | Redirect to an external OAuth provider | Configured; providers currently disabled |
| GET, POST | `/callback` | External provider callback; usually called by provider | Configured; providers currently disabled |
| POST | `/logout` | Sign out a user; accepts session access token | User token |
| GET | `/reauthenticate` | Send a reauthentication nonce to the signed-in user | User token; mail/SMS delivery required |

`/token` is one route with a required `grant_type` query parameter. The five grant rows above are supported flows, not five separate router paths. Some grants have additional configuration requirements.

## Signed-in user and MFA

| Method | Path | Purpose | Availability |
|---|---|---|---|
| GET | `/user` | Read current user | User token |
| PUT | `/user` | Update email, password, phone, or user metadata | User token; changes may require verification |
| GET | `/user/identities/authorize` | Start manual identity linking | Gated: manual linking |
| DELETE | `/user/identities/{identity_id}` | Unlink an identity | Gated: manual linking |
| GET | `/user/oauth/grants` | List OAuth server grants given by user | Gated: OAuth server |
| DELETE | `/user/oauth/grants` | Revoke an OAuth server grant | Gated: OAuth server |
| POST | `/factors` | Enroll MFA factor | User token; factor type/configuration required |
| POST | `/factors/{factor_id}/challenge` | Start MFA challenge | User token |
| POST | `/factors/{factor_id}/verify` | Verify MFA challenge | User token |
| DELETE | `/factors/{factor_id}` | Remove MFA factor | User token |

## Passkeys

All passkey routes are **gated and currently disabled** (`passkeys_enabled: false` in live settings).

| Method | Path | Purpose | Additional access |
|---|---|---|---|
| POST | `/passkeys/authentication/options` | Get sign-in challenge | Public |
| POST | `/passkeys/authentication/verify` | Finish passkey sign-in | Public |
| POST | `/passkeys/registration/options` | Get registration challenge | User token |
| POST | `/passkeys/registration/verify` | Finish registration | User token |
| GET | `/passkeys` | List user's passkeys | User token |
| PATCH | `/passkeys/{passkey_id}` | Update passkey | User token |
| DELETE | `/passkeys/{passkey_id}` | Delete passkey | User token |

## SSO and SAML

These routes are **gated by SAML configuration**. The current deployment notes do not establish an operational SAML provider.

| Method | Path | Purpose |
|---|---|---|
| POST | `/sso` | Start SSO sign-in |
| GET | `/sso/saml/metadata` | SAML service-provider metadata |
| POST | `/sso/saml/acs` | SAML assertion consumer callback |

## Admin API

Every route here requires an **admin-role JWT** on a trusted backend. An ordinary user access token is insufficient. Admin availability was not probed with credentials.

| Method | Path | Purpose | Extra gate |
|---|---|---|---|
| POST | `/invite` | Invite a user by email | Mailer |
| GET | `/admin/audit` | Read auth audit events | — |
| GET | `/admin/users` | List users | — |
| POST | `/admin/users` | Create user | — |
| GET | `/admin/users/{user_id}` | Get user | — |
| PUT | `/admin/users/{user_id}` | Update user | — |
| DELETE | `/admin/users/{user_id}` | Delete user | — |
| GET | `/admin/users/{user_id}/factors` | List user's MFA factors | — |
| PUT | `/admin/users/{user_id}/factors/{factor_id}` | Update MFA factor | — |
| DELETE | `/admin/users/{user_id}/factors/{factor_id}` | Delete MFA factor | — |
| GET | `/admin/users/{user_id}/passkeys` | List user's passkeys | Passkey feature |
| DELETE | `/admin/users/{user_id}/passkeys/{passkey_id}` | Delete user's passkey | Passkey feature |
| POST | `/admin/generate_link` | Generate an action link/OTP | Link type and redirect configuration |
| GET | `/admin/sso/providers` | List SSO providers | SAML setup |
| POST | `/admin/sso/providers` | Create SSO provider | SAML setup |
| GET | `/admin/sso/providers/{idp_id}` | Get SSO provider | SAML setup |
| PUT | `/admin/sso/providers/{idp_id}` | Update SSO provider | SAML setup |
| DELETE | `/admin/sso/providers/{idp_id}` | Delete SSO provider | SAML setup |
| GET | `/admin/custom-providers` | List custom OAuth/OIDC providers | Custom OAuth enabled |
| POST | `/admin/custom-providers` | Create custom provider | Custom OAuth enabled |
| GET | `/admin/custom-providers/{identifier}` | Get custom provider | Custom OAuth enabled |
| PUT | `/admin/custom-providers/{identifier}` | Update custom provider | Custom OAuth enabled |
| DELETE | `/admin/custom-providers/{identifier}` | Delete custom provider | Custom OAuth enabled |
| GET | `/admin/oauth/clients` | List OAuth server clients | OAuth server enabled |
| POST | `/admin/oauth/clients` | Register OAuth server client | OAuth server enabled |
| GET | `/admin/oauth/clients/{client_id}` | Get OAuth server client | OAuth server enabled |
| PUT | `/admin/oauth/clients/{client_id}` | Update OAuth server client | OAuth server enabled |
| DELETE | `/admin/oauth/clients/{client_id}` | Delete OAuth server client | OAuth server enabled |
| POST | `/admin/oauth/clients/{client_id}/regenerate_secret` | Rotate client secret | OAuth server enabled |

## OAuth server and OIDC provider mode

These routes are **gated by OAuth server configuration**. They let GoTrue act as an OAuth provider for other applications; they are distinct from external-provider sign-in at top-level `/authorize`.

| Method | Path | Purpose | Additional access |
|---|---|---|---|
| GET | `/.well-known/oauth-authorization-server` | OAuth authorization-server metadata | Public |
| POST | `/oauth/clients/register` | Dynamic client registration | Public, rate limited |
| POST | `/oauth/token` | OAuth client token exchange | Client authentication |
| GET | `/oauth/userinfo` | OIDC user information | User token |
| GET | `/oauth/authorize` | Begin authorization flow | Flow-dependent |
| GET | `/oauth/authorizations/{authorization_id}` | Read pending authorization | User token |
| POST | `/oauth/authorizations/{authorization_id}/consent` | Approve/deny authorization | User token |

## SCIM

The v2.196.0 router registers these discovery routes under `/scim/v2`, all gated by SCIM enablement. Its server has a NotFound handler for other SCIM paths; do not infer working user/group provisioning routes from the path prefix.

| Method | Path | Purpose |
|---|---|---|
| GET | `/scim/v2/ServiceProviderConfig` | SCIM capabilities |
| GET | `/scim/v2/ResourceTypes` | SCIM resource types |
| GET | `/scim/v2/Schemas` | SCIM schemas |

## Scope and sources

This lists the HTTP methods and paths registered in [GoTrue v2.196.0 `internal/api/api.go`](https://github.com/supabase/auth/blob/v2.196.0/internal/api/api.go). Refer to the [same-version OpenAPI description](https://github.com/supabase/auth/blob/v2.196.0/openapi.yaml) for request and response fields before implementing a feature. `OPTIONS`/CORS preflight handling is middleware behavior, not a feature route. Future image upgrades may add, remove, or change routes; re-check the pinned source and live `/settings` after upgrading.
