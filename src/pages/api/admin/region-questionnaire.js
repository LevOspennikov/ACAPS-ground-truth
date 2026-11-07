import { redirect, reject, textField } from "../../../server/forms.js";
import { countryRisk, createQuestionnaire } from "../../../server/regions.js";
import { denyUnlessAdmin } from "../../../server/auth.js";
import { generateRiskQuestions } from "../../../server/green-pt.js";

export const config = { maxDuration: 30 };

export async function POST({ request, cookies }) {
  const denied = denyUnlessAdmin(request, cookies);
  if (denied) return denied;
  const form = await request.formData();
  let region;
  let riskId;
  try {
    region = textField(form, "region", 80, true);
    riskId = textField(form, "risk", 40, true);
  } catch {
    return reject("A selected risk is required.");
  }
  const risk = await countryRisk(region, riskId);
  if (!risk) return reject("Risk not found in the selected country", 404);
  const back = `/admin/regions/${region}?${new URLSearchParams({ risk: riskId, error: "generate" })}`;
  const questions = await generateRiskQuestions(risk);
  const id = await createQuestionnaire(region, String(risk.risk_title).slice(0, 180), riskId, questions);
  if (!id) return redirect(back);
  return redirect(`/admin/regions/${region}/questionnaires/${id}${questions.length ? '' : '?manual=1'}`);
}
