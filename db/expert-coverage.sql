CREATE UNIQUE INDEX IF NOT EXISTS risk_radar_country_unique ON risk_radar(risk_id, region_slug);
CREATE TABLE IF NOT EXISTS expert_countries (
  expert_id uuid NOT NULL REFERENCES experts(id),
  region_slug text NOT NULL REFERENCES regions(slug),
  risk_scope text NOT NULL DEFAULT 'all' CHECK (risk_scope IN ('all', 'selected')),
  PRIMARY KEY (expert_id, region_slug)
);
CREATE TABLE IF NOT EXISTS expert_risks (
  expert_id uuid NOT NULL,
  region_slug text NOT NULL,
  risk_id text NOT NULL,
  PRIMARY KEY (expert_id, region_slug, risk_id),
  FOREIGN KEY (expert_id, region_slug) REFERENCES expert_countries(expert_id, region_slug) ON DELETE CASCADE,
  FOREIGN KEY (risk_id, region_slug) REFERENCES risk_radar(risk_id, region_slug)
);
INSERT INTO expert_countries (expert_id, region_slug)
SELECT e.id, e.region_slug FROM experts e WHERE e.region_slug IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM expert_countries c WHERE c.expert_id = e.id)
ON CONFLICT DO NOTHING;
