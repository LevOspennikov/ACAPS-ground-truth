import test from 'node:test';
import assert from 'node:assert/strict';
import { validateQuestions, validateAnswer, firstUnanswered, answerLabel, describeAnswers } from '../src/server/answers.js';
import { profileFields } from '../src/server/profiles.js';
const questions = [{id:'risk',type:'single',prompt:'Risk?',options:['Low','High']},{id:'context',type:'text',prompt:'Context?'}];
test('answers must match the assigned question snapshot', () => {
  assert.equal(validateAnswer(questions[0], 'risk-1'), 'risk-1');
  for (const value of ['other-1','risk-2','risk--1']) assert.throws(() => validateAnswer(questions[0], value));
  assert.throws(() => validateAnswer(questions[1], 'x'.repeat(4001)));
  assert.equal(answerLabel(questions[0], 'risk-1'), 'High');
});
test('submission finds missing required answers and supports optional text', () => {
  assert.equal(firstUnanswered(questions, {}), 0);
  assert.equal(firstUnanswered(questions, {risk:'risk-0'}), 1);
  assert.equal(firstUnanswered(questions, {risk:'risk-0',context:'Evidence'}), 2);
  assert.equal(firstUnanswered([questions[0], {...questions[1],required:false}],{risk:'risk-0'}),2);
});
test('submitted answers are shown with the option the expert chose', () => {
  const lines = describeAnswers(questions, { risk: 'risk-1', context: 'Roads closed' });
  assert.deepEqual(lines, [{ prompt: 'Risk?', value: 'High' }, { prompt: 'Context?', value: 'Roads closed' }]);
  assert.deepEqual(describeAnswers(JSON.stringify(questions), JSON.stringify({ risk: 'risk-0' }))[0], { prompt: 'Risk?', value: 'Low' });
  assert.deepEqual(describeAnswers([], { note: 'Kept' }), [{ prompt: 'Answer', value: 'Kept' }]);
});
test('templates reject duplicate ids and unsupported types', () => {
  assert.equal(validateQuestions(questions),questions);
  assert.throws(() => validateQuestions([...questions,questions[0]]));
  assert.throws(() => validateQuestions([{id:'a',type:'single',prompt:'A',options:['one']}]));
});
test('anonymous profiles cannot retain name or email', () => {
  const form=new FormData();
  for(const [key,value] of Object.entries({pseudonym:'Expert A',profile_mode:'anonymous',name:'',email:''}))form.set(key,value);
  assert.equal(profileFields(form).email,null);
  form.set('email','synthetic@example.test');assert.throws(() => profileFields(form));
  form.set('profile_mode','named');assert.equal(profileFields(form).email,'synthetic@example.test');
  form.set('email','bad-address');assert.throws(() => profileFields(form));
});
