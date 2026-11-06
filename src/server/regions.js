import { countrySlug, selectCountryRisk } from "../data/countries.js";
import { randomUUID } from "node:crypto";
import { isAdmin } from "./auth.js";
import { db, configured } from "./db.js";
import { reject, sameOrigin } from "./forms.js";

export function denyUnlessAdmin(request, cookies) {
  if (!sameOrigin(request) || !configured() || !isAdmin(cookies)) return reject("Forbidden", 403);
  return null;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value) {
  return uuidPattern.test(value || "");
}

export function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export const slugify = countrySlug;

export async function listRegions(query = "") {
  const term = query.replace(/[%_]/g, "").trim();
  const sql = db();
  return sql`SELECT g.slug, g.name, count(r.risk_id)::int AS risks FROM regions g
    LEFT JOIN risk_radar r ON r.region_slug = g.slug
    WHERE g.name ILIKE ${"%" + term + "%"} GROUP BY g.slug ORDER BY g.name`;
}

export async function createRegion(name) {
  const slug = slugify(name);
  if (!slug) return null;
  const sql = db();
  const existing = await sql`SELECT slug FROM regions WHERE slug = ${slug}`;
  if (existing.length) return { error: "exists" };
  await sql`INSERT INTO regions (slug, name) VALUES (${slug}, ${name})`;
  return { slug };
}

export async function regionBoard(slug, riskId = "") {
  const sql = db();
  const [region] = await sql`SELECT slug, name FROM regions WHERE slug = ${slug}`;
  if (!region) return null;
  const reports = await sql`SELECT id, title, summary, published_on FROM reports WHERE region_slug = ${slug} ORDER BY published_on DESC, created_at DESC`;
  const risks = await sql`SELECT * FROM risk_radar WHERE region_slug = ${slug} ORDER BY risk_id`;
  const selectedRisk = selectCountryRisk(risks, slug, riskId);
  const questionnaires = selectedRisk ? await sql`SELECT id, title, created_at, sent_at FROM questionnaires
    WHERE region_slug = ${slug} AND risk_id = ${selectedRisk.risk_id} ORDER BY created_at DESC` : [];
  const unlinked = await sql`SELECT id, title FROM questionnaires WHERE (region_slug = ${slug} OR region_slug IS NULL) AND risk_id IS NULL ORDER BY created_at DESC`;
  const contacts = await sql`SELECT e.id, e.pseudonym AS name, e.focus,
    count(q.id)::int AS invited,
    count(ans.assignment_id) FILTER (WHERE q.id IS NOT NULL)::int AS joined
    FROM experts e
    LEFT JOIN assignments a ON a.expert_id = e.id
    LEFT JOIN questionnaires q ON q.id = a.questionnaire_id AND q.region_slug = ${slug}
    LEFT JOIN questionnaire_answers ans ON ans.assignment_id = a.id
    WHERE e.region_slug = ${slug}
    GROUP BY e.id
    ORDER BY e.pseudonym`;
  return {
    ...region,
    risks, selectedRisk, unlinked,
    reports: reports.map((report) => ({ ...report, date: formatDate(report.published_on) })),
    questionnaires: questionnaires.map((item) => ({ id: item.id, topic: item.title, opened: formatDate(item.created_at), sent: item.sent_at ? formatDate(item.sent_at) : "" })),
    contacts,
  };
}

export async function createReport(slug, title, summary) {
  const sql = db();
  const [region] = await sql`SELECT slug FROM regions WHERE slug = ${slug}`;
  if (!region) return null;
  const id = randomUUID();
  await sql`INSERT INTO reports (id, region_slug, title, summary) VALUES (${id}, ${slug}, ${title}, ${summary})`;
  return id;
}

export async function reportPage(slug, id) {
  if (!isUuid(id)) return null;
  const sql = db();
  const [row] = await sql`SELECT r.id, r.title, r.summary, r.published_on, g.slug, g.name
    FROM reports r JOIN regions g ON g.slug = r.region_slug
    WHERE r.id = ${id}::uuid AND r.region_slug = ${slug}`;
  if (!row) return null;
  return { id: row.id, title: row.title, summary: row.summary, date: formatDate(row.published_on), region: { slug: row.slug, name: row.name } };
}

export async function createContact(slug, name, focus) {
  const sql = db();
  const [region] = await sql`SELECT slug FROM regions WHERE slug = ${slug}`;
  if (!region) return null;
  const id = randomUUID();
  await sql`INSERT INTO experts (id, pseudonym, region_slug, focus) VALUES (${id}, ${name}, ${slug}, ${focus})`;
  return id;
}

export async function contactPage(slug, id) {
  if (!isUuid(id)) return null;
  const sql = db();
  const [contact] = await sql`SELECT e.id, e.pseudonym AS name, e.focus, g.slug, g.name AS region_name,
    count(q.id)::int AS invited,
    count(ans.assignment_id) FILTER (WHERE q.id IS NOT NULL)::int AS joined
    FROM experts e
    JOIN regions g ON g.slug = e.region_slug
    LEFT JOIN assignments a ON a.expert_id = e.id
    LEFT JOIN questionnaires q ON q.id = a.questionnaire_id AND q.region_slug = ${slug}
    LEFT JOIN questionnaire_answers ans ON ans.assignment_id = a.id
    WHERE e.id = ${id}::uuid AND e.region_slug = ${slug}
    GROUP BY e.id, g.slug, g.name`;
  if (!contact) return null;
  const answers = await sql`SELECT q.title AS topic, COALESCE(q.sent_at, a.created_at) AS happened, ans.answer
    FROM assignments a
    JOIN questionnaires q ON q.id = a.questionnaire_id
    LEFT JOIN questionnaire_answers ans ON ans.assignment_id = a.id
    WHERE a.expert_id = ${id}::uuid AND q.region_slug = ${slug}
    ORDER BY happened DESC`;
  return {
    id: contact.id,
    name: contact.name,
    focus: contact.focus,
    invited: contact.invited,
    joined: contact.joined,
    region: { slug: contact.slug, name: contact.region_name },
    answers: answers.map((item) => ({ topic: item.topic, date: formatDate(item.happened), answer: item.answer || "" })),
  };
}

export async function createQuestionnaire(slug, topic, riskId) {
  const sql = db();
  const id = randomUUID();
  const [created] = await sql`INSERT INTO questionnaires (id, title, context, region_slug, risk_id)
    SELECT ${id}, ${topic}, r.rationale, r.region_slug, r.risk_id FROM risk_radar r
    WHERE r.risk_id = ${riskId} AND r.region_slug = ${slug} RETURNING id`;
  if (!created) return null;
  return id;
}

export async function editorPage(slug, id) {
  if (!isUuid(id)) return null;
  const sql = db();
  const [region] = await sql`SELECT slug, name FROM regions WHERE slug = ${slug}`;
  const [questionnaire] = await sql`SELECT q.id, q.title, q.created_at, q.sent_at, q.risk_id, r.risk_title FROM questionnaires q LEFT JOIN risk_radar r ON r.risk_id = q.risk_id WHERE q.id = ${id}::uuid AND q.region_slug = ${slug}`;
  if (!region || !questionnaire) return null;
  const questions = await sql`SELECT id, type, prompt, options, placeholder FROM questions WHERE questionnaire_id = ${id}::uuid ORDER BY position`;
  const [{ count }] = await sql`SELECT count(*)::int AS count FROM experts WHERE region_slug = ${slug}`;
  return {
    region,
    contacts: count,
    questionnaire: {
      id: questionnaire.id,
      topic: questionnaire.title,
      risk_id: questionnaire.risk_id,
      risk_title: questionnaire.risk_title,
      opened: formatDate(questionnaire.created_at),
      sent: questionnaire.sent_at ? formatDate(questionnaire.sent_at) : "",
      questions: questions.map((question) => ({
        ...question,
        options: question.options ? question.options.split("\n").filter(Boolean) : [],
      })),
    },
  };
}

async function openQuestionnaire(sql, slug, id) {
  if (!isUuid(id)) return null;
  const [item] = await sql`SELECT id, sent_at FROM questionnaires WHERE id = ${id}::uuid AND region_slug = ${slug}`;
  return item || null;
}

export async function addQuestion(slug, questionnaireId, question) {
  const sql = db();
  const item = await openQuestionnaire(sql, slug, questionnaireId);
  if (!item || item.sent_at) return null;
  const id = randomUUID();
  await sql`INSERT INTO questions (id, questionnaire_id, position, type, prompt, options, placeholder)
    VALUES (${id}, ${questionnaireId}::uuid,
      (SELECT COALESCE(MAX(position), 0) + 1 FROM questions WHERE questionnaire_id = ${questionnaireId}::uuid),
      ${question.type}, ${question.prompt}, ${question.options}, ${question.placeholder})`;
  return id;
}

export async function removeQuestion(slug, questionnaireId, questionId) {
  if (!isUuid(questionId)) return null;
  const sql = db();
  const item = await openQuestionnaire(sql, slug, questionnaireId);
  if (!item || item.sent_at) return null;
  const removed = await sql`DELETE FROM questions WHERE id = ${questionId}::uuid AND questionnaire_id = ${questionnaireId}::uuid RETURNING id`;
  return removed.length ? item : null;
}

export async function sendQuestionnaire(slug, questionnaireId) {
  const sql = db();
  const item = await openQuestionnaire(sql, slug, questionnaireId);
  if (!item || item.sent_at) return null;
  const [{ count }] = await sql`SELECT count(*)::int AS count FROM questions WHERE questionnaire_id = ${questionnaireId}::uuid`;
  if (!count) return { error: "questions" };
  const experts = await sql`SELECT id FROM experts WHERE region_slug = ${slug}`;
  if (!experts.length) return { error: "contacts" };
  const inserts = experts.map((expert) => sql`INSERT INTO assignments (id, questionnaire_id, expert_id) VALUES (${randomUUID()}, ${questionnaireId}::uuid, ${expert.id})`);
  await sql.transaction([
    ...inserts,
    sql`UPDATE questionnaires SET sent_at = now() WHERE id = ${questionnaireId}::uuid AND sent_at IS NULL`,
  ]);
  return { recipients: experts.length };
}
