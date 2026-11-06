import schema from '../../../../db/schema.sql?raw';
import { configured, db } from '../../../server/db.js';
import { isAdmin } from '../../../server/auth.js';
import { sameOrigin, redirect, reject } from '../../../server/forms.js';

export async function POST({ request, cookies }) {
  if (!sameOrigin(request) || !configured() || !isAdmin(cookies)) return reject('Forbidden', 403);
  const sql = db();
  const statements = schema.split(';').map((statement) => statement.trim()).filter(Boolean);
  try {
    // CREATE TABLE IF NOT EXISTS only; existing responses are preserved.
    await sql.transaction(statements.map((statement) => sql.query(statement)));
  } catch {
    return reject('Could not initialize the database. Check the Neon connection and permissions, then try again.', 503);
  }
  return redirect('/admin');
}
