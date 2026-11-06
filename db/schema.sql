CREATE TABLE IF NOT EXISTS questionnaires (
  id uuid PRIMARY KEY,
  title text NOT NULL,
  context text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS experts (
  id uuid PRIMARY KEY,
  pseudonym text NOT NULL
);
CREATE TABLE IF NOT EXISTS assignments (
  id uuid PRIMARY KEY,
  questionnaire_id uuid NOT NULL REFERENCES questionnaires(id),
  expert_id uuid NOT NULL REFERENCES experts(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS invitations (
  token_hash text PRIMARY KEY,
  assignment_id uuid NOT NULL REFERENCES assignments(id),
  expires_at timestamptz NOT NULL,
  used_at timestamptz
);
CREATE TABLE IF NOT EXISTS expert_sessions (
  token_hash text PRIMARY KEY,
  assignment_id uuid NOT NULL REFERENCES assignments(id),
  expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS responses (
  assignment_id uuid PRIMARY KEY REFERENCES assignments(id),
  likelihood integer CHECK (likelihood BETWEEN 1 AND 5),
  confidence integer CHECK (confidence BETWEEN 1 AND 5),
  context text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz
);

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
CREATE TABLE IF NOT EXISTS questions (
  id uuid PRIMARY KEY,
  questionnaire_id uuid NOT NULL REFERENCES questionnaires(id),
  position integer NOT NULL,
  type text NOT NULL CHECK (type IN ('single', 'text')),
  prompt text NOT NULL,
  options text NOT NULL DEFAULT '',
  placeholder text NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS questionnaire_answers (
  assignment_id uuid PRIMARY KEY REFERENCES assignments(id),
  answer text NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now()
);
