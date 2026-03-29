BEGIN;

CREATE TABLE IF NOT EXISTS instructors (
  instructor_id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  first_cohort TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'penalty')),
  tier TEXT NOT NULL DEFAULT 'General' CHECK (tier IN ('General', 'Advanced', 'Master', 'Penalty')),
  assistant_ready BOOLEAN NOT NULL DEFAULT FALSE,
  lead_ready BOOLEAN NOT NULL DEFAULT FALSE,
  dls_lead_ready BOOLEAN NOT NULL DEFAULT FALSE,
  ops_ready BOOLEAN NOT NULL DEFAULT FALSE,
  class_points NUMERIC(6,2) NOT NULL DEFAULT 0,
  feedback_points NUMERIC(6,2) NOT NULL DEFAULT 0,
  contribution_points NUMERIC(6,2) NOT NULL DEFAULT 0,
  penalty_points NUMERIC(6,2) NOT NULL DEFAULT 0,
  total_score NUMERIC(6,2) NOT NULL DEFAULT 0,
  school TEXT,
  major TEXT,
  project_experience TEXT,
  residence TEXT,
  movable_range TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS instructor_sensitive (
  instructor_id TEXT PRIMARY KEY REFERENCES instructors(instructor_id) ON DELETE CASCADE,
  phone TEXT,
  rrn TEXT,
  email TEXT,
  bank_name TEXT,
  bank_account TEXT,
  address TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activity_logs (
  log_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  instructor_id TEXT NOT NULL REFERENCES instructors(instructor_id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  category TEXT NOT NULL,
  activity_type TEXT NOT NULL,
  role TEXT,
  points NUMERIC(6,2) NOT NULL DEFAULT 0,
  penalty_points NUMERIC(6,2) NOT NULL DEFAULT 0,
  request_id TEXT,
  note TEXT
);

CREATE TABLE IF NOT EXISTS assignment_logs (
  assignment_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id TEXT NOT NULL,
  course_id TEXT,
  instructor_id TEXT NOT NULL REFERENCES instructors(instructor_id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('assistant', 'lead', 'dls_lead', 'ops')),
  survey_code TEXT,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  note TEXT
);

CREATE TABLE IF NOT EXISTS feedback_logs (
  feedback_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id TEXT,
  instructor_id TEXT NOT NULL REFERENCES instructors(instructor_id) ON DELETE CASCADE,
  feedback_source TEXT NOT NULL CHECK (feedback_source IN ('teacher', 'student', 'reflection')),
  raw_score NUMERIC(6,2),
  normalized_score NUMERIC(6,2),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  note TEXT
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_instructor_logged_at
  ON activity_logs(instructor_id, logged_at DESC);

CREATE INDEX IF NOT EXISTS idx_assignment_logs_instructor_request
  ON assignment_logs(instructor_id, request_id);

CREATE INDEX IF NOT EXISTS idx_feedback_logs_instructor_submitted_at
  ON feedback_logs(instructor_id, submitted_at DESC);

CREATE OR REPLACE VIEW v_instructor_summary AS
SELECT
  i.instructor_id,
  i.full_name,
  i.status,
  i.tier,
  i.assistant_ready,
  i.lead_ready,
  i.dls_lead_ready,
  i.ops_ready,
  i.class_points,
  i.feedback_points,
  i.contribution_points,
  i.penalty_points,
  i.total_score,
  i.school,
  i.major,
  i.project_experience,
  i.residence,
  i.movable_range,
  i.updated_at
FROM instructors i;

COMMIT;
