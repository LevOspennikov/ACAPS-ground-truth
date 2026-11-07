
import { db } from './db.js';

// Never join expert identity fields into answer results.
export async function questionnaireResults(id, getSql = db) {
  const sql = getSql();

  const [questionnaire] = await sql`
    SELECT
      q.*,
      coalesce(c.title, g.name, 'Questionnaire') AS crisis_title
    FROM questionnaires q
    LEFT JOIN crises c ON c.id = q.crisis_id
    LEFT JOIN regions g ON g.slug = q.region_slug
    WHERE q.id = ${id}
  `;

  if (!questionnaire) return null;

  const [summary, distributions, responses, roundTwo] =
    await sql.transaction([
      sql`
        SELECT
          count(a.id)::int AS assigned,
          count(r.assignment_id)
            FILTER (WHERE r.submitted_at IS NULL)::int AS drafts,
          count(r.submitted_at)::int AS submitted
        FROM assignments a
        LEFT JOIN responses r
          ON r.assignment_id = a.id
        WHERE a.questionnaire_id = ${id}
      `,

      sql`
        SELECT
          entry.key AS question_id,
          entry.value AS answer,
          count(*)::int AS total
        FROM responses r
        JOIN assignments a
          ON a.id = r.assignment_id
        CROSS JOIN LATERAL
          jsonb_each_text(r.answers) entry
        WHERE a.questionnaire_id = ${id}
          AND r.submitted_at IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM questionnaires q,
              jsonb_array_elements(q.questions) question
            WHERE q.id = ${id}
              AND question->>'id' = entry.key
              AND question->>'type' = 'single'
          )
        GROUP BY entry.key, entry.value
      `,

      sql`
        SELECT r.answers
        FROM responses r
        JOIN assignments a
          ON a.id = r.assignment_id
        WHERE a.questionnaire_id = ${id}
          AND r.submitted_at IS NOT NULL
        ORDER BY
          r.submitted_at DESC,
          r.assignment_id
        LIMIT 100
      `,
      sql`SELECT count(*)::int AS eligible,
        count(rt.assignment_id) FILTER (WHERE rt.submitted_at IS NULL)::int AS drafts,
        count(rt.submitted_at)::int AS submitted
        FROM assignments a JOIN responses r ON r.assignment_id = a.id AND r.submitted_at IS NOT NULL
        LEFT JOIN round_two_responses rt ON rt.assignment_id = a.id
        WHERE a.questionnaire_id = ${id}`
    ]);

  return {
    questionnaire,
    summary: summary[0],
    distributions,
    responses,
    roundTwo: roundTwo[0],
  };
}

/**
 * Aggregate Round 1 vs Round 2 answer changes.
 *
 * Only experts who submitted both rounds are compared.
 * No expert names, emails, or individual answer pairs
 * are returned.
 *
 * Results are withheld for groups smaller than 5.
 */
export async function roundComparisonSummary(id) {
  const sql = db();

  const rows = await sql`
    SELECT
      entry.key AS question_id,

      count(*)::int AS compared,

      count(*) FILTER (
        WHERE entry.value IS DISTINCT FROM
          (rt.answers ->> entry.key)
      )::int AS changed

    FROM assignments a

    JOIN questionnaires q
      ON q.id = a.questionnaire_id

    JOIN responses r
      ON r.assignment_id = a.id
      AND r.submitted_at IS NOT NULL

    JOIN round_two_responses rt
      ON rt.assignment_id = a.id
      AND rt.submitted_at IS NOT NULL

    CROSS JOIN LATERAL
      jsonb_each_text(r.answers) AS entry(key, value)

    WHERE
      a.questionnaire_id = ${id}

      AND entry.value <> ''

      AND NULLIF(
        rt.answers ->> entry.key,
        ''
      ) IS NOT NULL

      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements(q.questions) question
        WHERE question->>'id' = entry.key
          AND question->>'type' = 'single'
      )

    GROUP BY entry.key
  `;

  return rows.map((row) => {
    const compared = Number(row.compared);
    const changed = Number(row.changed);

    // Protect privacy when fewer than 5
    // paired expert responses are available.
    if (compared < 5) {
      return {
        questionId: row.question_id,
        withheld: true
      };
    }

    return {
      questionId: row.question_id,
      withheld: false,

      compared,
      changed,
      unchanged: compared - changed,

      changedPercent: Math.round(
        (changed / compared) * 100
      )
    };
  });
}
