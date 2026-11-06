import { db } from '../../../server/db.js';
import { denyUnlessAdmin } from '../../../server/regions.js';
import { validateRiskRadar } from '../../../data/risk-radar-fields.js';
import { addRiskRadar } from '../../../server/risk-radar.js';
import { redirect, reject, textField } from '../../../server/forms.js';
export async function POST({ request, cookies }) {
  const denied = denyUnlessAdmin(request, cookies);
  if (denied) return denied;
  const form = await request.formData();
  let slug;
  try { slug = textField(form, 'region', 80, true); } catch { return reject('Choose a country.'); }
  const [region] = await db()`SELECT slug, name FROM regions WHERE slug = ${slug}`;
  if (!region) return reject('Country not found.', 404);
  form.set('country', region.name);
  let record;
  try { record = validateRiskRadar(form); } catch (error) { return reject(`${error.message} Go back to edit the form.`); }
  try { await addRiskRadar(record, region.slug); }
  catch (error) {
    if (error.code === '23505') return reject('Risk ID already exists. Use another ID.', 409);
    return reject('Could not save the risk. Check the database connection and retry.', 503);
  }
  return redirect(`/admin?${new URLSearchParams({country:region.slug,risk:record.risk_id,saved:'1'})}`);
}
