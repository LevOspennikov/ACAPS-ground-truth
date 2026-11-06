import { db } from './db.js';

// Shared eligibility rule for new invitations and user-profile assignments.
// Region-wide questionnaires are relevant to every member of that country.
export const coverageEligibility = `EXISTS (
  SELECT 1 FROM expert_countries ec WHERE ec.expert_id = e.id AND ec.region_slug = q.region_slug
  AND (q.risk_id IS NULL OR ec.risk_scope = 'all' OR EXISTS (
    SELECT 1 FROM expert_risks er WHERE er.expert_id = e.id AND er.region_slug = q.region_slug AND er.risk_id = q.risk_id
  ))
)`;

export async function coverageOptions() {
  const sql = db();
  const countries = await sql`SELECT slug, name FROM regions ORDER BY name`;
  const risks = await sql`SELECT risk_id, risk_title, region_slug FROM risk_radar ORDER BY risk_id`;
  return countries.map((country) => ({ ...country, risks: risks.filter((risk) => risk.region_slug === country.slug) }));
}

export async function readCoverage(form) {
  const slugs = [...new Set(form.getAll('countries'))];
  if (!slugs.length || slugs.length > 100 || slugs.some((slug) => typeof slug !== 'string')) throw new Error('Choose at least one country.');
  const options = await coverageOptions();
  return slugs.map((slug) => {
    const country = options.find((item) => item.slug === slug);
    if (!country) throw new Error('Choose a valid country.');
    const scope = form.get(`scope_${slug}`);
    if (!['all', 'selected'].includes(scope)) throw new Error('Choose all risks or selected risks for each country.');
    const risks = scope === 'all' ? [] : [...new Set(form.getAll(`risks_${slug}`))];
    if (scope === 'selected' && !risks.length) throw new Error('Choose at least one risk for restricted country coverage.');
    if (risks.some((id) => !country.risks.some((risk) => risk.risk_id === id))) throw new Error('Choose only risks belonging to the selected country.');
    return { region: slug, scope, risks };
  });
}

export async function expertCoverage(id) {
  const sql = db();
  const countries = await sql`SELECT c.region_slug AS region, c.risk_scope AS scope, g.name FROM expert_countries c JOIN regions g ON g.slug = c.region_slug WHERE c.expert_id = ${id} ORDER BY g.name`;
  const risks = await sql`SELECT region_slug, risk_id FROM expert_risks WHERE expert_id = ${id}`;
  return countries.map((country) => ({ ...country, risks: risks.filter((risk) => risk.region_slug === country.region).map((risk) => risk.risk_id) }));
}

export function coverageQueries(sql, id, coverage) {
  return [
    sql`DELETE FROM expert_countries WHERE expert_id = ${id}`,
    ...coverage.flatMap((country) => [
      sql`INSERT INTO expert_countries (expert_id, region_slug, risk_scope) VALUES (${id}, ${country.region}, ${country.scope})`,
      ...country.risks.map((risk) => sql`INSERT INTO expert_risks (expert_id, region_slug, risk_id) VALUES (${id}, ${country.region}, ${risk})`),
    ]),
  ];
}

export async function questionnaireRecipients(slug, id) {
  return db().query(`SELECT e.id, e.pseudonym, a.id AS assignment_id, r.submitted_at, r.updated_at,
    ${coverageEligibility} AS currently_eligible
    FROM experts e CROSS JOIN questionnaires q
    LEFT JOIN assignments a ON a.questionnaire_id = q.id AND a.expert_id = e.id
    LEFT JOIN responses r ON r.assignment_id = a.id
    WHERE q.id = $1 AND q.region_slug = $2 AND e.active = true
    AND (${coverageEligibility} OR a.id IS NOT NULL) ORDER BY e.pseudonym, e.id`, [id, slug]);
}
