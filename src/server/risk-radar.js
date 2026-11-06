import { db } from './db.js';
import { riskRadarFields } from '../data/risk-radar-fields.js';

export async function addRiskRadar(record, regionSlug) {
  const columns = [...riskRadarFields.map((field) => field.key), 'region_slug'];
  // Fixed identifiers and parameterized values; no SQL is derived from input.
  return db().query(`INSERT INTO risk_radar (${columns.join(', ')}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')})`, columns.map((key) => key === 'region_slug' ? regionSlug : record[key]));
}
