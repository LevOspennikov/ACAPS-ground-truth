import { configured } from '../../../server/db.js';
import { isAdmin } from '../../../server/auth.js';
import { sameOrigin, redirect, reject } from '../../../server/forms.js';
import { validateRiskRadar } from '../../../data/risk-radar-fields.js';
import { addRiskRadar } from '../../../server/risk-radar.js';

export async function POST({ request, cookies }) {
  if (!sameOrigin(request) || !configured() || !isAdmin(cookies)) return reject('Forbidden', 403);
  let record;
  try { record = validateRiskRadar(await request.formData()); }
  catch (error) { return reject(`${error.message} Go back to edit the form.`); }
  try { await addRiskRadar(record); }
  catch (error) {
    if (error.code === '23505') return reject('That Risk ID already exists. Go back and choose a different ID.', 409);
    return reject('The risk could not be saved. Check the database connection and initialization, then retry.', 503);
  }
  return redirect('/admin/risk-radar?saved=1');
}
