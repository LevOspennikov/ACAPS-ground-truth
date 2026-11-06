import { db } from './db.js';

// Never join expert identity fields into answer results.
export async function questionnaireResults(id) {
  const sql = db();
  const [questionnaire] = await sql`SELECT q.*, c.title AS crisis_title FROM questionnaires q JOIN crises c ON c.id = q.crisis_id WHERE q.id = ${id}`;
  if (!questionnaire) return null;
  const [summary, distributions, responses] = await sql.transaction([
    sql`SELECT count(a.id)::int AS assigned, count(r.assignment_id) FILTER (WHERE r.submitted_at IS NULL)::int AS drafts,
      count(r.submitted_at)::int AS submitted FROM assignments a LEFT JOIN responses r ON r.assignment_id = a.id WHERE a.questionnaire_id = ${id}`,
    sql`SELECT entry.key AS question_id, entry.value AS answer, count(*)::int AS total
      FROM responses r JOIN assignments a ON a.id = r.assignment_id CROSS JOIN LATERAL jsonb_each_text(r.answers) entry
      WHERE a.questionnaire_id = ${id} AND r.submitted_at IS NOT NULL
      AND EXISTS(SELECT 1 FROM questionnaires q, jsonb_array_elements(q.questions) question WHERE q.id = ${id} AND question->>'id' = entry.key AND question->>'type' = 'single')
      GROUP BY entry.key, entry.value`,
    sql`SELECT r.answers FROM responses r JOIN assignments a ON a.id = r.assignment_id
      WHERE a.questionnaire_id = ${id} AND r.submitted_at IS NOT NULL ORDER BY r.submitted_at DESC, r.assignment_id LIMIT 100`,
  ]);
  return { questionnaire, summary: summary[0], distributions, responses };
}
