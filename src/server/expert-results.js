import { db } from './db.js';
import { hash } from './auth.js';

export function resultsMinimum(value) {
  if (value === undefined) return 0;
  if (!/^\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value))) {
    throw Object.assign(new Error('EXPERT_RESULTS_MIN_RESPONSES must be a nonnegative integer.'), { code: 'invalid_results_configuration' });
  }
  return Number(value);
}

// Explicit allowlist: never return stored response objects or arbitrary question metadata.
export function expertDistributions(questions, distributions, minimum) {
  return questions.filter((question) => question.type === 'single').map((question) => {
    const options = question.options.map((label, index) => ({
      label,
      count: Number(distributions.find((row) => row.question_id === question.id && row.answer === `${question.id}-${index}`)?.total || 0),
    }));
    const total = options.reduce((sum, option) => sum + option.count, 0);
    if (total < minimum) return { id: question.id, prompt: question.prompt, withheld: true };
    return {
      id: question.id, prompt: question.prompt, withheld: false, total,
      options: options.map((option) => ({ ...option, percent: total ? Math.round(option.count / total * 100) : 0 })),
    };
  });
}

export async function expertResults(cookies, { getSql = db, minimum = import.meta.env?.EXPERT_RESULTS_MIN_RESPONSES, questionId = null, frozen = false, roundTwo = false } = {}) {
  const session = cookies.get('expert')?.value;
  if (!session) return null;
  const threshold = resultsMinimum(minimum);
  const sql = getSql();
  if (roundTwo) {
    // Revised group results become visible only after this expert submits Round
    // 2. Limit both questions and aggregates to the chosen question on the server.
    if (!questionId || frozen) return null;
    const [result] = await sql`SELECT
      (SELECT coalesce(jsonb_agg(question), '[]'::jsonb)
        FROM jsonb_array_elements(q.questions) question
        WHERE question->>'id' = ${questionId} AND question->>'type' = 'single') AS questions,
      coalesce((SELECT jsonb_agg(counts) FROM (
        SELECT entry.key AS question_id, entry.value AS answer, count(*)::int AS total
        FROM assignments peer JOIN round_two_responses revised ON revised.assignment_id = peer.id
        CROSS JOIN LATERAL jsonb_each_text(revised.answers) entry
        WHERE peer.questionnaire_id = q.id AND revised.submitted_at IS NOT NULL
          AND entry.key = ${questionId}
          AND EXISTS (SELECT 1 FROM jsonb_array_elements(q.questions) question
            WHERE question->>'id' = entry.key AND question->>'type' = 'single')
        GROUP BY entry.key, entry.value
      ) counts), '[]'::jsonb) AS distributions
      FROM expert_sessions s JOIN assignments a ON a.id = s.assignment_id
      JOIN experts e ON e.id = a.expert_id JOIN questionnaires q ON q.id = a.questionnaire_id
      JOIN responses original ON original.assignment_id = a.id AND original.submitted_at IS NOT NULL
      JOIN round_two_responses own ON own.assignment_id = a.id AND own.submitted_at IS NOT NULL
      WHERE s.token_hash = ${hash(session)} AND s.expires_at > now() AND e.active = true
        AND q.round_two_started_at IS NOT NULL`;
    if (!result) return null;
    return { questions: expertDistributions(result.questions, result.distributions, threshold), updatedAt: new Date().toISOString() };
  }
  if (frozen) {
    // Reassessment never retrieves all-question feedback. Both the prompt and
    // distribution are selected by ID under the same assignment authorization.
    if (!questionId) return null;
    const [result] = await sql`SELECT
      (SELECT coalesce(jsonb_agg(question), '[]'::jsonb)
        FROM jsonb_array_elements(q.questions) question
        WHERE question->>'id' = ${questionId} AND question->>'type' = 'single') AS questions,
      (SELECT coalesce(jsonb_agg(counts), '[]'::jsonb)
        FROM jsonb_array_elements(q.round_one_feedback) counts
        WHERE counts->>'question_id' = ${questionId}) AS distributions,
      q.round_two_started_at AS captured_at
      FROM expert_sessions s JOIN assignments a ON a.id = s.assignment_id
      JOIN experts e ON e.id = a.expert_id JOIN questionnaires q ON q.id = a.questionnaire_id
      JOIN responses own ON own.assignment_id = a.id AND own.submitted_at IS NOT NULL
      WHERE s.token_hash = ${hash(session)} AND s.expires_at > now() AND e.active = true
        AND q.round_two_started_at IS NOT NULL`;
    if (!result) return null;
    return {
      questions: expertDistributions(result.questions, result.distributions, threshold),
      updatedAt: new Date(result.captured_at).toISOString(),
    };
  }
  // Authorization and aggregation share one statement/snapshot. The caller cannot
  // choose a questionnaire, and no individual answers leave the database.
  const [result] = await sql`SELECT q.questions, coalesce((
    SELECT jsonb_agg(counts) FROM (
      SELECT entry.key AS question_id, entry.value AS answer, count(*)::int AS total
      FROM assignments peer JOIN responses r ON r.assignment_id = peer.id
      CROSS JOIN LATERAL jsonb_each_text(r.answers) entry
      WHERE peer.questionnaire_id = q.id AND r.submitted_at IS NOT NULL
      AND EXISTS (SELECT 1 FROM jsonb_array_elements(q.questions) question
        WHERE question->>'id' = entry.key AND question->>'type' = 'single')
      GROUP BY entry.key, entry.value
    ) counts
  ), '[]'::jsonb) AS distributions
  FROM expert_sessions s JOIN assignments a ON a.id = s.assignment_id
  JOIN experts e ON e.id = a.expert_id JOIN questionnaires q ON q.id = a.questionnaire_id
  JOIN responses own ON own.assignment_id = a.id AND own.submitted_at IS NOT NULL
  WHERE s.token_hash = ${hash(session)} AND s.expires_at > now() AND e.active = true`;
  if (!result) return null;
  return { questions: expertDistributions(result.questions, result.distributions, threshold), updatedAt: new Date().toISOString() };
}
