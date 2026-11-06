import { db } from '../../../server/db.js';
import { denyUnlessAdmin } from '../../../server/auth.js';
import { isUuid } from '../../../server/ids.js';
import { redirect, reject, textField } from '../../../server/forms.js';
export async function POST({ request, cookies }) {
  const denied = denyUnlessAdmin(request, cookies);
  if (denied) return denied;
  const form = await request.formData();
  let region, risk, questionnaire;
  try { region = textField(form, 'region', 80, true); risk = textField(form, 'risk', 40, true); questionnaire = textField(form, 'questionnaire', 36, true); }
  catch { return reject('Choose a country, risk and questionnaire.'); }
  if (!isUuid(questionnaire)) return reject('Invalid questionnaire.');
  const [updated] = await db()`UPDATE questionnaires q SET risk_id = r.risk_id, region_slug = r.region_slug
    FROM risk_radar r WHERE q.id = ${questionnaire}::uuid AND q.risk_id IS NULL
    AND (q.region_slug = ${region} OR q.region_slug IS NULL) AND r.risk_id = ${risk} AND r.region_slug = ${region} RETURNING q.id`;
  if (!updated) return reject('The questionnaire is already linked, or the selected risk does not belong to this country.', 409);
  return redirect(`/admin?${new URLSearchParams({country:region,risk})}`);
}
