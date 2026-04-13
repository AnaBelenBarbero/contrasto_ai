-- =============================================================================
-- AI Incident Tracker — Supabase Schema
-- Run this file in the Supabase SQL editor (Settings → SQL Editor → New query).
-- =============================================================================

-- ── Main incidents table ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS incidents (
  id            TEXT        PRIMARY KEY,
  date          DATE        NOT NULL,
  title         TEXT        NOT NULL,
  description   TEXT        NOT NULL,
  incident_type TEXT        NOT NULL
    CHECK (incident_type IN ('ai_harm', 'layoff', 'regulatory', 'model_failure')),
  links         JSONB       NOT NULL DEFAULT '[]'::jsonb,
  tags          TEXT[]      NOT NULL DEFAULT '{}',
  source        TEXT        NOT NULL,
  countries     TEXT[]      NOT NULL DEFAULT '{}',
  companies     TEXT[]      NOT NULL DEFAULT '{}',
  image_url     TEXT,
  metadata      JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE incidents IS
  'Central log of AI-related incidents: harm events, layoffs, regulatory actions, and model failures.';

COMMENT ON COLUMN incidents.incident_type IS
  'Discriminator: ai_harm | layoff | regulatory | model_failure';
COMMENT ON COLUMN incidents.countries IS
  'ISO-3166-1 alpha-2 codes for countries involved, e.g. {US,EU,UK}.';
COMMENT ON COLUMN incidents.companies IS
  'All implicated organisations (actors and victims), de-duplicated.';
COMMENT ON COLUMN incidents.metadata IS
  'Type-specific risk fields:
   ai_harm    → harm_categories[], affected_population, aiid_id?, severity?
   layoff     → sector, jobs_lost, ai_automation_confirmed, severity?
   regulatory → regulator, fine_amount_usd?, regulation_violated, severity?
   model_failure → model_name, failure_mode, users_affected?, severity?';
COMMENT ON COLUMN incidents.image_url IS
  'Optional card illustration URL (Unsplash, picsum, etc.).';

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_incidents_type
  ON incidents (incident_type);

CREATE INDEX IF NOT EXISTS idx_incidents_date
  ON incidents (date DESC);

CREATE INDEX IF NOT EXISTS idx_incidents_countries
  ON incidents USING GIN (countries);

CREATE INDEX IF NOT EXISTS idx_incidents_companies
  ON incidents USING GIN (companies);

CREATE INDEX IF NOT EXISTS idx_incidents_tags
  ON incidents USING GIN (tags);

CREATE INDEX IF NOT EXISTS idx_incidents_metadata
  ON incidents USING GIN (metadata jsonb_path_ops);

-- ── Aggregation view ──────────────────────────────────────────────────────────
-- All counter totals in a single row.
-- The CounterBar component queries this view with .single() for O(n) aggregation.

CREATE OR REPLACE VIEW v_counters AS
SELECT
  COUNT(*)::int                                                             AS total_incidents,
  COUNT(*) FILTER (WHERE incident_type = 'layoff')::int                    AS layoff_events,
  COUNT(*) FILTER (WHERE incident_type = 'ai_harm')::int                   AS harm_incidents,
  COUNT(*) FILTER (WHERE incident_type = 'regulatory')::int                AS regulatory_actions,
  COUNT(*) FILTER (WHERE incident_type = 'model_failure')::int             AS model_failures,
  COALESCE(
    SUM((metadata ->> 'jobs_lost')::int)
      FILTER (WHERE incident_type = 'layoff' AND metadata ? 'jobs_lost'),
    0
  )::int                                                                    AS total_jobs_lost,
  COALESCE(
    SUM((metadata ->> 'fine_amount_usd')::numeric)
      FILTER (WHERE incident_type = 'regulatory' AND metadata ? 'fine_amount_usd'),
    0
  )::numeric                                                                AS total_fines_usd,
  COALESCE(
    SUM((metadata ->> 'users_affected')::int)
      FILTER (WHERE incident_type = 'model_failure' AND metadata ? 'users_affected'),
    0
  )::int                                                                    AS total_users_affected
FROM incidents;

-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;

-- Public read: any anonymous visitor can read incidents (read-only frontend).
CREATE POLICY "incidents_select_public"
  ON incidents
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Write access: only the server-side service_role key (used by seed.py).
-- NEVER expose the service_role key in browser code.
CREATE POLICY "incidents_write_service_role"
  ON incidents
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
