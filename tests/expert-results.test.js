import test from 'node:test';
import assert from 'node:assert/strict';
import { expertDistributions, expertResults, resultsMinimum } from '../src/server/expert-results.js';
import { hash, invitationMatchesSession } from '../src/server/auth.js';
import { resultsMarkup } from '../src/lib/expert-results-view.js';

const questions = [
  { id: 'q1', type: 'single', prompt: 'Risk?', options: ['Low', 'Medium', 'High'], privateMetadata: 'PRIVATE' },
  { id: 'q2', type: 'single', prompt: 'Optional?', options: ['Yes', 'No'], required: false },
  { id: 'q3', type: 'text', prompt: 'PRIVATE TEXT PROMPT' },
];
const distributions = [
  { question_id: 'q1', answer: 'q1-0', total: 3 },
  { question_id: 'q1', answer: 'q1-2', total: 1 },
  { question_id: 'q2', answer: 'q2-1', total: 1 },
  { question_id: 'q3', answer: 'PRIVATE WRITTEN ANSWER', total: 1 },
  { question_id: 'q1', answer: 'invalid-option', total: 90 },
];
const cookies = (value) => ({ get: () => value ? { value } : undefined });

test('threshold defaults to zero and rejects invalid configuration', () => {
  assert.equal(resultsMinimum(undefined), 0);
  assert.equal(resultsMinimum('0'), 0);
  assert.equal(resultsMinimum('5'), 5);
  for (const value of ['', '-1', '1.5', 'NaN', ' 5 ', 'Infinity', '9007199254740992']) {
    assert.throws(() => resultsMinimum(value), /EXPERT_RESULTS_MIN_RESPONSES/);
  }
});

test('distributions use each question’s answer count and include zero-count options', () => {
  const result = expertDistributions(questions, distributions, 0);
  assert.equal(result.length, 2);
  assert.equal(result[0].total, 4);
  assert.deepEqual(result[0].options, [
    { label: 'Low', count: 3, percent: 75 },
    { label: 'Medium', count: 0, percent: 0 },
    { label: 'High', count: 1, percent: 25 },
  ]);
  assert.equal(result[1].total, 1);
  assert.equal(result[1].options[1].percent, 100);
  assert.ok(!JSON.stringify(result).includes('PRIVATE'));
});

test('withholding is per question, includes the exact threshold, and returns no hidden counts', () => {
  const result = expertDistributions(questions, distributions, 4);
  assert.equal(result[0].withheld, false);
  assert.deepEqual(result[1], { id: 'q2', prompt: 'Optional?', withheld: true });
  assert.deepEqual(expertDistributions(questions, distributions, 5)[0], { id: 'q1', prompt: 'Risk?', withheld: true });
});

test('zero threshold shows empty questions without NaN percentages or empty pie charts', () => {
  const result = expertDistributions(questions, [], 0);
  assert.equal(result[0].total, 0);
  assert.ok(result[0].options.every((option) => option.count === 0 && option.percent === 0));
  assert.match(resultsMarkup(result), /No answers yet/);
  assert.ok(!resultsMarkup(result).includes('result-pie'));
  assert.match(resultsMarkup(expertDistributions(questions, [], 1)), /once enough experts/);
});

test('rendered charts have accessible labels, all answer options, and escape question and answer text', () => {
  const result = expertDistributions([{ ...questions[0], prompt: '<script>bad()</script>', options: ['<img onerror="bad()">', 'Safe', 'Other'] }], distributions, 0);
  const html = resultsMarkup(result);
  assert.match(html, /role="img" aria-label=/);
  assert.match(html, /0 · 0%/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&lt;img onerror=&quot;bad\(\)&quot;&gt;/);
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('<img'));
});

test('missing session avoids database access and denies results', async () => {
  assert.equal(await expertResults(cookies(), { getSql: () => assert.fail('No session') }), null);
});

test('database-authorized results expose only the aggregate allowlist and use a hashed session', async () => {
  let parameters;
  const getSql = () => async (_strings, ...values) => {
    parameters = values;
    return [{ questions, distributions, name: 'PRIVATE', responses: [{ answers: 'PRIVATE' }] }];
  };
  const result = await expertResults(cookies('session-secret'), { getSql, minimum: '0' });
  assert.deepEqual(parameters, [hash('session-secret')]);
  assert.deepEqual(Object.keys(result), ['questions', 'updatedAt']);
  assert.ok(!JSON.stringify(result).includes('PRIVATE'));
  assert.ok(Number.isFinite(Date.parse(result.updatedAt)));
  assert.equal(await expertResults(cookies('invalid-session'), { getSql: () => async () => [] }), null);
});

test('invalid threshold fails closed before requesting any distributions', async () => {
  await assert.rejects(expertResults(cookies('session'), { minimum: '-1', getSql: () => assert.fail('Invalid config') }), /EXPERT_RESULTS_MIN_RESPONSES/);
});

test('return links require an existing matching session and do not return credentials', async () => {
  const invitation = 'a'.repeat(64);
  const noQuery = () => assert.fail('No valid session or token');
  assert.equal(await invitationMatchesSession(cookies(), invitation, noQuery), false);
  assert.equal(await invitationMatchesSession(cookies('session'), 'bad-token', noQuery), false);
  let parameters;
  assert.equal(await invitationMatchesSession(cookies('session'), invitation, () => async (_strings, ...values) => {
    parameters = values;
    return [{ '?column?': 1 }];
  }), true);
  assert.deepEqual(parameters, [hash('session'), hash(invitation)]);
  assert.equal(await invitationMatchesSession(cookies('unrelated-or-expired-session'), invitation, () => async () => []), false);
});
