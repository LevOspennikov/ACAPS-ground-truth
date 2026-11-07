import test from 'node:test';
import assert from 'node:assert/strict';
import { seedDemoData } from '../db/seed-demo.js';

function mockSql({ experts, questionnaires }) {
  const calls = [];
  const fn = (strings, ...values) => {
    const text = strings[0];
    const call = { text, values };
    calls.push(call);
    if (text.includes('SELECT count(*)::int AS experts')) return Promise.resolve([{ experts }]);
    if (text.includes('SELECT count(*)::int AS questionnaires')) return Promise.resolve([{ questionnaires }]);
    if (text.includes('SELECT risk_id FROM risk_radar')) return Promise.resolve([{ risk_id: 'R0353' }]);
    return call;
  };
  fn.transaction = async (queries) => queries;
  return { fn, calls };
}

test('demo seed skips a database that already has experts or questionnaires', async () => {
  const { fn, calls } = mockSql({ experts: 3, questionnaires: 0 });
  const result = await seedDemoData(fn);
  assert.deepEqual(result, { seeded: false });
  assert.equal(calls.length, 2);
});

test('demo seed inserts the questionnaire, experts, assignments and responses', async () => {
  const { fn, calls } = mockSql({ experts: 0, questionnaires: 0 });
  const result = await seedDemoData(fn);
  assert.equal(result.seeded, true);
  assert.equal(result.experts, 8);
  assert.ok(result.questionnaireId);
  const inserts = calls.filter((call) => call.text.includes('INSERT INTO'));
  assert.equal(inserts.length, 1 + 8 + 8 + 8 + 8);
  const questionnaire = calls.find((call) => call.text.includes('INSERT INTO questionnaires'));
  assert.ok(questionnaire.values.some((value) => typeof value === 'string' && value.includes('question-6')));
  const response = calls.find((call) => call.text.includes('INSERT INTO responses'));
  assert.ok(response.values.some((value) => typeof value === 'string' && value.includes('question-1-')));
});
