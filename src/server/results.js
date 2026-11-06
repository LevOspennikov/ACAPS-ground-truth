import { db } from './db.js';

// Called only after admin authorization. Do not join expert identities here.
export async function questionnaireResults(id) {
  const sql = db();
  const [questionnaire] = await sql`SELECT id, title, context FROM questionnaires WHERE id = ${id}`;
  if (!questionnaire) return null;

  const [summary, distribution, responses] = await sql.transaction([
    sql`SELECT count(a.id)::int AS assigned,
      count(r.assignment_id) FILTER (WHERE r.submitted_at IS NULL)::int AS drafts,
      count(r.submitted_at)::int AS submitted,
      round(avg(r.likelihood) FILTER (WHERE r.submitted_at IS NOT NULL), 1) AS likelihood,
      round(avg(r.confidence) FILTER (WHERE r.submitted_at IS NOT NULL), 1) AS confidence
      FROM assignments a LEFT JOIN responses r ON r.assignment_id = a.id
      WHERE a.questionnaire_id = ${id}`,
    sql`SELECT r.likelihood, count(*)::int AS total FROM responses r
      JOIN assignments a ON a.id = r.assignment_id
      WHERE a.questionnaire_id = ${id} AND r.submitted_at IS NOT NULL
      GROUP BY r.likelihood ORDER BY r.likelihood`,
    sql`SELECT r.likelihood, r.confidence, r.context FROM responses r
      JOIN assignments a ON a.id = r.assignment_id
      WHERE a.questionnaire_id = ${id} AND r.submitted_at IS NOT NULL
      ORDER BY r.submitted_at DESC, r.assignment_id LIMIT 100`,
  ]);

  return { questionnaire, summary: summary[0], distribution, responses };
}
