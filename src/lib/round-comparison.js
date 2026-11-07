
/**
 * ACAPS Ground Truth
 * Comparative analysis: Round 1 vs Round 2
 *
 * Only compares experts who completed both rounds.
 * Returns aggregate results without expert identities.
 */

function answerIndex(question, answers) {
  return question.options.findIndex(
    (_, index) =>
      answers?.[question.id] === `${question.id}-${index}`
  );
}

function isOrderedPrediction(question) {
  const labels = question.options
    .map((option) => option.trim().toLowerCase());

  const assessable = labels.filter(
    (label) => label !== 'cannot assess'
  );

  const probability = [
    'very low',
    'low',
    'medium',
    'high',
    'very high'
  ];

  if (
    assessable.length === 5 &&
    probability.every((label, i) => assessable[i] === label)
  ) {
    return true;
  }

  return (
    assessable.length === 5 &&
    assessable.every(
      (label, i) => new RegExp(`^${i + 1}\\s*[-–]`).test(label)
    )
  );
}

export function summarizeRoundComparisons(
  questions,
  pairedResponses,
  minimumResponses = 5
) {
  if (
    !Number.isSafeInteger(minimumResponses) ||
    minimumResponses < 1
  ) {
    throw new Error('Invalid comparison threshold.');
  }

  return questions
    .filter(
      (question) =>
        question.type === 'single' &&
        Array.isArray(question.options)
    )
    .map((question) => {

      const validPairs = pairedResponses
        .map((response) => ({
          before: answerIndex(
            question,
            response.roundOneAnswers
          ),
          after: answerIndex(
            question,
            response.roundTwoAnswers
          )
        }))
        .filter(
          (pair) =>
            pair.before >= 0 &&
            pair.after >= 0
        );

      const total = validPairs.length;

      if (total < minimumResponses) {
        return {
          questionId: question.id,
          prompt: question.prompt,
          withheld: true
        };
      }

      const changed = validPairs.filter(
        (pair) => pair.before !== pair.after
      ).length;

      const options = question.options.map((label, index) => {

        const roundOneCount = validPairs.filter(
          (pair) => pair.before === index
        ).length;

        const roundTwoCount = validPairs.filter(
          (pair) => pair.after === index
        ).length;

        const roundOnePercent =
          (roundOneCount / total) * 100;

        const roundTwoPercent =
          (roundTwoCount / total) * 100;

        return {
          label,
          roundOneCount,
          roundTwoCount,
          roundOnePercent:
            Math.round(roundOnePercent * 10) / 10,
          roundTwoPercent:
            Math.round(roundTwoPercent * 10) / 10,
          changePercentagePoints:
            Math.round(
              (roundTwoPercent - roundOnePercent) * 10
            ) / 10
        };
      });

      let movement = null;

      if (isOrderedPrediction(question)) {
        const assessed = validPairs.filter(
          (pair) =>
            question.options[pair.before]
              .trim().toLowerCase() !== 'cannot assess' &&
            question.options[pair.after]
              .trim().toLowerCase() !== 'cannot assess'
        );

        movement = {
          compared: assessed.length,
          increased: assessed.filter(
            (pair) => pair.after > pair.before
          ).length,
          decreased: assessed.filter(
            (pair) => pair.after < pair.before
          ).length,
          unchanged: assessed.filter(
            (pair) => pair.after === pair.before
          ).length
        };
      }

      return {
        questionId: question.id,
        prompt: question.prompt,
        withheld: false,
        totalExperts: total,
        changed,
        unchanged: total - changed,
        changedPercent:
          Math.round((changed / total) * 100),
        options,
        movement
      };
    });
}