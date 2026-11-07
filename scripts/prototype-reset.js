import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';

export function shouldResetDatabase(env) {
  return env.RESET_DATABASE_ON_DEPLOY === 'true'
    && env.VERCEL === '1'
    && env.VERCEL_ENV === 'production';
}

export async function resetPrototypeDatabase(env) {
  const connectionString = env.DATABASE_URL || env.STORAGE_DATABASE_URL;
  if (!connectionString) throw new Error('Database reset requires DATABASE_URL or STORAGE_DATABASE_URL.');
  const sql = neon(connectionString);
  const schema = await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8');
  const statements = schema.split(';').map((statement) => statement.trim()).filter(Boolean);

  // One transaction: a failed schema update rolls back the drops as well.
  // No CASCADE: unrelated tables and Neon-managed schemas must remain intact.
  await sql.transaction([

sql.query('DROP TABLE IF EXISTS expert_risks, expert_countries, round_two_responses, responses, expert_sessions, invitations, assignments, experts, questionnaires, questionnaire_answers, questions, reports, regions, risk_radar, crises, categories'),

    ...statements.map((statement) => sql.query(statement)),
  ]);
}
