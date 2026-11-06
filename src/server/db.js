import { neon } from '@neondatabase/serverless';
export const configured = () => Boolean(import.meta.env.DATABASE_URL && import.meta.env.ADMIN_PASSWORD && import.meta.env.SESSION_SECRET?.length >= 32);
export function db() {
  if (!configured()) throw new Error('Application environment is not configured.');
  return neon(import.meta.env.DATABASE_URL);
}
