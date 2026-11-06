import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import rows from '../db/seeds/risk-radar.json' with { type: 'json' };
import { riskRadarSeedQueries, riskRadarSeedRows, seedCountryRisks } from '../db/seed-risk-radar.js';
import { countrySlug, selectCountryRisk } from '../src/data/countries.js';
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
  assert.equal(calls.length, 12);
  for (const [i, call] of calls.entries()) {
    const { record, sourceRow } = riskRadarSeedRows[i];
    assert.match(call.query, /ON CONFLICT DO NOTHING$/);
    assert.ok(!call.query.includes(record['Risk Title']));
    assert.deepEqual(call.values, [...riskRadarFields.map((field) => record[field.label]), sourceRow, countrySlug(record.Country)]);
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

test('additional records preserve two Chad rows from the source export', () => {
  assert.deepEqual(riskRadarSeedRows.slice(10).map(({record,sourceRow}) => [record['Risk ID'],record.Country,sourceRow]), [['R0233','Chad',14],['R1043','Chad',15]]);
  assert.deepEqual([...new Set(riskRadarSeedRows.map(({record}) => record.Country))], ['Afghanistan','Algeria','Bangladesh','Burundi','Chad']);
});
test('country initialization creates seeded and existing manual countries before inserting risks', async () => {
  let statements;
  const sql = {
    query: (query, values) => query.startsWith('SELECT DISTINCT') ? [{country:'Manual country'}] : {query,values},
    transaction: async (queries) => { statements=queries; },
  };
  await seedCountryRisks(sql);
  const regions=statements.filter((s) => s.query.startsWith('INSERT INTO regions'));
  assert.equal(regions.length,6);
  assert.ok(regions.some((s) => s.values[0] === 'chad'));
  assert.ok(regions.some((s) => s.values[0] === 'manual-country'));
  const firstRisk=statements.findIndex((s) => s.query.startsWith('INSERT INTO risk_radar'));
  assert.equal(firstRisk,6);
  assert.ok(statements.filter((s) => s.query.startsWith('UPDATE risk_radar')).every((s) => s.query.includes('region_slug IS NULL')));
});
test('country slugs are stable and ignore accents', () => {
  assert.equal(countrySlug('Afghanistan'),'afghanistan');
  assert.equal(countrySlug(' Côte d’Ivoire '),'cote-d-ivoire');
});

test('risk selection cannot cross country boundaries or substitute an invalid selection', () => {
  const records=[{risk_id:'R1',region_slug:'afghanistan'},{risk_id:'R2',region_slug:'chad'}];
  assert.equal(selectCountryRisk(records,'afghanistan').risk_id,'R1');
  assert.equal(selectCountryRisk(records,'chad','R2').risk_id,'R2');
  assert.equal(selectCountryRisk(records,'afghanistan','R2'),null);
  assert.equal(selectCountryRisk(records,'chad','missing'),null);
  assert.equal(selectCountryRisk([], 'chad'),null);
});
