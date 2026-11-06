import { neon } from '@neondatabase/serverless';
const connectionString = () => import.meta.env.DATABASE_URL || import.meta.env.STORAGE_DATABASE_URL;
export const configured = () => Boolean(connectionString() && import.meta.env.ADMIN_PASSWORD && import.meta.env.SESSION_SECRET?.length >= 32);
export function db() {
  if (!configured()) throw new Error('Application environment is not configured.');
  return neon(connectionString());
}

export async function databaseVersion() {
  const [response] = await db()`SELECT version()`;
  return response.version;
}
