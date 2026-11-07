import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { seedCountryRisks } from './seed-risk-radar.js';
import { seedDemoData } from './seed-demo.js';
import { embeddedSql } from '../src/server/embedded-database.js';

export async function setupEmbedded(database) {
  // Use exactly the application schema rather than a separate mock schema.
  await database.transaction(async (tx) => {
    for (const file of ['schema.sql', 'risk-radar.sql', 'country-risk.sql', 'expert-coverage.sql']) {
      await tx.exec(await readFile(new URL(file, import.meta.url), 'utf8'));
    }
  });
  const sql = embeddedSql(database);
  await seedCountryRisks(sql);
  await seedDemoData(sql);
  const [questionnaire] = await sql`SELECT id FROM questionnaires WHERE risk_id = 'R0353' ORDER BY created_at LIMIT 1`;
  if (!questionnaire) return;
  // Leave the eight peer submissions intact and add one fresh participant.
  await sql.transaction([
    sql`INSERT INTO experts (id, pseudonym, profile_mode)
      SELECT ${randomUUID()}, 'Local Test Expert', 'anonymous'
      WHERE NOT EXISTS (SELECT 1 FROM experts WHERE pseudonym = 'Local Test Expert')`,
    sql`INSERT INTO expert_countries (expert_id, region_slug, risk_scope)
      SELECT id, 'afghanistan', 'all' FROM experts WHERE pseudonym = 'Local Test Expert' ON CONFLICT DO NOTHING`,
    sql`INSERT INTO assignments (id, questionnaire_id, expert_id)
      SELECT ${randomUUID()}, ${questionnaire.id}, id FROM experts WHERE pseudonym = 'Local Test Expert' ON CONFLICT DO NOTHING`,
  ]);
}
