import { redirect, reject, textField } from "../../../server/forms.js";
import { createRegion, denyUnlessAdmin } from "../../../server/regions.js";

export async function POST({ request, cookies }) {
  const denied = denyUnlessAdmin(request, cookies);
  if (denied) return denied;
  const form = await request.formData();
  let name;
  try { name = textField(form, "name", 80, true); }
  catch { return reject("A region name of up to 80 characters is required."); }
  const created = await createRegion(name);
  if (!created) return reject("Enter a region name.");
  if (created.error) return redirect("/admin?error=region");
  return redirect(`/admin/regions/${created.slug}`);
}
