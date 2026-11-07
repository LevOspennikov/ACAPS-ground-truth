import { db } from './db.js';

// Authorization belongs to the admin endpoint. Opening and snapshotting share
// one statement. Repeated/concurrent starts preserve the first snapshot.
export async function startRoundTwo(id, getSql = db) {
  const [started] = await getSql()`UPDATE questionnaires q SET
    round_one_feedback = CASE WHEN q.round_two_started_at IS NOT NULL
      THEN q.round_one_feedback ELSE (
        SELECT coalesce(jsonb_agg(counts), '[]'::jsonb) FROM (
          SELECT entry.key AS question_id, entry.value AS answer, count(*)::int AS total
          FROM assignments a JOIN responses r ON r.assignment_id = a.id
          CROSS JOIN LATERAL jsonb_each_text(r.answers) entry
          WHERE a.questionnaire_id = q.id AND r.submitted_at IS NOT NULL
            AND EXISTS (SELECT 1 FROM jsonb_array_elements(q.questions) question
              WHERE question->>'id' = entry.key AND question->>'type' = 'single')
          GROUP BY entry.key, entry.value
        ) counts
      ) END,
    round_two_started_at = coalesce(q.round_two_started_at, now()),
    sent_at = coalesce(q.sent_at, now())
    WHERE q.id = ${id} AND jsonb_array_length(q.questions) > 0
      AND EXISTS (SELECT 1 FROM assignments a JOIN responses r ON r.assignment_id = a.id
        WHERE a.questionnaire_id = q.id AND r.submitted_at IS NOT NULL)
    RETURNING id`;
  return Boolean(started);
}
