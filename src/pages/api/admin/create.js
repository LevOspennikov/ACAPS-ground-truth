import { randomUUID } from 'node:crypto';
import { configured } from '../../../server/db.js';
import { isAdmin, cookieOptions } from '../../../server/auth.js';
import { createInvitation } from '../../../server/questionnaires.js';
import { sameOrigin, textField, redirect, reject } from '../../../server/forms.js';
export async function POST({ request, cookies }) {
  if (!sameOrigin(request) || !configured() || !isAdmin(cookies)) return reject('Forbidden', 403);
  const form = await request.formData();
  let questionnaire;
  try { questionnaire = { title: textField(form, 'title', 180, true), context: textField(form, 'context', 4000, true) }; }
  catch { return reject('A title (up to 180 characters) and description (up to 4,000 characters) are required. Go back to edit your form.'); }
  const invitation = await createInvitation(randomUUID(), questionnaire);
  cookies.set('new-invitation', invitation, { ...cookieOptions, path: '/admin', maxAge: 300 });
  return redirect('/admin');
}
