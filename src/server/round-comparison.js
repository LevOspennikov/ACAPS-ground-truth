
import { db } from './db.js';

import {
  summarizeRoundComparisons
} from '../lib/round-comparison.js';

/**
 * Retrieve paired Round 1 and Round 2 responses.
 *
 * Only experts who submitted both rounds are included.
 * Return aggregated comparisons, not individual responses.
 *
 * This function must only be called from an
 * authenticated administrator page.
 */
export async function loadRoundComparison(questionnaireId) {
  const sql = db();

  // Retrieve questionnaire questions.
  const [questionnaire] = await sql`
    SELECT questions
    FROM questionnaires
    WHERE id = ${questionnaireId}
  `;

  if (!questionnaire) return null;

  // Retrieve only completed responses from both rounds.
  const pairedResponses = await sql`
    SELECT
      r.answers AS round_one_answers,
      rt.answers AS round_two_answers

    FROM assignments a

    JOIN responses r
      ON r.assignment_id = a.id
      AND r.submitted_at IS NOT NULL

    JOIN round_two_responses rt
      ON rt.assignment_id = a.id
      AND rt.submitted_at IS NOT NULL

    WHERE a.questionnaire_id = ${questionnaireId}
  `;

  // Convert individual pairs to aggregate statistics.
  // Individual answer pairs must never be sent to the browser.
  const comparisons = summarizeRoundComparisons(
    questionnaire.questions,
    pairedResponses.map((response) => ({
      roundOneAnswers: response.round_one_answers,
      roundTwoAnswers: response.round_two_answers
    })),
    5
  );

  return {
    questionnaireId,
    comparisons
  };
}
