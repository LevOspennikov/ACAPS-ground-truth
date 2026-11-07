import test from 'node:test';
import assert from 'node:assert/strict';
import { emailInvitation, invitationEmailMessages } from '../src/server/invitation-email.js';

const invitation = {
  expert: { active: true, profile_mode: 'named', email: 'synthetic@example.org' },
  token: 'a'.repeat(64),
  title: 'Synthetic questionnaire',
  origin: 'https://ground-truth.example.org',
};

test('named expert receives the exact single-use invitation link with expiry information', async (t) => {
  const send = t.mock.fn(async () => ({ id: 'provider-id' }));
  assert.equal(await emailInvitation(invitation, send), 'accepted');
  assert.equal(send.mock.callCount(), 1);
  const [message] = send.mock.calls[0].arguments;
  assert.equal(message.to, invitation.expert.email);
  assert.ok(message.text.includes(`${invitation.origin}/invite?token=${invitation.token}`));
  assert.ok(message.text.includes(invitation.title));
  assert.match(message.text, /works once and expires in 48 hours/);
  assert.match(message.text, /confirm to continue/);
  assert.ok(!message.subject.includes(invitation.token));
  assert.ok(!message.idempotencyKey.includes(invitation.token));
  assert.ok(!message.idempotencyKey.includes(invitation.expert.email));
});

test('anonymous, inactive and email-less experts never trigger a send', async (t) => {
  const send = t.mock.fn(() => assert.fail('Must not send email.'));
  for (const [expert, expected] of [
    [{ ...invitation.expert, profile_mode: 'anonymous' }, 'anonymous'],
    [{ ...invitation.expert, profile_mode: 'unknown' }, 'anonymous'],
    [{ ...invitation.expert, active: false }, 'inactive'],
    [undefined, 'inactive'],
    [{ ...invitation.expert, email: null }, 'no_email'],
    [{ ...invitation.expert, email: '' }, 'no_email'],
  ]) assert.equal(await emailInvitation({ ...invitation, expert }, send), expected);
  assert.equal(send.mock.callCount(), 0);
});

test('retries of the same invitation reuse a key; regenerated links use different keys', async (t) => {
  const send = t.mock.fn(async () => ({ id: 'provider-id' }));
  await emailInvitation(invitation, send);
  await emailInvitation(invitation, send);
  await emailInvitation({ ...invitation, token: 'b'.repeat(64) }, send);
  const messages = send.mock.calls.map((call) => call.arguments[0]);
  assert.deepEqual(messages[0], messages[1]);
  assert.notEqual(messages[0].idempotencyKey, messages[2].idempotencyKey);
});

test('email failures return sanitized states and leave the generated link available', async () => {
  const privatePayload = `provider payload: ${invitation.expert.email} ${invitation.token}`;
  for (const [code, expected] of [
    ['not_configured', 'not_configured'], ['invalid_input', 'invalid_input'],
    ['provider_rejected', 'provider_rejected'], ['send_unconfirmed', 'send_unconfirmed'],
    ['unexpected_error', 'send_unconfirmed'], [undefined, 'send_unconfirmed'],
  ]) {
    let attempts = 0;
    const result = await emailInvitation(invitation, async () => {
      attempts++;
      throw Object.assign(new Error(privatePayload), { code });
    });
    assert.equal(result, expected);
    assert.equal(attempts, 1);
    assert.ok(!invitationEmailMessages[result].includes(privatePayload));
    assert.equal(invitation.token, 'a'.repeat(64));
  }
  assert.match(invitationEmailMessages.accepted, /delivery is not confirmed/);
  assert.match(invitationEmailMessages.send_unconfirmed, /may have been accepted/);
});

test('bad origin cannot throw away a saved invitation or send a malformed link', async (t) => {
  const send = t.mock.fn(() => assert.fail('Must not send malformed link.'));
  assert.equal(await emailInvitation({ ...invitation, origin: 'invalid' }, send), 'send_unconfirmed');
  assert.equal(send.mock.callCount(), 0);
});

test('mixed recipients retain independent outcomes', async (t) => {
  const send = t.mock.fn(async ({ to }) => {
    if (to === 'rejected@example.org') throw Object.assign(new Error('Private details'), { code: 'provider_rejected' });
    return { id: 'accepted-id' };
  });
  const experts = [invitation.expert, { ...invitation.expert, profile_mode: 'anonymous' }, { ...invitation.expert, email: 'rejected@example.org' }];
  const statuses = await Promise.all(experts.map((expert) => emailInvitation({ ...invitation, expert }, send)));
  assert.deepEqual(statuses, ['accepted', 'anonymous', 'provider_rejected']);
  assert.equal(send.mock.callCount(), 2);
});
