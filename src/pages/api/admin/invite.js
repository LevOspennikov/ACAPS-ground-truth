import { configured, db } from '../../../server/db.js';
import { isAdmin, cookieOptions } from '../../../server/auth.js';
import { createInvitation } from '../../../server/questionnaires.js';
import { sameOrigin, redirect, reject } from '../../../server/forms.js';
export async function POST({ request, cookies }) {
  if (!sameOrigin(request) || !configured() || !isAdmin(cookies)) return reject('Forbidden', 403);
  const form = await request.formData();
  const id = form.get('questionnaire');
  if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id)) return reject('Invalid questionnaire.');
  const [questionnaire] = await db()`SELECT id FROM questionnaires WHERE id::text = ${id}`;
  if (!questionnaire) return reject('Questionnaire not found.', 404);
  const invitation = await createInvitation(id);
  cookies.set('new-invitation', invitation, { ...cookieOptions, path: '/admin', maxAge: 300 });
  return redirect('/admin');
}
