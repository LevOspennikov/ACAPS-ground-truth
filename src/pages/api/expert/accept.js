import { db, configured } from '../../../server/db.js';
import { hash, token, cookieOptions } from '../../../server/auth.js';
import { sameOrigin, redirect, reject } from '../../../server/forms.js';
export async function POST({ request, cookies }) {
  if (!sameOrigin(request)) return reject('Forbidden', 403);
  if (!configured()) return reject('Application is not configured.', 503);
  const form = await request.formData();
  const invitation = form.get('token');
  if (typeof invitation !== 'string' || !/^[a-f0-9]{64}$/.test(invitation)) return reject('Invalid invitation.');
  const session = token();
  const sql = db();
  const results = await sql.transaction([
    sql`SELECT e.id FROM experts e JOIN assignments a ON a.expert_id = e.id JOIN invitations i ON i.assignment_id = a.id
      WHERE i.token_hash = ${hash(invitation)} FOR UPDATE OF e, a`,
    sql`WITH accepted AS (
      UPDATE invitations i SET used_at = now() FROM assignments a, experts e
      WHERE i.token_hash = ${hash(invitation)} AND i.assignment_id = a.id AND a.expert_id = e.id AND e.active = true
      AND i.used_at IS NULL AND i.revoked_at IS NULL AND i.expires_at > now() RETURNING i.assignment_id
    ) INSERT INTO expert_sessions (token_hash, assignment_id, expires_at)
      SELECT ${hash(session)}, assignment_id, now() + interval '7 days' FROM accepted RETURNING assignment_id`,
  ]);
  if (!results[1].length) return reject('This invitation is expired, replaced, already used, or the user is inactive. Ask your organiser for a fresh link.', 410);
  cookies.set('expert', session, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 });
  return redirect('/questionnaire');
}
