import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';
import { seedCountryRisks } from '../db/seed-risk-radar.js';
import { seedDemoData } from '../db/seed-demo.js';

// Production is bootstrapped explicitly at build time, never on a page GET.
if (process.env.VERCEL === '1' && process.env.VERCEL_ENV === 'production') {
  const connection = process.env.DATABASE_URL || process.env.STORAGE_DATABASE_URL;
  if (!connection) throw new Error('Risk radar import requires a Neon database connection.');
  const sql = neon(connection);
  const schema = await readFile(new URL('../db/risk-radar.sql', import.meta.url), 'utf8');
  const baseSchema = await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8');
  const coverage = await readFile(new URL('../db/expert-coverage.sql', import.meta.url), 'utf8');
  const links = await readFile(new URL('../db/country-risk.sql', import.meta.url), 'utf8');
  const statements = [...baseSchema.split(';'), schema, ...links.split(';'), ...coverage.split(';')].map((s) => s.trim()).filter(Boolean);
  await sql.transaction(statements.map((s) => sql.query(s)));
  await seedCountryRisks(sql);
  const demo = await seedDemoData(sql);
  console.log('Risk radar table ready; twelve CSV records and their country regions seeded without overwriting existing IDs.');
  if (demo.seeded) console.log(`Seeded ${demo.experts} demo experts and one Afghanistan questionnaire with submitted responses.`);
} else {
  console.log('Risk radar production import skipped for local/preview build. Use db:setup for a development database.');
}
