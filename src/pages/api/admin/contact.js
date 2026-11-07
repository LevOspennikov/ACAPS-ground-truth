import { contactField, redirect, reject, textField } from "../../../server/forms.js";
import { createContact, denyUnlessAdmin } from "../../../server/regions.js";

export async function POST({ request, cookies }) {
  const denied = denyUnlessAdmin(request, cookies);
  if (denied) return denied;
  const form = await request.formData();
  let region;
  let name;
  let contact;
  try {
    region = textField(form, "region", 80, true);
    name = textField(form, "name", 120, true);
    contact = contactField(form);
  } catch (error) {
    const message = error.message === "Enter an email address or a phone number." ? error.message : "A contact name of up to 120 characters is required.";
    return reject(message);
  }
  const id = await createContact(region, name, contact);
  if (!id) return reject("Country not found", 404);
  return redirect(`/admin/regions/${region}/contacts/${id}`);
}
