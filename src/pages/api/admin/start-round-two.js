import { denyUnlessAdmin } from '../../../server/auth.js';
import { isUuid } from '../../../server/ids.js';
import { redirect, reject } from '../../../server/forms.js';
import { startRoundTwo } from '../../../server/delphi.js';

export async function POST({ request, cookies }) {
  const denied = denyUnlessAdmin(request, cookies);
  if (denied) return denied;
  const id = (await request.formData()).get('questionnaire');
  if (!isUuid(id)) return reject('Choose a valid questionnaire.');
  try {
    const started = await startRoundTwo(id);
    return redirect(`/admin/results/${id}${started ? '' : '?error=round-two'}`);
  } catch {
    return reject('Could not start Round 2. Please retry.', 503);
  }
}
