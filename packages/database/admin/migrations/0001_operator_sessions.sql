-- Baseline migration for an empty admin database, equivalent to schema.sql.
BEGIN;
CREATE TABLE operator_sessions (
  session_hash text PRIMARY KEY CHECK (session_hash ~ '^[0-9a-f]{64}$'),
  operator_id uuid NOT NULL,
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL CHECK (expires_at > created_at AND expires_at <= created_at + interval '1 hour'),
  token_ciphertext bytea NOT NULL,
  token_nonce bytea NOT NULL CHECK (octet_length(token_nonce) = 12),
  token_tag bytea NOT NULL CHECK (octet_length(token_tag) = 16)
);
CREATE INDEX operator_sessions_operator_id_idx ON operator_sessions (operator_id);
CREATE INDEX operator_sessions_expires_at_idx ON operator_sessions (expires_at);
COMMIT;
