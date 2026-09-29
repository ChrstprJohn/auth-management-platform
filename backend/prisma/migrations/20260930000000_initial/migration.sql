-- Applied by Prisma Migrate to dashboard_db. Never run in auth_db.
CREATE SCHEMA IF NOT EXISTS dashboard;

CREATE TABLE dashboard.projects (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text NOT NULL UNIQUE,
    name text NOT NULL,
    description text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT projects_slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    CONSTRAINT projects_name_not_blank CHECK (length(btrim(name)) > 0)
);

CREATE FUNCTION dashboard.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER projects_set_updated_at
BEFORE UPDATE ON dashboard.projects
FOR EACH ROW EXECUTE FUNCTION dashboard.set_updated_at();

-- IDs refer to GoTrue auth.users.id in the separate auth_db. A cross-database
-- foreign key is impossible; the future backend must validate these IDs.
CREATE TABLE dashboard.project_memberships (
    project_id uuid NOT NULL REFERENCES dashboard.projects(id) ON DELETE CASCADE,
    gotrue_user_id uuid NOT NULL,
    role text NOT NULL DEFAULT 'member',
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (project_id, gotrue_user_id),
    CONSTRAINT project_memberships_role CHECK (role IN ('member', 'manager'))
);

CREATE INDEX project_memberships_user_id_idx
    ON dashboard.project_memberships (gotrue_user_id);

-- Operators who may manage this dashboard. Add rows only after the GoTrue
-- account exists and the backend's admin authorization is implemented.
CREATE TABLE dashboard.dashboard_admins (
    gotrue_user_id uuid PRIMARY KEY,
    created_at timestamptz NOT NULL DEFAULT now()
);

