import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeRoundComparisons } from '../src/lib/round-comparison.js';

test('comparisons use valid paired answers, withhold small groups and distinguish movement denominator', () => {
  const question = { id: 'p', type: 'single', prompt: 'Likelihood?', options: ['Very low', 'Low', 'Medium', 'High', 'Very high', 'Cannot assess'] };
  const pairs = [[0,4],[1,1],[2,1],[3,5],[5,4]].map(([a,b]) => ({ roundOneAnswers: { p: `p-${a}` }, roundTwoAnswers: { p: `p-${b}` } }));
  const [result] = summarizeRoundComparisons([question], pairs);
  assert.equal(result.totalExperts, 5);
  assert.equal(result.changedPercent, 80);
  assert.deepEqual(result.movement, { compared: 3, increased: 1, decreased: 1, unchanged: 1 });
  assert.equal(result.options[4].changePercentagePoints, 40);
  assert.deepEqual(summarizeRoundComparisons([question], pairs.slice(0,4)), [{ questionId: 'p', prompt: 'Likelihood?', withheld: true }]);
  assert.equal(summarizeRoundComparisons([question], [...pairs.slice(0,4), { roundOneAnswers: { p: 'invalid' }, roundTwoAnswers: { p: 'p-0' } }])[0].withheld, true);
});

test('answer changes do not imply distribution changes or convergence', () => {
  const question = { id: 'c', type: 'single', prompt: 'Priority?', options: ['A', 'B'] };
  const pairs = Array.from({ length: 6 }, (_, i) => ({ roundOneAnswers: { c: `c-${i%2}` }, roundTwoAnswers: { c: `c-${1-i%2}` } }));
  const [result] = summarizeRoundComparisons([question], pairs);
  assert.equal(result.changedPercent, 100);
  assert.ok(result.options.every((option) => option.changePercentagePoints === 0));
  assert.equal(result.movement, null);
});
