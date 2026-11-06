import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { db, configured } from './db.js';
import { sameOrigin, reject } from './forms.js';
export const hash = (value) => createHash('sha256').update(value).digest('hex');
export const token = () => randomBytes(32).toString('hex');
export const equal = (a, b) => timingSafeEqual(Buffer.from(hash(a)), Buffer.from(hash(b)));
const sign = (value) => createHmac('sha256', import.meta.env.SESSION_SECRET).update(value).digest('hex');
export const cookieOptions = { path: '/', httpOnly: true, sameSite: 'lax', secure: import.meta.env.PROD };
export function setAdmin(cookies) {
  const expiry = String(Date.now() + 8 * 60 * 60 * 1000);
  cookies.set('admin', `${expiry}.${sign(expiry)}`, { ...cookieOptions, maxAge: 8 * 60 * 60 });
}
export function isAdmin(cookies) {
  const [expiry, signature] = (cookies.get('admin')?.value || '').split('.');
  return Boolean(expiry && signature && Number(expiry) > Date.now() && equal(signature, sign(expiry)));
}
export function denyUnlessAdmin(request, cookies) {
  if (!sameOrigin(request) || !configured() || !isAdmin(cookies)) return reject('Forbidden', 403);
  return null;
}
export async function expertAssignment(cookies) {
  const value = cookies.get('expert')?.value;
  if (!value) return null;
  const sql = db();
  const [assignment] = await sql`SELECT a.id, q.title, q.context AS description, q.questions,
    e.profile_mode, coalesce(c.title, g.name, 'Questionnaire') AS crisis_title, coalesce(c.country, g.name, '') AS country, r.answers, r.progress_step, r.submitted_at, r.updated_at
    FROM expert_sessions s JOIN assignments a ON a.id = s.assignment_id
    JOIN experts e ON e.id = a.expert_id JOIN questionnaires q ON q.id = a.questionnaire_id
    LEFT JOIN crises c ON c.id = q.crisis_id LEFT JOIN regions g ON g.slug = q.region_slug LEFT JOIN responses r ON r.assignment_id = a.id
    WHERE s.token_hash = ${hash(value)} AND s.expires_at > now() AND e.active = true`;
  return assignment || null;
}
