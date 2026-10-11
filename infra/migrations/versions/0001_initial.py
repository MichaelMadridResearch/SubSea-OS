"""Initial fictional advisory schema."""

from alembic import op

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE EXTENSION IF NOT EXISTS postgis;

        CREATE OR REPLACE FUNCTION reject_mutation() RETURNS trigger AS $$
        BEGIN
          RAISE EXCEPTION 'append-only table';
        END;
        $$ LANGUAGE plpgsql;

        CREATE TABLE organizations (
          id uuid PRIMARY KEY,
          name text NOT NULL,
          is_fictional boolean NOT NULL,
          CONSTRAINT organizations_fictional CHECK (is_fictional)
        );

        CREATE TABLE users (
          id uuid PRIMARY KEY,
          organization_id uuid NOT NULL REFERENCES organizations(id),
          email text NOT NULL UNIQUE,
          password_hash text NOT NULL,
          role text NOT NULL,
          is_fictional boolean NOT NULL,
          CONSTRAINT users_role CHECK (role IN ('operator', 'viewer')),
          CONSTRAINT users_fictional CHECK (is_fictional)
        );

        CREATE TABLE wind_farms (
          id uuid PRIMARY KEY,
          organization_id uuid NOT NULL REFERENCES organizations(id),
          name text NOT NULL,
          is_fictional boolean NOT NULL,
          CONSTRAINT wind_farms_fictional CHECK (is_fictional)
        );

        CREATE TABLE export_cables (
          id uuid PRIMARY KEY,
          organization_id uuid NOT NULL REFERENCES organizations(id),
          wind_farm_id uuid NOT NULL REFERENCES wind_farms(id),
          name text NOT NULL,
          is_fictional boolean NOT NULL,
          CONSTRAINT export_cables_fictional CHECK (is_fictional)
        );

        CREATE TABLE routes (
          id uuid PRIMARY KEY,
          organization_id uuid NOT NULL REFERENCES organizations(id),
          export_cable_id uuid NOT NULL REFERENCES export_cables(id),
          name text NOT NULL,
          geom geometry(LineString, 4326) NOT NULL,
          is_fictional boolean NOT NULL,
          CONSTRAINT routes_fictional CHECK (is_fictional)
        );

        CREATE TABLE alerts (
          id uuid PRIMARY KEY,
          organization_id uuid NOT NULL REFERENCES organizations(id),
          export_cable_id uuid NOT NULL REFERENCES export_cables(id),
          external_ref text NOT NULL,
          summary text NOT NULL,
          location geometry(Point, 4326) NOT NULL,
          route_vertex integer NOT NULL,
          is_fictional boolean NOT NULL,
          CONSTRAINT alerts_fictional CHECK (is_fictional),
          CONSTRAINT alerts_ref UNIQUE (organization_id, external_ref)
        );

        CREATE TABLE response_cases (
          id uuid PRIMARY KEY,
          organization_id uuid NOT NULL REFERENCES organizations(id),
          alert_id uuid NOT NULL REFERENCES alerts(id),
          export_cable_id uuid NOT NULL REFERENCES export_cables(id),
          state text NOT NULL,
          opened_by uuid NOT NULL REFERENCES users(id),
          is_fictional boolean NOT NULL,
          CONSTRAINT response_cases_state CHECK (state = 'open'),
          CONSTRAINT response_cases_fictional CHECK (is_fictional),
          CONSTRAINT response_cases_one_alert UNIQUE (alert_id)
        );

        CREATE TABLE evidence_events (
          id uuid PRIMARY KEY,
          organization_id uuid NOT NULL REFERENCES organizations(id),
          case_id uuid NOT NULL REFERENCES response_cases(id),
          kind text NOT NULL,
          summary text NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          CONSTRAINT evidence_kind CHECK (
            kind IN ('alert_imported', 'location_mapped', 'case_opened')
          )
        );

        CREATE TABLE audit_events (
          id uuid PRIMARY KEY,
          organization_id uuid NOT NULL REFERENCES organizations(id),
          actor_id uuid NOT NULL REFERENCES users(id),
          action text NOT NULL,
          subject_type text NOT NULL,
          subject_id uuid NOT NULL,
          snapshot jsonb NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now()
        );

        CREATE TABLE sessions (
          token_hash text PRIMARY KEY,
          user_id uuid NOT NULL REFERENCES users(id)
        );

        CREATE INDEX alerts_org_idx ON alerts (organization_id);
        CREATE INDEX response_cases_org_idx ON response_cases (organization_id);

        CREATE TRIGGER evidence_append_only
          BEFORE UPDATE OR DELETE ON evidence_events
          FOR EACH ROW EXECUTE FUNCTION reject_mutation();

        CREATE TRIGGER audit_append_only
          BEFORE UPDATE OR DELETE ON audit_events
          FOR EACH ROW EXECUTE FUNCTION reject_mutation();
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DROP TABLE IF EXISTS sessions, audit_events, evidence_events, response_cases,
          alerts, routes, export_cables, wind_farms, users, organizations CASCADE;
        DROP FUNCTION IF EXISTS reject_mutation();
        """
    )
