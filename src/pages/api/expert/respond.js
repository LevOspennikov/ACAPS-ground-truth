// Answers are now saved by the server-rendered step form at /questionnaire.
import { configured } from '../../../server/db.js';
import { expertAssignment } from '../../../server/auth.js';
import { sameOrigin, redirect, reject } from '../../../server/forms.js';
export async function POST({ request, cookies }) {
  if (!sameOrigin(request) || !configured()) return reject('Forbidden', 403);
  if (!await expertAssignment(cookies)) return reject('Your session has expired.', 401);
  return redirect('/questionnaire');
}
