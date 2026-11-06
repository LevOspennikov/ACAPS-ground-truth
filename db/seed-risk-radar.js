import firstTen from './seeds/risk-radar.json' with { type: 'json' };
import additional from './seeds/risk-radar-additional.json' with { type: 'json' };
import { riskRadarFields } from '../src/data/risk-radar-fields.js';
import { countrySlug } from '../src/data/countries.js';

export const riskRadarSeedRows = [
  ...firstTen.map((record, index) => ({ record, sourceRow: index + 1 })),
  ...additional,
];

export function riskRadarSeedQueries(sql) {
  if (riskRadarSeedRows.length !== 12 || new Set(riskRadarSeedRows.map(({record}) => record['Risk ID'])).size !== 12) throw new Error('Expected twelve distinct risk radar seed records.');
  const columns = [...riskRadarFields.map((field) => field.key), 'source_row', 'region_slug'];
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  return riskRadarSeedRows.map(({ record, sourceRow }) => {
    if (riskRadarFields.some((field) => typeof record[field.label] !== 'string')) throw new Error('CSV seed is missing a field.');
    const values = [...riskRadarFields.map((field) => record[field.label]), sourceRow, countrySlug(record.Country)];
    return sql.query(`INSERT INTO risk_radar (${columns.join(', ')}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`, values);
  });
}

// Existing manual risks also become countries; seeding never relabels or deletes them.
export async function seedCountryRisks(sql) {
  const existing = await sql.query('SELECT DISTINCT country FROM risk_radar');
  const countries = [...new Set([...riskRadarSeedRows.map(({record}) => record.Country), ...existing.map((row) => row.country)])];
  await sql.transaction([
    ...countries.map((country) => sql.query('INSERT INTO regions (slug, name) VALUES ($1, $2) ON CONFLICT (slug) DO NOTHING', [countrySlug(country), country.trim()])),
    ...riskRadarSeedQueries(sql),
    ...countries.map((country) => sql.query('UPDATE risk_radar SET region_slug = $1 WHERE country = $2 AND region_slug IS NULL', [countrySlug(country), country])),
  ]);
}
