import { randomBytes } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { embeddedDatabaseEnabled } from '../src/server/embedded-policy.js';

// Check before opening any files or importing the development-only dependency.
embeddedDatabaseEnabled({ ...process.env, TEST_DATABASE: 'embedded', MODE: 'test' });
const { PGlite } = await import('@electric-sql/pglite');
const { setupEmbedded } = await import('../db/setup-embedded.js');
await mkdir('.test-data', { recursive: true });
const database = new PGlite('.test-data/pglite');
try { await setupEmbedded(database); }
finally { await database.close(); }

console.log('Embedded test database ready. Admin password: local-test-admin');
console.log('In Users, open Local Test Expert and generate a magic link to try the questionnaire.');
const child = spawn(process.execPath, ['node_modules/astro/bin/astro.mjs', 'dev', '--ignore-lock', '--mode', 'test', '--host', '127.0.0.1', '--port', '4322'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    TEST_DATABASE: 'embedded',
    ADMIN_PASSWORD: 'local-test-admin',
    SESSION_SECRET: randomBytes(32).toString('hex'),
    // Test interactions must never call external email or question-generation APIs.
    RESEND_API_KEY: '', EMAIL_FROM: '', GREEN_PT_API_KEY: '',
  },
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', (code) => { process.exitCode = code ?? 1; });
