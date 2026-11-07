import { randomUUID } from 'node:crypto';
import { countrySlug } from '../src/data/countries.js';
import { demoQuestionnaire, demoQuestions, demoExperts, buildAnswers } from '../src/data/demo.js';

// Seed synthetic experts, an Afghanistan questionnaire, and submitted responses
// when no experts or questionnaires exist yet. Real data is never overwritten.
export async function seedDemoData(sql) {
  const [{ experts }] = await sql`SELECT count(*)::int AS experts FROM experts`;
  const [{ questionnaires }] = await sql`SELECT count(*)::int AS questionnaires FROM questionnaires`;
  if (experts > 0 || questionnaires > 0) return { seeded: false };

  const regionSlug = countrySlug(demoQuestionnaire.country);
  const risks = await sql`SELECT risk_id FROM risk_radar WHERE region_slug = ${regionSlug}`;
  if (!risks.length) throw new Error(`No risks seeded for ${demoQuestionnaire.country}.`);
  const riskId = risks.some((risk) => risk.risk_id === demoQuestionnaire.riskId) ? demoQuestionnaire.riskId : risks[0].risk_id;

  const questionnaireId = randomUUID();
  const storedQuestions = demoQuestions.map((question) => ({
    id: question.id,
    type: question.type,
    prompt: question.prompt,
    options: question.type === 'single' ? question.options : [],
    placeholder: question.type === 'text' ? question.placeholder : '',
  }));

  const queries = [
    sql`INSERT INTO questionnaires (id, title, context, region_slug, risk_id, questions, sent_at)
      VALUES (${questionnaireId}, ${demoQuestionnaire.title}, ${demoQuestionnaire.context}, ${regionSlug}, ${riskId}, ${JSON.stringify(storedQuestions)}::jsonb, now())`,
  ];
  demoExperts.forEach((expert, index) => {
    const expertId = randomUUID();
    const assignmentId = randomUUID();
    queries.push(
      sql`INSERT INTO experts (id, pseudonym, profile_mode) VALUES (${expertId}, ${expert.pseudonym}, 'anonymous')`,
      sql`INSERT INTO expert_countries (expert_id, region_slug, risk_scope) VALUES (${expertId}, ${regionSlug}, 'all')`,
      sql`INSERT INTO assignments (id, questionnaire_id, expert_id) VALUES (${assignmentId}, ${questionnaireId}, ${expertId})`,
      sql`INSERT INTO responses (assignment_id, answers, progress_step, submitted_at)
        VALUES (${assignmentId}, ${JSON.stringify(buildAnswers(demoQuestions, expert))}::jsonb, ${demoQuestions.length}, now() - (${index}::int * interval '1 hour'))`,
    );
  });
  await sql.transaction(queries);
  return { seeded: true, questionnaireId, experts: demoExperts.length };
}
