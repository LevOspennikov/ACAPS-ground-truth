import { db } from './db.js';
import { hash } from './auth.js';
export async function saveResponse(cookies, assignmentId, answers, step, submit) {
  const session = cookies.get('expert')?.value;
  if (!session) return false;
  const [saved] = await db()`INSERT INTO responses (assignment_id, answers, progress_step, submitted_at)
    SELECT a.id, ${JSON.stringify(answers)}::jsonb, ${step}, CASE WHEN ${submit} THEN now() ELSE NULL END
    FROM assignments a JOIN experts e ON e.id = a.expert_id JOIN expert_sessions s ON s.assignment_id = a.id
    WHERE a.id = ${assignmentId} AND e.active = true AND s.token_hash = ${hash(session)} AND s.expires_at > now()
    ON CONFLICT (assignment_id) DO UPDATE SET answers = EXCLUDED.answers, progress_step = EXCLUDED.progress_step,
      updated_at = now(), submitted_at = EXCLUDED.submitted_at
    WHERE responses.submitted_at IS NULL RETURNING assignment_id`;
  return Boolean(saved);
}
