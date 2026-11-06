import rows from './seeds/risk-radar.json' with { type: 'json' };
import { riskRadarFields } from '../src/data/risk-radar-fields.js';

export function riskRadarSeedQueries(sql) {
  if (rows.length !== 10 || new Set(rows.map((row) => row['Risk ID'])).size !== 10) throw new Error('Expected ten distinct risk radar seed rows.');
  // Identifiers come only from the fixed field map; CSV values use parameters.
  const columns = [...riskRadarFields.map((field) => field.key), 'source_row'];
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  return rows.map((row, index) => {
    if (riskRadarFields.some((field) => typeof row[field.label] !== 'string')) throw new Error('CSV seed is missing a field.');
    const values = [...riskRadarFields.map((field) => row[field.label]), index + 1];
    return sql.query(`INSERT INTO risk_radar (${columns.join(', ')}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`, values);
  });
}
