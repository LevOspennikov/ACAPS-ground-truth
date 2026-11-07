import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGeneratedQuestions, questionSystemPrompt, riskBrief } from '../src/server/green-pt.js';

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
  const questions = parseGeneratedQuestions(`\`\`\`json\n${content}\n\`\`\``);
  assert.equal(questions.length, 6);
  assert.equal(questions[0].type, 'single');
  assert.equal(questions[4].prompt, 'A fifth constraint');
  assert.equal(questions.some((question) => question.prompt === 'This question is past the limit'), false);
  assert.deepEqual(questions.at(-1), { type: 'text', prompt: 'What did we miss?', options: [], placeholder: 'Add anything this questionnaire did not ask' });
  assert.throws(() => parseGeneratedQuestions('{"questions":[{"prompt":"Only one","options":["A","B"]}]}'));
});

test('the generation prompt asks for judgment, not recall', () => {
  assert.match(questionSystemPrompt, /situation evolving/);
  assert.match(questionSystemPrompt, /how likely/);
  assert.match(questionSystemPrompt, /humanitarian consequences/);
  assert.match(questionSystemPrompt, /Do not ask experts to recall/);
});
test('the model brief keeps the risk fields and drops blanks', () => {
  const brief = riskBrief({ risk_id: 'R1', risk_title: 'Flooding', country: 'Afghanistan', rationale: '', source: 'secret' });
  assert.match(brief, /risk_title: Flooding/);
  assert.doesNotMatch(brief, /rationale|secret/);
});
