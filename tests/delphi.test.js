import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { setupEmbedded } from '../db/setup-embedded.js';
import { embeddedSql } from '../src/server/embedded-database.js';
import { startRoundTwo } from '../src/server/delphi.js';
import { expertAssignment, roundTwoAssignment, hash } from '../src/server/auth.js';
import { saveResponse, saveRoundTwoResponse } from '../src/server/responses.js';
import { expertResults } from '../src/server/expert-results.js';
import { questionnaireResults } from '../src/server/results.js';

const cookies = (value) => ({ get: () => ({ value }) });

test('Delphi opening, frozen feedback, authorization, progress and submission locks', async (t) => {
  const database = new PGlite();
  try {
    await setupEmbedded(database);
    const sql = embeddedSql(database);
    const getSql = () => sql;
    const [peer] = await sql`SELECT a.id, a.questionnaire_id, a.expert_id, r.answers
      FROM assignments a JOIN responses r ON r.assignment_id = a.id WHERE r.submitted_at IS NOT NULL LIMIT 1`;
    const [newcomer] = await sql`SELECT a.id, a.expert_id FROM assignments a JOIN experts e ON e.id = a.expert_id WHERE e.pseudonym = 'Local Test Expert'`;
    const session = cookies('peer-session');
    const lateSession = cookies('late-session');
    await sql.transaction([
      sql`INSERT INTO expert_sessions VALUES (${hash('peer-session')}, ${peer.id}, now() + interval '1 day')`,
      sql`INSERT INTO expert_sessions VALUES (${hash('late-session')}, ${newcomer.id}, now() + interval '1 day')`,
    ]);
    const results = (extra = {}) => expertResults(session, { getSql, minimum: '0', ...extra });

    await t.test('single-round behavior remains available before explicit opening', async () => {
      assert.equal((await expertAssignment(session, getSql)).round_two_started_at, null);
      assert.equal((await results()).questions.length, 5);
      assert.equal((await results()).questions[0].total, 8);
      assert.equal(await roundTwoAssignment(session, getSql), null);
      assert.equal(await saveRoundTwoResponse(session, peer.id, peer.answers, 0, false, getSql), false);
      assert.equal(await results({ questionId: 'question-1', frozen: true }), null);
    });

    await t.test('empty or unanswered questionnaires cannot be opened', async () => {
      const id = randomUUID();
      await sql`INSERT INTO questionnaires (id, title, context) VALUES (${id}, 'Unanswered', '')`;
      assert.equal(await startRoundTwo(id, getSql), false);
      assert.equal(await startRoundTwo(randomUUID(), getSql), false);
    });

    await t.test('opening captures only submitted choice aggregates and requires own Round 1 submission', async () => {
      assert.equal(await startRoundTwo(peer.questionnaire_id, getSql), true);
      assert.ok(await roundTwoAssignment(session, getSql));
      assert.equal(await roundTwoAssignment(lateSession, getSql), null);
      assert.equal(await saveRoundTwoResponse(lateSession, newcomer.id, peer.answers, 0, false, getSql), false);
      const [stored] = await sql`SELECT round_one_feedback FROM questionnaires WHERE id = ${peer.questionnaire_id}`;
      assert.ok(stored.round_one_feedback.every((row) => row.question_id !== 'question-6'));
      assert.ok(stored.round_one_feedback.every((row) => Object.keys(row).sort().join() === 'answer,question_id,total'));
    });

    const initial = await results({ questionId: 'question-1', frozen: true });
    await t.test('feedback is limited to the selected question and remains frozen after late submissions and repeated starts', async () => {
      assert.deepEqual(initial.questions.map((q) => q.id), ['question-1']);
      assert.equal(initial.questions[0].total, 8);
      assert.equal(await results({ frozen: true }), null);
      assert.deepEqual((await results({ questionId: 'question-6', frozen: true })).questions, []);
      assert.deepEqual((await results({ questionId: 'other-questionnaire-id', frozen: true })).questions, []);
      assert.equal(await saveResponse(lateSession, newcomer.id, peer.answers, 6, true, getSql), true);
      assert.equal((await results()).questions[0].total, 9);
      assert.equal(await startRoundTwo(peer.questionnaire_id, getSql), true);
      assert.deepEqual(await results({ questionId: 'question-1', frozen: true }), initial);
      assert.ok(await roundTwoAssignment(lateSession, getSql));
    });

    await t.test('privacy suppression uses the frozen cohort and never returns hidden counts', async () => {
      const withheld = await results({ questionId: 'question-1', frozen: true, minimum: '9' });
      assert.equal(withheld.questions[0].withheld, true);
      assert.equal('options' in withheld.questions[0], false);
      assert.equal('total' in withheld.questions[0], false);
      await assert.rejects(results({ questionId: 'question-1', frozen: true, minimum: '-1' }));
    });

    await t.test('Round 2 saves are scoped and submitted answers cannot be overwritten', async () => {
      assert.equal(await saveRoundTwoResponse(session, newcomer.id, peer.answers, 0, false, getSql), false);
      assert.equal(await saveRoundTwoResponse(session, peer.id, peer.answers, 2, false, getSql), true);
      assert.equal((await roundTwoAssignment(session, getSql)).round_two_progress_step, 2);
      let report = await questionnaireResults(peer.questionnaire_id, getSql);
      assert.deepEqual(report.roundTwo, { eligible: 9, drafts: 1, submitted: 0 });
      assert.equal(await saveRoundTwoResponse(session, peer.id, peer.answers, 6, true, getSql), true);
      assert.equal(await saveRoundTwoResponse(session, peer.id, {}, 0, false, getSql), false);
      assert.deepEqual((await roundTwoAssignment(session, getSql)).round_two_answers, peer.answers);
      assert.deepEqual((await expertAssignment(session, getSql)).answers, peer.answers);
      report = await questionnaireResults(peer.questionnaire_id, getSql);
      assert.deepEqual(report.roundTwo, { eligible: 9, drafts: 0, submitted: 1 });
    });

    await t.test('expired or deactivated sessions cannot load, save or view feedback', async () => {
      await sql`UPDATE expert_sessions SET expires_at = now() - interval '1 minute' WHERE assignment_id = ${newcomer.id}`;
      assert.equal(await roundTwoAssignment(lateSession, getSql), null);
      await sql`UPDATE experts SET active = false WHERE id = ${peer.expert_id}`;
      assert.equal(await roundTwoAssignment(session, getSql), null);
      assert.equal(await saveRoundTwoResponse(session, peer.id, {}, 0, false, getSql), false);
      assert.equal(await results({ questionId: 'question-1', frozen: true }), null);
    });
  } finally { await database.close(); }
});

test('additive migration preserves existing reassessments and captures feedback only once', async () => {
  const database = new PGlite();
  try {
    await setupEmbedded(database);
    const sql = embeddedSql(database);
    const [peer] = await sql`SELECT assignment_id, answers FROM responses LIMIT 1`;
    await sql`INSERT INTO round_two_responses (assignment_id, answers) VALUES (${peer.assignment_id}, ${JSON.stringify(peer.answers)}::jsonb)`;
    const schema = await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8');
    await database.exec(schema);
    const [initial] = await sql`SELECT round_two_started_at, round_one_feedback FROM questionnaires LIMIT 1`;
    assert.ok(initial.round_two_started_at);
    assert.ok(initial.round_one_feedback.length);
    await database.exec(schema);
    assert.deepEqual((await sql`SELECT round_two_started_at, round_one_feedback FROM questionnaires LIMIT 1`)[0], initial);
    assert.deepEqual((await sql`SELECT answers FROM round_two_responses WHERE assignment_id = ${peer.assignment_id}`)[0].answers, peer.answers);
  } finally { await database.close(); }
});
