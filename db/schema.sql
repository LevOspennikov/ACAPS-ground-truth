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
