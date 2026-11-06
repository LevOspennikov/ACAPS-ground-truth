import schema from '../../../../db/schema.sql?raw';
import riskSchema from '../../../../db/risk-radar.sql?raw';
import countryRiskSchema from '../../../../db/country-risk.sql?raw';
import { seedCountryRisks } from '../../../../db/seed-risk-radar.js';
import { configured, db } from '../../../server/db.js';
import { isAdmin } from '../../../server/auth.js';
import { sameOrigin, redirect, reject } from '../../../server/forms.js';

export async function POST({ request, cookies }) {
  if (!sameOrigin(request) || !configured() || !isAdmin(cookies)) return reject('Forbidden', 403);
  const sql = db();
  const statements = schema.split(';').map((statement) => statement.trim()).filter(Boolean);
  try {
    // Additive initialization and country-risk links; existing responses are preserved.
    await sql.transaction([...statements.map((statement) => sql.query(statement)), sql.query(riskSchema), ...countryRiskSchema.split(';').map((s) => s.trim()).filter(Boolean).map((s) => sql.query(s))]);
    await seedCountryRisks(sql);
  } catch {
    return reject('Could not initialize the database. Check the Neon connection and permissions, then try again.', 503);
  }
  return redirect('/admin');
}
