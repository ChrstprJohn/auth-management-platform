-- Local prerequisite/setup, not an application schema migration.
-- USER EXECUTION ONLY: connect as the owner/administrator to admin_local_db.
-- Run once after schema baseline 0003. Set the role password through your
-- database client's role/password UI afterward; never save it in this file.
BEGIN;
DO $$
BEGIN
  IF current_database() <> 'admin_local_db' THEN
    RAISE EXCEPTION 'Connect to admin_local_db before executing runtime-role setup';
  END IF;
  IF to_regclass('public.operator_sessions') IS NULL
     OR to_regclass('public.management_audit') IS NULL
     OR to_regclass('public.operator_recovery') IS NULL THEN
    RAISE EXCEPTION 'Initialize the public admin schema through baseline 0003 first';
  END IF;
END;
$$;
CREATE ROLE admin_api_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOREPLICATION NOBYPASSRLS NOINHERIT;
GRANT CONNECT ON DATABASE admin_local_db TO admin_api_runtime;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO admin_api_runtime;
GRANT SELECT, INSERT, DELETE ON TABLE public.operator_sessions TO admin_api_runtime;
GRANT SELECT, INSERT, UPDATE ON TABLE public.management_audit TO admin_api_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.operator_recovery TO admin_api_runtime;
ALTER ROLE admin_api_runtime IN DATABASE admin_local_db SET search_path = public;
COMMIT;
