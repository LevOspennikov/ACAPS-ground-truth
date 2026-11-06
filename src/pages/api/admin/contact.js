import { redirect, reject, textField } from "../../../server/forms.js";
import { createContact, denyUnlessAdmin } from "../../../server/regions.js";

export async function POST({ request, cookies }) {
  const denied = denyUnlessAdmin(request, cookies);
  if (denied) return denied;
  const form = await request.formData();
  let region;
  let name;
  let focus;
  try {
    region = textField(form, "region", 80, true);
    name = textField(form, "name", 120, true);
    focus = textField(form, "focus", 120, false);
  } catch {
    return reject("A contact name of up to 120 characters is required.");
  }
  const id = await createContact(region, name, focus);
  if (!id) return reject("Region not found", 404);
  return redirect(`/admin/regions/${region}/contacts/${id}`);
}
