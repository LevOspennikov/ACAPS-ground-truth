import test from 'node:test';
import assert from 'node:assert/strict';
import { generateRiskQuestions, parseGeneratedQuestions, riskBrief } from '../src/server/green-pt.js';

test('generated questions stay between three and five and end with the free-text prompt', () => {
  const content = JSON.stringify({ questions: [
    { prompt: 'How exposed are households?', options: ['Limited', 'Widespread'] },
    { prompt: 'Which access constraint comes first?', options: ['Roads', 'Markets', 'Clinics'] },
    { prompt: 'What did we miss?', options: ['Nothing'] },
    { prompt: 'Is the stated probability credible?', options: ['Yes', 'No'] },
    { prompt: '  ' },
    { prompt: 'A further constraint', options: ['Fuel', 'Staff'] },
    { prompt: 'A fifth constraint', options: ['A', 'B'] },
    { prompt: 'This question is past the limit', options: ['A', 'B'] },
  ]});
  const questions = parseGeneratedQuestions(`The outlook uses {months}.\n\`\`\`json\n${content}\n\`\`\``);
  assert.equal(questions.length, 6);
  assert.equal(questions[0].type, 'single');
  assert.equal(questions[4].prompt, 'A fifth constraint');
  assert.equal(questions.some((question) => question.prompt === 'This question is past the limit'), false);
  assert.deepEqual(questions.at(-1), { type: 'text', prompt: 'What did we miss?', options: [], placeholder: 'Add anything this questionnaire did not ask' });
  assert.throws(() => parseGeneratedQuestions('{"questions":[{"prompt":"Only one","options":["A","B"]}]}'));
});

test('the model brief keeps the risk fields and drops blanks', () => {
  const brief = riskBrief({ risk_id: 'R1', risk_title: 'Flooding', country: 'Afghanistan', rationale: '', source: 'secret' });
  assert.match(brief, /risk_title: Flooding/);
  assert.doesNotMatch(brief, /rationale|secret/);
});

function restoreApiKey(t) {
  const original = process.env.GREEN_PT_API_KEY;
  t.after(() => {
    if (original === undefined) delete process.env.GREEN_PT_API_KEY;
    else process.env.GREEN_PT_API_KEY = original;
  });
}

test('missing GreenPT configuration yields an empty questionnaire without fetching', async (t) => {
  restoreApiKey(t);
  delete process.env.GREEN_PT_API_KEY;
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('Must not fetch'); });
  assert.deepEqual(await generateRiskQuestions({ risk_id: 'R1' }), []);
  assert.equal(fetch.mock.callCount(), 0);
});

test('GreenPT failures yield an empty questionnaire for manual editing', async (t) => {
  restoreApiKey(t);
  process.env.GREEN_PT_API_KEY = 'synthetic-test-key';
  const failures = [
    ['provider rejection', async () => new Response('', { status: 503 })],
    ['network failure', async () => { throw new TypeError('Network error'); }],
    ['timeout', async () => { throw new DOMException('Timed out', 'TimeoutError'); }],
    ['invalid response JSON', async () => new Response('invalid json')],
    ['missing message', async () => Response.json({ choices: [] })],
    ['invalid questions', async () => Response.json({ choices: [{ message: { content: '{"questions":[]}' } }] })],
  ];
  for (const [name, fetch] of failures) {
    await t.test(name, async (t) => {
      const mocked = t.mock.method(globalThis, 'fetch', fetch);
      assert.deepEqual(await generateRiskQuestions({ risk_id: 'R1' }), []);
      assert.equal(mocked.mock.callCount(), 1);
    });
  }
});

test('successful GreenPT drafting preserves generated questions and the context prompt', async (t) => {
  restoreApiKey(t);
  process.env.GREEN_PT_API_KEY = 'synthetic-test-key';
  const questions = ['First assessment?', 'Likelihood?', 'Impact?'].map((prompt) => ({ prompt, options: ['Low', 'High'] }));
  t.mock.method(globalThis, 'fetch', async () => Response.json({ choices: [{ message: { content: JSON.stringify({ questions }) } }] }));
  const generated = await generateRiskQuestions({ risk_id: 'R1' });
  assert.equal(generated.length, 4);
  assert.equal(generated[0].prompt, 'First assessment?');
  assert.deepEqual(generated[0].options, ['Low', 'High']);
  assert.equal(generated.at(-1).prompt, 'What did we miss?');
});
