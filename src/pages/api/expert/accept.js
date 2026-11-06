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
  const [created] = await db()`WITH accepted AS (
    UPDATE invitations SET used_at = now() WHERE token_hash = ${hash(invitation)}
    AND used_at IS NULL AND expires_at > now() RETURNING assignment_id
  ) INSERT INTO expert_sessions (token_hash, assignment_id, expires_at)
    SELECT ${hash(session)}, assignment_id, now() + interval '7 days' FROM accepted RETURNING assignment_id`;
  if (!created) return reject('This invitation expired or has already been used. Return to /questionnaire in the original browser, or ask for a new invitation.', 410);
  cookies.set('expert', session, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 });
  return redirect('/questionnaire');
}
