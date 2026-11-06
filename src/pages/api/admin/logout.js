import { sameOrigin, redirect, reject } from '../../../server/forms.js';
export async function POST({ request, cookies }) {
  if (!sameOrigin(request)) return reject('Forbidden', 403);
  cookies.delete('admin', { path: '/' });
  return redirect('/admin');
}
