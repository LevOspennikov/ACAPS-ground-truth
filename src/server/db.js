import { neon } from '@neondatabase/serverless';
import { embeddedDatabaseEnabled } from './embedded-policy.js';
const embedded = process.env.TEST_DATABASE === 'embedded' && embeddedDatabaseEnabled({
  TEST_DATABASE: process.env.TEST_DATABASE,
  MODE: import.meta.env.MODE,
  PROD: import.meta.env.PROD,
  NODE_ENV: process.env.NODE_ENV,
  VERCEL: process.env.VERCEL,
});
// Vite removes this import from production output, including PGlite's WASM.
const localSql = embedded && import.meta.env.DEV && import.meta.env.MODE === 'test'
  ? (await import('./embedded-database.js')).testDatabase()
  : null;
const connectionString = () => import.meta.env.DATABASE_URL || import.meta.env.STORAGE_DATABASE_URL;
export const configured = () => Boolean((localSql || connectionString()) && import.meta.env.ADMIN_PASSWORD && import.meta.env.SESSION_SECRET?.length >= 32);
export function db() {
  if (!configured()) throw new Error('Application environment is not configured.');
  return localSql || neon(connectionString());
}
