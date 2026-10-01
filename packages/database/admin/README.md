# Admin database

SQL is prepared only; no database/role has been created and no SQL has been executed by the agent. Target a separate `admin_local_db` locally or `admin_db` in production, never GoTrue's database. The user supplies connection credentials and executes every setup/migration operation.

Prerequisites: a user-provisioned PostgreSQL database, schema owner, and restricted runtime role. Execute as the owner with `ON_ERROR_STOP`; the API role requires SELECT/INSERT/DELETE on `operator_sessions` and no access to GoTrue/platform tables. No extension or cross-database foreign key is needed. Set the runtime role's search path to the admin-owned schema and prevent untrusted roles from creating objects there. Do not grant DDL to the runtime API.

## Initialization versus upgrade

For an empty database, execute `schema.sql` once and record baseline 0001. Alternatively execute migration 0001 once. Do not execute both. For an existing database, execute only migrations after its recorded baseline in numerical order. The API never executes schema or migration files, including at startup or in tests.

| Migration                               | Change                                                      | Execution status                 |
| --------------------------------------- | ----------------------------------------------------------- | -------------------------------- |
| `migrations/0001_operator_sessions.sql` | Opaque session hashes and AES-GCM encrypted upstream tokens | Prepared; user execution pending |

Both files use an explicit transaction. There is no backfill, destructive drop, or seed. SQL cannot establish that the live database is current. Session encryption key replacement invalidates old sessions; after changing it, the user can remove old session rows as a deliberate maintenance operation. Expired rows do not authorize requests; periodically removing expired rows is user-managed maintenance in V1.
