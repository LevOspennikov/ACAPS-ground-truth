import { redirect, reject, textField } from "../../../server/forms.js";
import { createQuestionnaire, denyUnlessAdmin } from "../../../server/regions.js";

export async function POST({ request, cookies }) {
  const denied = denyUnlessAdmin(request, cookies);
  if (denied) return denied;
  const form = await request.formData();
  let region;
  let topic;
  let risk;
  try {
    region = textField(form, "region", 80, true);
    topic = textField(form, "topic", 180, true);
    risk = textField(form, "risk", 40, true);
  } catch {
    return reject("A topic and a selected risk are required.");
  }
  const id = await createQuestionnaire(region, topic, risk);
  if (!id) return reject("Risk not found in the selected country", 404);
  return redirect(`/admin/regions/${region}/questionnaires/${id}`);
}
