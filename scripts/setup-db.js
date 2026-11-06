import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';
if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL in .env first.');
const sql = neon(process.env.DATABASE_URL);
const schema = await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8');
const statements = schema.split(';').map((s) => s.trim()).filter(Boolean);
await sql.transaction(statements.map((statement) => sql.query(statement)));
console.log('Database schema ready. Create your first synthetic questionnaire in /admin.');
