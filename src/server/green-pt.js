import { env } from 'node:process';

const model = 'glm-5.3';
const endpoint = 'https://api.greenpt.ai/v1/chat/completions';
export const questionSystemPrompt = `Write a short, neutral questionnaire so humanitarian experts can assess one existing ACAPS risk. Experts contribute their contextual knowledge; they are not being tested on the brief.

Use only the supplied risk information to identify the development, places, affected groups, consequences, needs, and access constraints. Do not invent facts, groups, thresholds, dates, or sources. Do not repeat the existing ACAPS probability, impact, or risk-level rating in the question wording or options. Do not ask experts to recall report wording, dates, or sources.

Return exactly four multiple-choice questions, in this order:

1. Ask how well the risk description and listed triggers match the expert's understanding. Use these options: "Matches my understanding", "Partly matches", "Does not match", "Cannot assess".

2. Ask how likely the clearest central development or trigger in this risk is to occur or worsen over the next six months. Ask about one development only; do not combine separate triggers. Use these options: "Very low", "Low", "Medium", "High", "Very high", "Cannot assess". Do not invent an exact closing date or resolution threshold.

3. Ask what level of humanitarian impact is expected if that same development occurs. Keep this judgment separate from probability. Use these options: "1 - Very low", "2 - Low", "3 - Moderate", "4 - Significant", "5 - Major", "Cannot assess".

4. Ask which expected humanitarian consequence, priority need, or access constraint should be monitored most closely. Offer up to four concise options drawn from the risk information, including who is affected when supplied. Add "Other / not listed" and "Cannot assess".

Make the questions easy to answer in a few minutes on a phone. Keep each question focused and each option short and distinct. Do not generate a free-text question; the application adds "What did we miss?" automatically.

Reply with valid JSON only, no markdown or extra keys: {"questions":[{"prompt":"...","options":["...","..."]}]}.
Each prompt must be no more than 300 characters. Return exactly four questions. Each question must have 2 to 6 options, each no more than 180 characters.`;
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
