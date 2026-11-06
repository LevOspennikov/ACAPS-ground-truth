import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import rows from '../db/seeds/risk-radar.json' with { type: 'json' };
import { riskRadarSeedQueries } from '../db/seed-risk-radar.js';
import { riskRadarFields, validateRiskRadar } from '../src/data/risk-radar-fields.js';

test('seed contains exactly the first ten CSV records and all 25 fields', () => {
  assert.equal(rows.length, 10);
  assert.deepEqual(rows.map((row) => row['Risk ID']), ['R0353','R0990','R1015','R1062','R1067','R1056','R0371','R1020','R1039','R0510']);
  assert.equal(riskRadarFields.length, 25);
  for (const row of rows) assert.deepEqual(Object.keys(row), riskRadarFields.map((field) => field.label));
  assert.ok(rows[1].Source.includes('\n'), 'embedded CSV newlines preserved');
  assert.equal(rows[0]['Expected exposure'], '<20,000');
});
test('seed uses bound parameters and does not overwrite existing records', () => {
  const calls = riskRadarSeedQueries({ query: (query, values) => ({ query, values }) });
  assert.equal(calls.length, 10);
  for (const [i, call] of calls.entries()) {
    assert.match(call.query, /ON CONFLICT DO NOTHING$/);
    assert.ok(!call.query.includes(rows[i]['Risk Title']));
    assert.deepEqual(call.values, [...riskRadarFields.map((field) => rows[i][field.label]), i + 1]);
  }
});
test('schema stores all mapped export columns', async () => {
  const schema = await readFile(new URL('../db/risk-radar.sql', import.meta.url), 'utf8');
  for (const {key} of riskRadarFields) assert.ok(schema.includes(`${key} text`), key);
});
test('new records validate required fields, bounds and country codes', () => {
  const form = new FormData();
  assert.throws(() => validateRiskRadar(form));
  for (const [key, value] of Object.entries({risk_id:'DEMO-1',risk_title:'Synthetic risk',country:'Demo',iso:'afg'})) form.set(key,value);
  assert.equal(validateRiskRadar(form).iso,'AFG');
  assert.equal(validateRiskRadar(form).source,'');
  form.set('iso','AF');assert.throws(() => validateRiskRadar(form));
  form.set('iso','');form.set('risk_id',"bad' id");assert.throws(() => validateRiskRadar(form));
  form.set('risk_id','DEMO-1');form.set('risk_title','x'.repeat(1001));assert.throws(() => validateRiskRadar(form));
});
