import { neon } from '@neondatabase/serverless';
import { seedDemoData } from '../db/seed-demo.js';

const connectionString = process.env.DATABASE_URL || process.env.STORAGE_DATABASE_URL;
if (!connectionString) throw new Error('Set DATABASE_URL or STORAGE_DATABASE_URL in .env first.');
const sql = neon(connectionString);

const result = await seedDemoData(sql);
if (!result.seeded) {
  console.log('Demo data already present; skipping. Clear experts and questionnaires to reseed.');
} else {
  console.log(`Seeded ${result.experts} anonymous experts, one Afghanistan questionnaire, and ${result.experts} submitted responses.`);
  console.log(`View results at /admin/results/${result.questionnaireId}`);
}
