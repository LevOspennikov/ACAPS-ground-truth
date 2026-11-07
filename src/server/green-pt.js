import { env } from 'node:process';

const model = 'glm-5.3';
const endpoint = 'https://api.greenpt.ai/v1/chat/completions';
const briefFields = ['risk_id', 'risk_title', 'country', 'risk_type', 'status', 'probability', 'risk_level', 'risk_trend', 'rationale', 'triggers', 'expected_impact', 'expected_priority_needs', 'current_vulnerability'];

// Server-only. Do not import into browser code or log the returned value.
export function getGreenPtApiKey() {
  return env.GREEN_PT_API_KEY || null;
}

export function riskBrief(risk) {
  return briefFields.map((key) => {
    const value = String(risk?.[key] || '').trim().replace(/\s+/g, ' ').slice(0, 1200);
    return value ? `${key}: ${value}` : '';
  }).filter(Boolean).join('\n');
}

export function parseGeneratedQuestions(content) {
  const text = String(content || '').trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('generate');
  const parsed = JSON.parse(text.slice(start, end + 1));
  const items = Array.isArray(parsed.questions) ? parsed.questions : [];
  const questions = [];
  for (const item of items) {
    const prompt = String(item?.prompt || '').trim().slice(0, 300);
    if (!prompt || prompt.toLowerCase() === 'what did we miss?') continue;
    const options = (Array.isArray(item.options) ? item.options : [])
      .map((option) => String(option).trim().slice(0, 180))
      .filter(Boolean)
      .slice(0, 6);
    questions.push(options.length >= 2
      ? { type: 'single', prompt, options, placeholder: '' }
      : { type: 'text', prompt, options: [], placeholder: '' });
    if (questions.length === 5) break;
  }
  if (questions.length < 3) throw new Error('generate');
  questions.push({ type: 'text', prompt: 'What did we miss?', options: [], placeholder: 'Add anything this questionnaire did not ask' });
  return questions;
}

export async function generateRiskQuestions(risk) {
  const key = getGreenPtApiKey();
  if (!key) throw new Error('key');
  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        stream: false,
        temperature: 0.4,
        messages: [
          { role: 'system', content: 'You write short expert-validation questions about one humanitarian risk. Reply with JSON only, no markdown: {"questions":[{"prompt":"...","options":["...","..."]}]}. Return 3, 4 or 5 questions. Each question needs 2 to 4 short answer options grounded in the risk. Do not include a free-text question.' },
          { role: 'user', content: riskBrief(risk) },
        ],
      }),
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new Error('generate');
  }
  if (!response.ok) throw new Error('generate');
  const body = await response.json();
  return parseGeneratedQuestions(body?.choices?.[0]?.message?.content);
}
