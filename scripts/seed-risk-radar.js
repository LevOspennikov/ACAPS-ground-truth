import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';
import { riskRadarSeedQueries } from '../db/seed-risk-radar.js';

// Production is bootstrapped explicitly at build time, never on a page GET.
if (process.env.VERCEL === '1' && process.env.VERCEL_ENV === 'production') {
  const connection = process.env.DATABASE_URL || process.env.STORAGE_DATABASE_URL;
  if (!connection) throw new Error('Risk radar import requires a Neon database connection.');
  const sql = neon(connection);
  const schema = await readFile(new URL('../db/risk-radar.sql', import.meta.url), 'utf8');
  await sql.transaction([sql.query(schema), ...riskRadarSeedQueries(sql)]);
  console.log('Risk radar table ready; first ten CSV records seeded without overwriting existing IDs.');
} else {
  console.log('Risk radar production import skipped for local/preview build. Use db:setup for a development database.');
}
