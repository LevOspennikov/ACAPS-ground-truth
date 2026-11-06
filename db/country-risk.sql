ALTER TABLE risk_radar ADD COLUMN IF NOT EXISTS region_slug text REFERENCES regions(slug);
ALTER TABLE risk_radar DROP CONSTRAINT IF EXISTS risk_radar_source_row_check;
ALTER TABLE risk_radar ADD CONSTRAINT risk_radar_source_row_check CHECK (source_row > 0);
CREATE INDEX IF NOT EXISTS risk_radar_region_idx ON risk_radar(region_slug);
ALTER TABLE questionnaires ADD COLUMN IF NOT EXISTS risk_id text REFERENCES risk_radar(risk_id);
CREATE INDEX IF NOT EXISTS questionnaires_risk_idx ON questionnaires(risk_id);
