import { redirect, reject, textField } from "../../../server/forms.js";
import { createReport } from "../../../server/regions.js";
import { denyUnlessAdmin } from "../../../server/auth.js";

export async function POST({ request, cookies }) {
  const denied = denyUnlessAdmin(request, cookies);
  if (denied) return denied;
  const form = await request.formData();
  let region;
  let title;
  let summary;
  try {
    region = textField(form, "region", 80, true);
    title = textField(form, "title", 180, true);
    summary = textField(form, "summary", 4000, true);
  } catch {
    return reject("A title and summary are required.");
  }
  const id = await createReport(region, title, summary);
  if (!id) return reject("Country not found", 404);
  return redirect(`/admin/regions/${region}/reports/${id}`);
}
