CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  archived boolean NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX IF NOT EXISTS categories_name_unique ON categories (lower(name));
CREATE TABLE IF NOT EXISTS crises (
  id uuid PRIMARY KEY,
  category_id uuid NOT NULL REFERENCES categories(id),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  country text NOT NULL,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS questionnaires (
  id uuid PRIMARY KEY,
  crisis_id uuid REFERENCES crises(id),
  title text NOT NULL,
  context text NOT NULL,
  questions jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(questions) = 'array'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS experts (
  id uuid PRIMARY KEY,
  pseudonym text NOT NULL,
  profile_mode text NOT NULL DEFAULT 'anonymous' CHECK (profile_mode IN ('named', 'anonymous')),
  name text,
  email text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (profile_mode <> 'anonymous' OR (name IS NULL AND email IS NULL))
);
CREATE TABLE IF NOT EXISTS assignments (
  id uuid PRIMARY KEY,
  questionnaire_id uuid NOT NULL REFERENCES questionnaires(id),
  expert_id uuid NOT NULL REFERENCES experts(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (questionnaire_id, expert_id)
);
CREATE TABLE IF NOT EXISTS invitations (
  token_hash text PRIMARY KEY,
  assignment_id uuid NOT NULL REFERENCES assignments(id),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  revoked_at timestamptz
);
CREATE TABLE IF NOT EXISTS expert_sessions (
  token_hash text PRIMARY KEY,
  assignment_id uuid NOT NULL REFERENCES assignments(id),
  expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS responses (
  assignment_id uuid PRIMARY KEY REFERENCES assignments(id),
  answers jsonb NOT NULL DEFAULT '{}',
  progress_step integer NOT NULL DEFAULT 0 CHECK (progress_step >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz
);
CREATE INDEX IF NOT EXISTS assignments_expert_idx ON assignments(expert_id);
CREATE INDEX IF NOT EXISTS invitations_assignment_idx ON invitations(assignment_id);
CREATE INDEX IF NOT EXISTS expert_sessions_assignment_idx ON expert_sessions(assignment_id);

CREATE TABLE IF NOT EXISTS regions (
  slug text PRIMARY KEY,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY,
  region_slug text NOT NULL REFERENCES regions(slug),
  title text NOT NULL,
  summary text NOT NULL,
  published_on date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE experts ADD COLUMN IF NOT EXISTS region_slug text REFERENCES regions(slug);
ALTER TABLE experts ADD COLUMN IF NOT EXISTS focus text NOT NULL DEFAULT '';
ALTER TABLE questionnaires ADD COLUMN IF NOT EXISTS region_slug text REFERENCES regions(slug);
ALTER TABLE questionnaires ADD COLUMN IF NOT EXISTS sent_at timestamptz;

-- Round 2: Store revised expert assessments separately.
-- Preserve original Round 1 answers in the responses table.

CREATE TABLE IF NOT EXISTS round_two_responses (
    assignment_id uuid PRIMARY KEY
        REFERENCES assignments(id) ON DELETE CASCADE,

    answers jsonb NOT NULL DEFAULT '{}'::jsonb
        CHECK (jsonb_typeof(answers) = 'object'),

    progress_step integer NOT NULL DEFAULT 0
        CHECK (progress_step >= 0),

    updated_at timestamptz NOT NULL DEFAULT now(),

    submitted_at timestamptz
);
