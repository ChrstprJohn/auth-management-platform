-- Incremental upgrade from baseline 0001; user executes only.
BEGIN;
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
COMMIT;
