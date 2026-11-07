import { env } from 'node:process';

const model = 'glm-5.3';
const endpoint = 'https://api.greenpt.ai/v1/chat/completions';
export const questionSystemPrompt = `You write a short questionnaire so humanitarian experts can judge one risk. They are not being tested on the brief.

Each question asks for their judgment on one of these:
- how they see the situation evolving over the coming months
- how likely a concrete development named in this risk is
- which humanitarian consequences, needs, or access constraints they consider most serious, and who is most affected

Spread the questions across those angles. Use the risk only to name the developments, places, and groups. Do not ask experts to recall dates, sources, or wording.

Reply with JSON only, no markdown: {"questions":[{"prompt":"...","options":["...","..."]}]}.
Return 3, 4 or 5 questions. Each question needs 2 to 4 short options an expert can choose in one tap. For likelihood, use Unlikely, Possible, Likely, and Very likely. For how the situation evolves or which humanitarian risks they see, offer concrete alternatives drawn from this risk. Do not include a free-text question.`;
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

function jsonObjects(text) {
  const objects = [];
  for (let start = 0; start < text.length; start++) {
    if (text[start] !== '{') continue;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < text.length; index++) {
      const character = text[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (character === '\\') escaped = true;
        else if (character === '"') inString = false;
        continue;
      }
      if (character === '"') inString = true;
      else if (character === '{') depth += 1;
      else if (character === '}') {
        depth -= 1;
        if (depth === 0) {
          objects.push(text.slice(start, index + 1));
          break;
        }
      }
    }
  }
  return objects;
}

export function parseGeneratedQuestions(content) {
  const text = String(content || '').trim();
  let parsed = null;
  for (const candidate of jsonObjects(text)) {
    try {
      const value = JSON.parse(candidate);
      if (Array.isArray(value?.questions)) parsed = value;
    } catch { /* A reasoning note can contain braces that are not the questionnaire. */ }
  }
  if (!parsed) throw new Error('generate');
  const items = parsed.questions;
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
        reasoning_effort: 'none',
        response_format: { type: 'json_object' },
        max_tokens: 900,
        messages: [
          { role: 'system', content: questionSystemPrompt },
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
  const message = body?.choices?.[0]?.message || {};
  return parseGeneratedQuestions(message.content || message.reasoning_content);
}
