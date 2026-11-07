import { randomUUID } from 'node:crypto';
import { db } from './db.js';
import { hash, token } from './auth.js';
import { isUuid } from './ids.js';
import { coverageEligibility } from './coverage.js';

export async function inviteQuestionnaireRecipients(slug, questionnaireId, expertIds) {
  const ids = [...new Set(expertIds)];
  if (!ids.length || ids.length > 50 || ids.some((id) => typeof id !== 'string' || !isUuid(id))) throw new Error('Choose between 1 and 50 recipients.');
  const sql = db();
  const invitations = ids.map((id) => ({ id, token: token() }));
  const queries = [
    sql`SELECT id FROM questionnaires WHERE id = ${questionnaireId}::uuid AND region_slug = ${slug} FOR UPDATE`,
    sql`SELECT id FROM experts WHERE id = ANY(${ids}::uuid[]) ORDER BY id FOR UPDATE`,
    // Invalid selections abort the transaction before any assignment or token is changed.
    sql.query(`SELECT 1 / CASE WHEN (
      SELECT count(*) FROM experts e CROSS JOIN questionnaires q
      WHERE q.id = $1::uuid AND q.region_slug = $2 AND e.id = ANY($3::uuid[]) AND e.active = true
      AND (${coverageEligibility} OR EXISTS (SELECT 1 FROM assignments a WHERE a.expert_id = e.id AND a.questionnaire_id = q.id))
      AND (q.sent_at IS NOT NULL OR jsonb_array_length(q.questions) > 0)
    ) = $4 THEN 1 ELSE 0 END AS valid`, [questionnaireId, slug, ids, ids.length]),
    sql`UPDATE questionnaires q SET sent_at = now() WHERE q.id = ${questionnaireId}::uuid AND q.region_slug = ${slug} AND q.sent_at IS NULL`,
    ...ids.map((id) => sql`INSERT INTO assignments (id, questionnaire_id, expert_id) VALUES (${randomUUID()}, ${questionnaireId}::uuid, ${id}::uuid) ON CONFLICT (questionnaire_id, expert_id) DO NOTHING`),
    ...ids.map((id) => sql`UPDATE invitations SET revoked_at = now() WHERE used_at IS NULL AND revoked_at IS NULL AND assignment_id IN (SELECT id FROM assignments WHERE questionnaire_id = ${questionnaireId}::uuid AND expert_id = ${id}::uuid)`),
    ...invitations.map((invitation) => sql`INSERT INTO invitations (token_hash, assignment_id, expires_at)
      SELECT ${hash(invitation.token)}, a.id, now() + interval '48 hours' FROM assignments a
      WHERE a.questionnaire_id = ${questionnaireId}::uuid AND a.expert_id = ${invitation.id}::uuid RETURNING assignment_id`),
  ];
  try { await sql.transaction(queries); }
  catch (error) {
    if (error.code === '22012') throw new Error('Recipients are no longer eligible, or the questionnaire has no questions. Refresh the questionnaire and try again.');
    throw new Error('Could not create invitations. Nothing was saved; please retry.');
  }
  return invitations;
}
