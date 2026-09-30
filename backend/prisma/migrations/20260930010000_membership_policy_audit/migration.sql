ALTER TABLE dashboard.projects ADD COLUMN enrollment_policy text NOT NULL DEFAULT 'closed';
ALTER TABLE dashboard.projects ADD CONSTRAINT projects_enrollment_policy CHECK (enrollment_policy IN ('open', 'closed'));

CREATE TABLE dashboard.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,
  action text NOT NULL,
  target_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_events_created_at_id_idx ON dashboard.audit_events (created_at, id);
