import { db } from './db.js';
import { riskRadarFields } from '../data/risk-radar-fields.js';

export async function listRiskRadar(search, page) {
  const sql = db();
  const pattern = `%${search}%`;
  const [counts, records] = await sql.transaction([
    sql`SELECT count(*)::int AS total FROM risk_radar WHERE risk_id ILIKE ${pattern} OR risk_title ILIKE ${pattern} OR country ILIKE ${pattern}`,
    sql`SELECT * FROM risk_radar WHERE risk_id ILIKE ${pattern} OR risk_title ILIKE ${pattern} OR country ILIKE ${pattern}
      ORDER BY source_row ASC NULLS FIRST, created_at DESC, risk_id LIMIT 20 OFFSET ${(page - 1) * 20}`,
  ]);
  return { total: counts[0].total, records };
}
export async function addRiskRadar(record) {
  const columns = riskRadarFields.map((field) => field.key);
  // Fixed identifiers and parameterized values; no SQL is derived from input.
  return db().query(`INSERT INTO risk_radar (${columns.join(', ')}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')})`, columns.map((key) => record[key]));
}
