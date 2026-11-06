// Legacy routes no longer create synthetic users as a side effect.
import { configured } from '../../../server/db.js';
import { isAdmin } from '../../../server/auth.js';
import { sameOrigin, redirect, reject } from '../../../server/forms.js';
export async function POST({ request, cookies }) {
  if (!sameOrigin(request) || !configured() || !isAdmin(cookies)) return reject('Forbidden', 403);
  return redirect('/admin/crises');
}
