import { redirect, reject, textField } from "../../../server/forms.js";
import { createQuestionnaire, denyUnlessAdmin } from "../../../server/regions.js";

export async function POST({ request, cookies }) {
  const denied = denyUnlessAdmin(request, cookies);
  if (denied) return denied;
  const form = await request.formData();
  let region;
  let topic;
  try {
    region = textField(form, "region", 80, true);
    topic = textField(form, "topic", 180, true);
  } catch {
    return reject("A topic of up to 180 characters is required.");
  }
  const id = await createQuestionnaire(region, topic);
  if (!id) return reject("Region not found", 404);
  return redirect(`/admin/regions/${region}/questionnaires/${id}`);
}
