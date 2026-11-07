import { redirect, textField } from "../../../server/forms.js";
import { addQuestion, removeQuestion, updateQuestion } from "../../../server/regions.js";
import { denyUnlessAdmin } from "../../../server/auth.js";

const types = ["single", "text"];

function back(region, id, error) {
  const query = error ? `?error=${error}` : "";
  return redirect(`/admin/regions/${region}/questionnaires/${id}${query}`);
}

export async function POST({ request, cookies }) {
  const denied = denyUnlessAdmin(request, cookies);
  if (denied) return denied;
  const form = await request.formData();
  let region;
  let questionnaire;
  let action;
  try {
    region = textField(form, "region", 80, true);
    questionnaire = textField(form, "questionnaire", 80, true);
    action = textField(form, "action", 20, true);
  } catch {
    return redirect("/admin");
  }

  if (action === "remove") {
    let question;
    try { question = textField(form, "question", 80, true); }
    catch { return back(region, questionnaire, "question"); }
    if (!await removeQuestion(region, questionnaire, question)) return back(region, questionnaire, "locked");
    return back(region, questionnaire);
  }

  if (action !== "add" && action !== "update") return redirect("/admin");
  let prompt;
  let type;
  let optionsText;
  let placeholder;
  let questionId = "";
  try {
    if (action === "update") questionId = textField(form, "question", 80, true);
    prompt = textField(form, "prompt", 300, true);
    type = textField(form, "type", 20, true);
    optionsText = textField(form, "options", 2000, false);
    placeholder = textField(form, "placeholder", 180, false);
  } catch {
    return back(region, questionnaire, "question");
  }
  if (!types.includes(type)) return back(region, questionnaire, "question");
  const question = { type, prompt, options: [], placeholder: "" };
  if (type === "single") {
    const options = optionsText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 8);
    if (options.length < 2 || options.some((option) => option.length > 180)) return back(region, questionnaire, "options");
    question.options = options;
  }
  if (type === "text") question.placeholder = placeholder;
  const saved = action === "update"
    ? await updateQuestion(region, questionnaire, questionId, question)
    : await addQuestion(region, questionnaire, question);
  if (!saved) return back(region, questionnaire, "locked");
  return back(region, questionnaire);
}
