-- Full current admin schema. User executes on an empty admin database only.
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
CREATE TABLE management_audit (
  id uuid PRIMARY KEY,
  actor_id uuid NOT NULL,
  target_id uuid,
  action text NOT NULL CHECK (action IN ('create','ban','unban','delete')),
  outcome text NOT NULL DEFAULT 'pending' CHECK (outcome IN ('pending','succeeded','failed','unknown')),
  request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at timestamptz,
  CHECK ((outcome = 'pending' AND completed_at IS NULL) OR (outcome <> 'pending' AND completed_at IS NOT NULL))
);
CREATE INDEX management_audit_recent_idx ON management_audit (created_at DESC, id DESC);
CREATE INDEX management_audit_unresolved_idx ON management_audit (target_id) WHERE action IN ('ban','delete') AND outcome IN ('pending','unknown');
CREATE TABLE operator_recovery (
  recovery_hash text PRIMARY KEY CHECK (recovery_hash ~ '^[0-9a-f]{64}$'),
  email_hash text NOT NULL CHECK (email_hash ~ '^[0-9a-f]{64}$'),
  operator_id uuid,
  phase text NOT NULL DEFAULT 'pending' CHECK (phase IN ('pending','exchanging','ready','resetting')),
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL CHECK (expires_at > created_at AND expires_at <= created_at + interval '1 hour'),
  secret_ciphertext bytea NOT NULL,
  secret_nonce bytea NOT NULL CHECK (octet_length(secret_nonce) = 12),
  secret_tag bytea NOT NULL CHECK (octet_length(secret_tag) = 16),
  CHECK ((phase IN ('pending','exchanging') AND operator_id IS NULL) OR (phase IN ('ready','resetting') AND operator_id IS NOT NULL))
);
CREATE INDEX operator_recovery_expires_at_idx ON operator_recovery (expires_at);
CREATE INDEX operator_recovery_operator_id_idx ON operator_recovery (operator_id);
COMMIT;
