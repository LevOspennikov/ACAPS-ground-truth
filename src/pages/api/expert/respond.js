import { db, configured } from '../../../server/db.js';
import { expertAssignment } from '../../../server/auth.js';
import { sameOrigin, redirect, reject, rating, textField } from '../../../server/forms.js';
export async function POST({ request, cookies }) {
  if (!sameOrigin(request) || !configured()) return reject('Forbidden', 403);
  const assignment = await expertAssignment(cookies);
  if (!assignment) return reject('Your session has expired. Ask your organiser for a new invitation.', 401);
  if (assignment.submitted_at) return redirect('/questionnaire');
  const form = await request.formData();
  let likelihood, confidence, context;
  const intent = form.get('intent');
  try {
    if (!['save', 'submit'].includes(intent)) throw new Error();
    likelihood = rating(form.get('likelihood'));
    confidence = rating(form.get('confidence'));
    context = textField(form, 'context', 4000);
    if (intent === 'submit' && (!likelihood || !confidence)) throw new Error();
  } catch { return reject('Choose both ratings before submitting, or use Save progress. Context must be under 4,000 characters. Go back to edit your answers.'); }
  await db()`INSERT INTO responses (assignment_id, likelihood, confidence, context, submitted_at)
    VALUES (${assignment.id}, ${likelihood}, ${confidence}, ${context}, CASE WHEN ${intent} = 'submit' THEN now() ELSE NULL END)
    ON CONFLICT (assignment_id) DO UPDATE SET likelihood = EXCLUDED.likelihood, confidence = EXCLUDED.confidence,
    context = EXCLUDED.context, updated_at = now(), submitted_at = EXCLUDED.submitted_at
    WHERE responses.submitted_at IS NULL`;
  return redirect(intent === 'save' ? '/questionnaire?saved=1' : '/questionnaire');
}
