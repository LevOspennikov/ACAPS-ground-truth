import { randomUUID } from 'node:crypto';
import { db } from './db.js';
import { hash, token } from './auth.js';

export async function createInvitation(questionnaireId, newQuestionnaire) {
  const sql = db();
  const expertId = randomUUID();
  const assignmentId = randomUUID();
  const invitation = token();
  const queries = [];
  if (newQuestionnaire) queries.push(sql`INSERT INTO questionnaires (id, title, context) VALUES (${questionnaireId}, ${newQuestionnaire.title}, ${newQuestionnaire.context})`);
  queries.push(sql`INSERT INTO experts (id, pseudonym) VALUES (${expertId}, ${`Synthetic expert ${expertId.slice(0, 8)}`})`);
  queries.push(sql`INSERT INTO assignments (id, questionnaire_id, expert_id) VALUES (${assignmentId}, ${questionnaireId}, ${expertId})`);
  queries.push(sql`INSERT INTO invitations (token_hash, assignment_id, expires_at) VALUES (${hash(invitation)}, ${assignmentId}, now() + interval '48 hours')`);
  await sql.transaction(queries);
  return invitation;
}
