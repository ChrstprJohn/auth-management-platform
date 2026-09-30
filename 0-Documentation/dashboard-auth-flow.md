# Auth Management Platform: authentication and administrator flow

Reference for the current local backend and its planned VM deployment. Updated September 30, 2026.

## How applications and dashboards use these APIs

GoTrue is the shared authentication API. Applications can call its public signup, login, refresh, and recovery endpoints according to the server's configuration. A signed-in application receives a normal user token and sends it to its own protected backend when accessing application data. Each application backend must enforce its own permissions; having a GoTrue account does not grant access to every application.

Our dashboard backend is the shared administration API we are building. All dashboard-facing administrative actions belong here: project management today, and user creation, deletion, updates, and membership management as those features are implemented. Dashboard screens call this backend rather than calling GoTrue's privileged endpoints directly.

```text
Application A / Application B
    | signup, login, refresh
    v
Shared GoTrue authentication API
    | normal user access tokens
    v
Applications call their own backends, which enforce application permissions

Admin dashboard A / Future admin dashboard B
    | normal user access token + requested admin action
    v
Shared dashboard administration backend
    | verifies user through GoTrue and checks dashboard permissions
    | manages dashboard data in dashboard_db
    | uses server-held privileged credential for auth administration
    v
GoTrue protected /admin endpoints
```

Another dashboard can use this same administration backend later. It signs its operator in through the same GoTrue service and sends their access token with every request. The backend checks permissions independently of which dashboard sent the request. The dashboard does not receive a privileged GoTrue token and cannot grant itself permission.

When another browser dashboard uses a different origin, configure the backend's allowed browser origins and the appropriate GoTrue redirect/origin settings. CORS is browser access configuration, not authorization. If dashboards should have different scopes, add explicit role/project permissions rather than granting every operator global dashboard-admin access. The current `dashboard_admins` check grants access to all implemented project routes.

GoTrue still physically exposes its own protected admin endpoints. In our application architecture, all privileged calls to them originate from the administration backend after permission checks. The frontend does not call them with an operator credential.

## Agreed approach: shared accounts, separate project access

Keep GoTrue unchanged as the shared authentication service, and keep our dashboard administration backend separate. One GoTrue account may belong to several projects, but a successful login alone does not grant access to any project.

The planned flow is:

1. **Signup:** GoTrue creates the account. Once the user's identity is verified, our backend assigns project membership according to that project's registration policy. A client-supplied project name or user metadata alone cannot grant membership or an elevated role.
2. **Login:** GoTrue validates credentials and returns a normal user access token. An existing user does not need another account to join another project.
3. **Project access:** The project's backend verifies the token and checks the verified user's membership in the requested project before granting access. Perform this check on protected API requests, not only on the login screen.
4. **Administration:** Dashboard operators call our administration backend to manage projects, memberships, and eventually GoTrue users. That backend checks dashboard admin permission before using any server-held GoTrue operator credential.

Example: Christopher joins CRM. GoTrue stores his account; `project_memberships` links his UUID to CRM. He can authenticate using those same credentials from Dental, but Dental's backend denies project access until Dental membership is granted. If he later joins Dental, both memberships refer to the same GoTrue UUID. This provides shared identity with independently controlled project access, rather than separate passwords/accounts per project.

`projects` defines the projects. `project_memberships` records who may access each project and their role. `dashboard_admins` records who may administer the dashboard. GoTrue metadata may describe signup origin, but these permission tables are the authority for access.

If signup succeeds but membership assignment fails or is never called, the account still exists without that membership. It has no access to the project's protected resources. Enrollment should be retryable and avoid duplicate membership rows. Joining a project must follow a defined policy, such as open registration, a valid invitation, or administrator approval.

**Implementation status:** Project management and dashboard admin checks exist. Signup enrollment, project enrollment policies, project-user membership authorization, and GoTrue admin integration remain planned. Other application backends must enforce project access too; our administration backend cannot protect an application's API unless that API participates in these checks.

## Component responsibilities

| Component | Responsibility |
|---|---|
| GoTrue | Accounts, password hashing, login, access/refresh tokens, and protected authentication administration. |
| Dashboard backend | Verify the caller through GoTrue, check dashboard permissions, and execute permitted operations. |
| Dashboard database | Store projects, project memberships, and dashboard administrator UUIDs. |
| Frontend | Sign in and send the user's access token to the backend. Never hold a GoTrue operator credential. |

The same GoTrue account can be a dashboard administrator without being a GoTrue operator. Dashboard permission does not change that account's login token into a privileged GoTrue token.

## Current project request flow

```text
User signs in through GoTrue POST /token?grant_type=password
    |
    v
GoTrue returns a normal user access token
    |
    v
Client calls dashboard /api/projects with Authorization: Bearer <access_token>
    |
    v
requireAuth calls GoTrue GET /user with that token
    |
    v
GoTrue returns the verified user UUID
    |
    v
requireDashboardAdmin checks that UUID in dashboard.dashboard_admins
    |
    v
Authorized backend controller/service/repository operates on projects
```

All implemented project create, list, and read routes require both checks. The user ID comes from GoTrue, not the request body or user-editable metadata. Administrator membership is checked on each request; deleting the corresponding row revokes dashboard access.

| Condition | Backend result |
|---|---|
| Missing, malformed, invalid, or expired access token | 401 |
| Verified user without a dashboard admin row | 403 |
| Missing GoTrue URL, upstream failure, malformed upstream identity, or five-second auth timeout | 503 |
| Verified dashboard admin | Project operation runs; normal validation/database errors can still occur. |

`/health` and `/health/ready` do not require authentication. Readiness checks the database.

## Local setup

The local backend authenticates against the existing VM GoTrue service and checks permissions in local PostgreSQL.

```env
# backend/.env: retain the existing local DATABASE_URL
GOTRUE_URL=https://auth.chrbuilds.dev
```

Local PostgreSQL connection settings from `backend/compose.local.yml`:

| Field | Value |
|---|---|
| Host | 127.0.0.1 |
| Port | 5433 |
| Database | dashboard_db |
| Username | dashboard_app |
| Password | local_dashboard_password (local example only) |

Create accounts through GoTrue's API so password hashing and identity records are handled by GoTrue. After confirming the account's UUID, bootstrap dashboard permission in a trusted SQL session connected to **dashboard_db**:

```sql
INSERT INTO dashboard.dashboard_admins (gotrue_user_id)
VALUES ('YOUR-VERIFIED-GOTRUE-USER-UUID')
ON CONFLICT DO NOTHING;

SELECT gotrue_user_id FROM dashboard.dashboard_admins;
```

Do not insert this row into `auth_db`. GoTrue uses `auth_db`; the dashboard uses `dashboard_db`. Their UUID references cannot have cross-database foreign keys, so account IDs must be verified independently.

Email confirmation is separate from dashboard permission. Current documentation records autoconfirm disabled and deferred mail delivery; an unconfirmed account may be unable to sign in until confirmation is resolved.

## Why publicly reachable GoTrue admin URLs are protected

Public reachability does not grant permission. GoTrue enforces authorization on its own endpoints independently of our dashboard database.

| GoTrue endpoint | Access |
|---|---|
| POST /signup | Public account registration when signup is enabled. |
| POST /token?grant_type=password | Login using valid account credentials. |
| GET /user | A valid user access token. |
| POST /admin/users | A valid privileged GoTrue admin token. |
| DELETE /admin/users/{id} | A valid privileged GoTrue admin token. |

A normal login token cannot authorize GoTrue admin operations. Editing a token's role invalidates its signature. Direct SQL operations instead use database permissions and bypass HTTP authorization.

The live admin endpoint rejection behavior has not been independently verified in this workflow.

## Future user-management flow

```text
Dashboard sends normal user access token to our backend
    |
    v
Backend verifies identity and checks dashboard_admins
    |
    v
Backend calls GoTrue /admin/users using its server-held admin JWT
    |
    v
GoTrue verifies that privileged JWT and performs the operation
```

The privileged credential belongs to the backend, not to the administrator's browser session. Do not promote ordinary users to GoTrue operator roles just to grant dashboard access.

## Signing secret versus admin token

| Variable | Where it lives | Meaning |
|---|---|---|
| GOTRUE_JWT_SECRET | GoTrue VM environment | Existing signing secret in the documented symmetric signing setup. It is not itself a JWT. |
| GOTRUE_JWT_ADMIN_ROLES | GoTrue configuration | Roles accepted for privileged operations; verify configured values or pinned-version defaults before minting a token. |
| GOTRUE_ADMIN_TOKEN | Planned dashboard backend VM environment | A signed JWT with an accepted privileged role and expiration. This is our proposed backend variable, not a GoTrue built-in setting. |
| GOTRUE_URL | Dashboard backend environment | Trusted GoTrue base URL used to verify user tokens and, later, make admin calls. |

Standalone GoTrue does not provide a public admin-token generation endpoint. For the documented secret-based setup, generate the token privately on the VM using a trusted signing script and the existing signing secret. Verify the actual signing configuration and accepted role first. Plan expiration/renewal and test the credential with a read-only admin call.

Store only the resulting admin JWT in the backend environment when possible; the running dashboard backend does not need the signing secret to verify users through `/user`. Never put either credential in frontend environment variables, browser bundles, Git, screenshots, or logs.

Adding `GOTRUE_ADMIN_TOKEN` alone does nothing yet: the current backend has no GoTrue administration client using it.

## VM deployment checklist for later

1. Create a separate VM `dashboard_db` and database login, then apply dashboard migrations. Do not migrate GoTrue's `auth_db` with our Prisma schema.
2. Set backend `DATABASE_URL` to the private `postgres:5432` dashboard database and `GOTRUE_URL=http://gotrue:8081` on `app_network`.
3. Bootstrap the verified account UUID into the VM's `dashboard.dashboard_admins`. Local permission rows are not copied automatically.
4. Verify real login, project access, rejection of unauthorized users, and readiness on the VM.
5. Implement backend GoTrue admin integration, verify the live admin-role/signing configuration, and generate/store its privileged credential privately before enabling user-management features.
6. Configure the frontend's real login/project requests and the intended HTTPS Caddy route. Keep database and operator credentials server-side.

The user's local tests and authenticated project request were reported successful in this chat. This does not verify VM deployment or future GoTrue user-management operations. The frontend still uses placeholder login/mock project data unless changed separately.

See [backend setup](../backend/README.md), [database and migrations](../backend/DATABASE.md), and [GoTrue VM reference](../1-Virtual_Machine_Architecture/5-auth-server.md).
