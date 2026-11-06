import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';
const connectionString = process.env.DATABASE_URL || process.env.STORAGE_DATABASE_URL;
if (!connectionString) throw new Error('Set DATABASE_URL or STORAGE_DATABASE_URL in .env first.');
const sql = neon(connectionString);
const schema = await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8');
const statements = schema.split(';').map((s) => s.trim()).filter(Boolean);
await sql.transaction(statements.map((statement) => sql.query(statement)));
console.log('Database schema ready. Create your first synthetic questionnaire in /admin.');
