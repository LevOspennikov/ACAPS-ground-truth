import { randomUUID } from 'node:crypto';
import { db } from './db.js';
import { hash, token } from './auth.js';
import { coverageEligibility, expertCoverage } from './coverage.js';
import { isUuid } from './ids.js';
import { emailInvitation } from './invitation-email.js';

export const validId = isUuid;
export async function users(search = '') {
  return db()`SELECT e.*, ARRAY(SELECT g.name FROM expert_countries ec JOIN regions g ON g.slug = ec.region_slug WHERE ec.expert_id = e.id ORDER BY g.name) AS countries, count(a.id)::int AS assigned, count(r.submitted_at)::int AS submitted
    FROM experts e LEFT JOIN assignments a ON a.expert_id = e.id LEFT JOIN responses r ON r.assignment_id = a.id
    WHERE e.pseudonym ILIKE ${`%${search}%`} OR coalesce(e.name, '') ILIKE ${`%${search}%`} OR coalesce(e.email, '') ILIKE ${`%${search}%`}
    GROUP BY e.id ORDER BY e.active DESC, e.created_at DESC`;
}
export async function userDetail(id) {
  const sql = db();
  const [user] = await sql`SELECT * FROM experts WHERE id = ${id}`;
  if (!user) return null;
  const assignments = await sql`SELECT a.id, q.title, coalesce(c.title, g.name, 'Questionnaire') AS crisis_title, r.submitted_at, r.updated_at,
    EXISTS(SELECT 1 FROM invitations i WHERE i.assignment_id = a.id AND i.used_at IS NULL AND i.revoked_at IS NULL AND i.expires_at > now()) AS pending_invitation
    FROM assignments a JOIN questionnaires q ON q.id = a.questionnaire_id LEFT JOIN crises c ON c.id = q.crisis_id LEFT JOIN regions g ON g.slug = q.region_slug
    LEFT JOIN responses r ON r.assignment_id = a.id WHERE a.expert_id = ${id} ORDER BY a.created_at DESC`;
  const available = await sql.query(`SELECT q.id, q.title, coalesce(c.title, g.name, 'Questionnaire') AS crisis_title
    FROM questionnaires q LEFT JOIN crises c ON c.id = q.crisis_id LEFT JOIN regions g ON g.slug = q.region_slug
    CROSS JOIN experts e WHERE e.id = $1 AND e.active = true
    AND ((q.region_slug IS NULL AND c.archived = false) OR (q.region_slug IS NOT NULL AND q.sent_at IS NOT NULL AND ${coverageEligibility}))
    AND NOT EXISTS(SELECT 1 FROM assignments a WHERE a.questionnaire_id = q.id AND a.expert_id = e.id) ORDER BY q.created_at DESC`, [id]);
  return { user, assignments, available, coverage: await expertCoverage(id) };

}
export async function assignQuestionnaire(expertId, questionnaireId) {
  const [assignment] = await db().query(`INSERT INTO assignments (id, questionnaire_id, expert_id)
    SELECT $1, q.id, e.id FROM questionnaires q LEFT JOIN crises c ON c.id = q.crisis_id CROSS JOIN experts e
    WHERE q.id = $2 AND e.id = $3 AND e.active = true
    AND ((q.region_slug IS NULL AND c.archived = false) OR (q.region_slug IS NOT NULL AND q.sent_at IS NOT NULL AND ${coverageEligibility}))
    ON CONFLICT (questionnaire_id, expert_id) DO UPDATE SET expert_id = EXCLUDED.expert_id RETURNING id`, [randomUUID(), questionnaireId, expertId]);
  if (!assignment) throw new Error('Choose an active user with matching country and risk coverage, and a published questionnaire.');
  return assignment.id;
}
export async function generateInvitation(assignmentId, origin) {
  const sql = db();
  const invitation = token();
  const result = await sql.transaction([
    sql`SELECT a.id FROM assignments a JOIN experts e ON e.id = a.expert_id WHERE a.id = ${assignmentId} FOR UPDATE OF a, e`,
    sql`UPDATE invitations SET revoked_at = now() WHERE assignment_id = ${assignmentId} AND used_at IS NULL AND revoked_at IS NULL`,
    sql`INSERT INTO invitations (token_hash, assignment_id, expires_at)
      SELECT ${hash(invitation)}, a.id, now() + interval '48 hours' FROM assignments a JOIN experts e ON e.id = a.expert_id
      WHERE a.id = ${assignmentId} AND e.active = true RETURNING assignment_id`,
    sql`SELECT e.profile_mode, e.email, e.active, q.title FROM assignments a
      JOIN experts e ON e.id = a.expert_id JOIN questionnaires q ON q.id = a.questionnaire_id
      WHERE a.id = ${assignmentId}`,
  ]);
  if (!result[2].length) throw new Error('No active user found for this assignment.');
  const expert = result[3][0];
  const emailStatus = await emailInvitation({ expert, token: invitation, title: expert?.title, origin });
  return { token: invitation, emailStatus };
}
export async function setUserActive(id, active) {
  const sql = db();
  const queries = [sql`UPDATE experts SET active = ${active} WHERE id = ${id} RETURNING id`];
  if (!active) queries.push(
    sql`DELETE FROM expert_sessions WHERE assignment_id IN (SELECT id FROM assignments WHERE expert_id = ${id})`,
    sql`UPDATE invitations SET revoked_at = now() WHERE assignment_id IN (SELECT id FROM assignments WHERE expert_id = ${id}) AND used_at IS NULL AND revoked_at IS NULL`,
  );
  const result = await sql.transaction(queries);
  if (!result[0].length) throw new Error('User not found.');
}
