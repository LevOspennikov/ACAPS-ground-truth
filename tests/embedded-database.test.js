import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { embeddedSql } from '../src/server/embedded-database.js';
import { embeddedDatabaseEnabled } from '../src/server/embedded-policy.js';
import { setupEmbedded } from '../db/setup-embedded.js';

test('embedded storage is opt-in and rejects production, deployment and non-test modes', () => {
  assert.equal(embeddedDatabaseEnabled({ MODE: 'test' }), false);
  assert.equal(embeddedDatabaseEnabled({ TEST_DATABASE: 'embedded', MODE: 'test' }), true);
  for (const blocked of [{ MODE: 'development' }, { MODE: 'production' }, { PROD: true }, { NODE_ENV: 'production' }, { VERCEL: '1' }, { VERCEL: '0' }]) {
    assert.throws(() => embeddedDatabaseEnabled({ TEST_DATABASE: 'embedded', MODE: 'test', ...blocked }), /forbidden/);
  }
});

test('embedded database supports application schema, idempotent seeding and atomic lazy transactions', async () => {
  const database = new PGlite();
  try {
    await setupEmbedded(database);
    await setupEmbedded(database);
    const sql = embeddedSql(database);
    const [counts] = await sql`SELECT (SELECT count(*)::int FROM experts) AS experts,
      (SELECT count(*)::int FROM responses WHERE submitted_at IS NOT NULL) AS submitted,
      (SELECT count(*)::int FROM risk_radar) AS risks`;
    assert.deepEqual(counts, { experts: 9, submitted: 8, risks: 12 });

    const insert = sql`INSERT INTO regions (slug, name) VALUES (${'lazy-test'}, ${"O'Brien"})`;
    assert.equal((await sql`SELECT slug FROM regions WHERE slug = 'lazy-test'`).length, 0);
    await assert.rejects(sql.transaction([insert, sql`SELECT 1 / 0`]), /division by zero/);
    assert.equal((await sql`SELECT slug FROM regions WHERE slug = 'lazy-test'`).length, 0);
    await sql.transaction([sql`INSERT INTO regions (slug, name) VALUES ('lazy-test', ${"O'Brien"})`]);
    const [rows] = await sql.transaction([sql`SELECT name FROM regions WHERE slug = 'lazy-test'`], { readOnly: true, isolationLevel: 'RepeatableRead' });
    assert.equal(rows[0].name, "O'Brien");
    await assert.rejects(sql.transaction([sql`INSERT INTO regions (slug, name) VALUES ('readonly-test', 'Blocked')`], { readOnly: true }), /read-only/);
  } finally { await database.close(); }
});
