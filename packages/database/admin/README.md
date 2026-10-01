# Admin database

SQL is prepared only; no database/role has been created and no SQL has been executed by the agent. Target a separate `admin_local_db` locally or `admin_db` in production, never GoTrue's database. The user supplies connection credentials and executes every setup/migration operation.

Prerequisites: a user-provisioned PostgreSQL database, schema owner, and restricted runtime role. Execute as the owner with `ON_ERROR_STOP`; the API role requires SELECT/INSERT/DELETE on `operator_sessions`, SELECT/INSERT/UPDATE on `management_audit`, and no access to GoTrue/platform tables. No extension or cross-database foreign key is needed. Set the runtime role's search path to the admin-owned schema and prevent untrusted roles from creating objects there. Do not grant DDL to the runtime API. Session-level advisory locking requires a direct PostgreSQL connection or session pooling; transaction-pooling proxies are unsupported.

## Initialization versus upgrade

For an empty database, execute current `schema.sql` once and record baseline 0002. Alternatively execute migration 0001 then 0002 once. Do not execute both approaches. For an existing database at 0001, execute only `migrations/0002_management_audit.sql`. The API never executes schema or migration files, including at startup or in tests.

| Migration                               | Change                                                      | Execution status                 |
| --------------------------------------- | ----------------------------------------------------------- | -------------------------------- |
| `migrations/0001_operator_sessions.sql` | Opaque session hashes and AES-GCM encrypted upstream tokens | Prepared; user execution pending |
| `migrations/0002_management_audit.sql`  | Durable mutation intent/outcomes and history indexes        | Prepared; user execution pending |

All SQL files use an explicit transaction. There is no backfill, destructive drop, or seed. Migration 0001 is preserved as the original session baseline; only the current full schema includes 0002. SQL cannot establish that the live database is current. Session encryption key replacement invalidates old sessions; after changing it, the user can remove old session rows as a deliberate maintenance operation. Expired rows do not authorize requests; periodically removing expired rows is user-managed maintenance in V1.

## Trusted audit reconciliation

`pending` and `unknown` both mean uncertain, including across process restart. Do not replay the mutation automatically. Inspect the audit/request ID and current state using supported GoTrue admin operations. Current state alone may not establish which request caused it. If evidence is sufficient, the user updates only the identified audit row to `succeeded` or `failed`, sets `completed_at`, and supplies the verified created target UUID if needed, using a parameterized trusted tool. Keep `unknown` when evidence is insufficient. Pending/unknown ban/delete intents targeting configured operators prevent further operator removals. There is no automatic reconciliation or retention cleanup.
