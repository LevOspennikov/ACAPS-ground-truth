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

export async function expertResults(cookies, { getSql = db, minimum = import.meta.env?.EXPERT_RESULTS_MIN_RESPONSES } = {}) {
  const session = cookies.get('expert')?.value;
  if (!session) return null;
  const threshold = resultsMinimum(minimum);
  const sql = getSql();
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
