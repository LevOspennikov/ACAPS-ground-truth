import test from 'node:test';
import assert from 'node:assert/strict';
import { demoQuestionnaire, demoQuestions, demoExperts, buildAnswers } from '../src/data/demo.js';
import { validateQuestions } from '../src/server/answers.js';
import { countrySlug } from '../src/data/countries.js';

test('demo questionnaire targets the Afghanistan R0353 risk', () => {
  assert.equal(demoQuestionnaire.country, 'Afghanistan');
  assert.equal(countrySlug(demoQuestionnaire.country), 'afghanistan');
  assert.equal(demoQuestionnaire.riskId, 'R0353');
  assert.ok(demoQuestionnaire.title.includes('Taliban'));
});

test('demo questions pass the same validation as real templates', () => {
  assert.equal(validateQuestions(demoQuestions), demoQuestions);
  assert.equal(demoQuestions.length, 6);
  assert.equal(demoQuestions.filter((q) => q.type === 'single').length, 5);
  assert.equal(demoQuestions[demoQuestions.length - 1].type, 'text');
});

test('fake answers use valid single-choice encodings and non-empty text', () => {
  assert.equal(demoExperts.length, 8);
  for (const expert of demoExperts) {
    const answers = buildAnswers(demoQuestions, expert);
    for (const question of demoQuestions) {
      assert.ok(question.id in answers, `${question.id} answered`);
      if (question.type === 'single') {
        assert.match(answers[question.id], /^[a-z0-9-]+-\d+$/);
        const index = Number(answers[question.id].split('-').pop());
        assert.ok(index >= 0 && index < question.options.length, `${question.id} index in range`);
      } else {
        assert.equal(typeof answers[question.id], 'string');
        assert.ok(answers[question.id].trim().length > 0);
      }
    }
  }
});
