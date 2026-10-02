-- User executes as the admin schema owner after baseline 0003.
-- No GoTrue tables, data backfill, or destructive data changes.
BEGIN;
ALTER TABLE management_audit DROP CONSTRAINT management_audit_action_check;
ALTER TABLE management_audit ADD CONSTRAINT management_audit_action_check
  CHECK (action IN ('create','ban','unban','delete','invite','send_verification'));
COMMIT;
