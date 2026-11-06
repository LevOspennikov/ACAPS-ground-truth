export function validateQuestions(questions) {
  if (!Array.isArray(questions) || !questions.length || questions.length > 50) throw new Error('Questionnaire template must contain 1–50 questions.');
  const ids = new Set();
  for (const q of questions) {
    if (!/^[a-zA-Z0-9-]{1,80}$/.test(q.id) || ids.has(q.id) || !q.prompt?.trim() || !['single', 'text'].includes(q.type)) throw new Error('Invalid question template.');
    if (q.type === 'single' && (!Array.isArray(q.options) || q.options.length < 2 || q.options.some((option) => typeof option !== 'string' || !option.trim()))) throw new Error('Invalid question options.');
    ids.add(q.id);
  }
  return questions;
}
export function validateAnswer(question, value) {
  if (typeof value !== 'string' || value.length > 4000) throw new Error('Answers must be under 4,000 characters.');
  const answer = value.trim();
  if (question.type === 'single' && answer && !question.options.some((_, i) => answer === `${question.id}-${i}`)) throw new Error('Choose a valid answer.');
  return answer;
}
export function firstUnanswered(questions, answers) {
  const index = questions.findIndex((q) => q.required !== false && !answers[q.id]?.trim());
  return index === -1 ? questions.length : index;
}
export function answerLabel(question, value) {
  if (!value) return 'No answer provided';
  if (question.type === 'text') return value;
  const index = question.options.findIndex((_, i) => value === `${question.id}-${i}`);
  return question.options[index] ?? 'No answer provided';
}

function parseJson(value) {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return null; }
}

function storedAnswers(stored) {
  const parsed = parseJson(stored);
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
}

function questionOptions(question) {
  if (Array.isArray(question.options)) return question.options;
  return String(question.options || '').split('\n').filter(Boolean);
}

// Turn a stored response into the prompts and chosen labels an admin can read.
export function describeAnswers(questions, stored) {
  const answers = storedAnswers(stored);
  const parsedList = parseJson(questions);
  const parsed = Array.isArray(parsedList) ? parsedList : [];
  if (!parsed.length) {
    return Object.entries(answers)
      .filter(([, value]) => String(value || '').trim())
      .map(([, value]) => ({ prompt: 'Answer', value: String(value) }));
  }
  return parsed.map((question) => ({
    prompt: question.prompt || 'Question',
    value: answerLabel({ ...question, type: question.type || 'text', options: questionOptions(question) }, String(answers[question.id] ?? '')),
  }));
}
