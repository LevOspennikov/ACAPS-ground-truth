import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldResetDatabase } from '../scripts/prototype-reset.js';

test('database reset requires an explicit opt-in on Vercel production', () => {
  const production = { VERCEL: '1', VERCEL_ENV: 'production' };
  assert.equal(shouldResetDatabase(production), false);
  assert.equal(shouldResetDatabase({ ...production, RESET_DATABASE_ON_DEPLOY: 'false' }), false);
  assert.equal(shouldResetDatabase({ ...production, RESET_DATABASE_ON_DEPLOY: 'true' }), true);
});

test('preview and local builds cannot reset production tables', () => {
  assert.equal(shouldResetDatabase({ RESET_DATABASE_ON_DEPLOY: 'true' }), false);
  assert.equal(shouldResetDatabase({ RESET_DATABASE_ON_DEPLOY: 'true', VERCEL: '1', VERCEL_ENV: 'preview' }), false);
  assert.equal(shouldResetDatabase({ RESET_DATABASE_ON_DEPLOY: 'true', VERCEL_ENV: 'production' }), false);
});
