-- Apply once to an admin database already at baseline 0002. User execution only.
BEGIN;
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
