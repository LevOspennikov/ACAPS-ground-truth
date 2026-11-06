import { configured } from '../../../server/db.js';
import { equal, setAdmin } from '../../../server/auth.js';
import { sameOrigin, redirect, reject } from '../../../server/forms.js';
export async function POST({ request, cookies }) {
  if (!sameOrigin(request)) return reject('Forbidden', 403);
  if (!configured()) return reject('Configure the deployment environment first.', 503);
  const form = await request.formData();
  const password = form.get('password');
  if (typeof password !== 'string' || password.length > 256 || !equal(password, import.meta.env.ADMIN_PASSWORD)) return redirect('/admin?error=login');
  setAdmin(cookies);
  return redirect('/admin');
}
