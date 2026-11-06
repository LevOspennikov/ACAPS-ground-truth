import { randomUUID } from 'node:crypto';
import { db } from './db.js';
import { hash, token } from './auth.js';
import template from '../data/questions.js';
import { validateQuestions } from './answers.js';

export const validId = (id) => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
export async function categories() { return db()`SELECT * FROM categories ORDER BY archived, lower(name)`; }
export async function users(search = '') {
  return db()`SELECT e.*, count(a.id)::int AS assigned, count(r.submitted_at)::int AS submitted
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
  const available = await sql`SELECT q.id, q.title, coalesce(c.title, g.name, 'Questionnaire') AS crisis_title FROM questionnaires q LEFT JOIN crises c ON c.id = q.crisis_id LEFT JOIN regions g ON g.slug = q.region_slug
    WHERE (c.archived = false OR (q.crisis_id IS NULL AND q.sent_at IS NOT NULL)) AND NOT EXISTS(SELECT 1 FROM assignments a WHERE a.questionnaire_id = q.id AND a.expert_id = ${id}) ORDER BY q.created_at DESC`;
  return { user, assignments, available };
}
export async function crises(category = '', status = 'active') {
  return db()`SELECT c.*, k.name AS category_name, count(q.id)::int AS questionnaires
    FROM crises c JOIN categories k ON k.id = c.category_id LEFT JOIN questionnaires q ON q.crisis_id = c.id
    WHERE (${category} = '' OR c.category_id::text = ${category}) AND (${status} = 'all' OR c.archived = ${status === 'archived'})
    GROUP BY c.id, k.name ORDER BY c.created_at DESC`;
}
export async function crisisDetail(id) {
  const sql = db();
  const [crisis] = await sql`SELECT c.*, k.name AS category_name FROM crises c JOIN categories k ON k.id = c.category_id WHERE c.id = ${id}`;
  if (!crisis) return null;
  const questionnaires = await sql`SELECT q.id, q.title, count(a.id)::int AS assigned, count(r.submitted_at)::int AS submitted
    FROM questionnaires q LEFT JOIN assignments a ON a.questionnaire_id = q.id LEFT JOIN responses r ON r.assignment_id = a.id
    WHERE q.crisis_id = ${id} GROUP BY q.id ORDER BY q.created_at DESC`;
  return { crisis, questionnaires };
}
export async function createQuestionnaire(crisisId, title, context) {
  const questions = validateQuestions(template);
  const [created] = await db()`INSERT INTO questionnaires (id, crisis_id, title, context, questions)
    SELECT ${randomUUID()}, id, ${title}, ${context}, ${JSON.stringify(questions)}::jsonb FROM crises WHERE id = ${crisisId} AND archived = false RETURNING id`;
  if (!created) throw new Error('Choose an active crisis.');
  return created.id;
}
export async function assignQuestionnaire(expertId, questionnaireId) {
  const [assignment] = await db()`INSERT INTO assignments (id, questionnaire_id, expert_id)
    SELECT ${randomUUID()}, q.id, e.id FROM questionnaires q LEFT JOIN crises c ON c.id = q.crisis_id CROSS JOIN experts e
    WHERE q.id = ${questionnaireId} AND e.id = ${expertId} AND e.active = true AND (c.archived = false OR (q.crisis_id IS NULL AND q.sent_at IS NOT NULL))
    ON CONFLICT (questionnaire_id, expert_id) DO UPDATE SET expert_id = EXCLUDED.expert_id RETURNING id`;
  if (!assignment) throw new Error('Choose an active user and a questionnaire in an active crisis.');
  return assignment.id;
}
export async function generateInvitation(assignmentId) {
  const sql = db();
  const invitation = token();
  const result = await sql.transaction([
    sql`SELECT a.id FROM assignments a JOIN experts e ON e.id = a.expert_id WHERE a.id = ${assignmentId} FOR UPDATE OF a, e`,
    sql`UPDATE invitations SET revoked_at = now() WHERE assignment_id = ${assignmentId} AND used_at IS NULL AND revoked_at IS NULL`,
    sql`INSERT INTO invitations (token_hash, assignment_id, expires_at)
      SELECT ${hash(invitation)}, a.id, now() + interval '48 hours' FROM assignments a JOIN experts e ON e.id = a.expert_id
      WHERE a.id = ${assignmentId} AND e.active = true RETURNING assignment_id`,
  ]);
  if (!result[2].length) throw new Error('No active user found for this assignment.');
  return invitation;
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
