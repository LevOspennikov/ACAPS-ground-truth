import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { inspect } from 'node:util';
import { sendEmail } from '../src/server/email.js';

const message = {
  to: 'private-recipient@example.org',
  subject: 'Private subject',
  text: 'Private message body',
};
const apiKey = 're_private_test_key';
const from = 'Ground Truth <onboarding@resend.dev>';
const providerSecret = 'Private provider payload';
let previousEnv;

beforeEach((t) => {
  previousEnv = { RESEND_API_KEY: process.env.RESEND_API_KEY, EMAIL_FROM: process.env.EMAIL_FROM };
  process.env.RESEND_API_KEY = apiKey;
  process.env.EMAIL_FROM = from;
  // Every test replaces fetch: no request can reach the network.
  t.mock.method(globalThis, 'fetch', async () => { throw new Error(providerSecret); });
  for (const method of ['log', 'warn', 'error', 'info', 'debug']) {
    t.mock.method(console, method, () => assert.fail('Email helper must not log.'));
  }
});

afterEach(() => {
  for (const [key, value] of Object.entries(previousEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function sanitized(code) {
  return (error) => {
    assert.ok(error instanceof Error);
    assert.equal(error.code, code);
    assert.equal(error.cause, undefined);
    const exposed = `${inspect(error)} ${JSON.stringify(error)}`;
    for (const privateValue of [...Object.values(message), apiKey, from, providerSecret]) {
      assert.ok(!exposed.includes(privateValue), 'Error must not expose private data.');
    }
    return true;
  };
}

test('sends one plain-text recipient and returns only the accepted id', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ id: 'accepted-id', private: providerSecret }));
  assert.deepEqual(await sendEmail(message), { id: 'accepted-id' });
  assert.equal(fetch.mock.callCount(), 1);
  const [url, request] = fetch.mock.calls[0].arguments;
  assert.equal(url, 'https://api.resend.com/emails');
  assert.equal(request.method, 'POST');
  assert.equal(request.redirect, 'error');
  assert.deepEqual(request.headers, { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' });
  assert.deepEqual(JSON.parse(request.body), { from, ...message, to: [message.to] });
  assert.ok(request.signal instanceof AbortSignal);
});

test('forwards optional HTML and idempotency key unchanged', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json({ id: 'accepted-id' }));
  await sendEmail({ ...message, html: '<p>Private HTML</p>', idempotencyKey: 'operation/123' });
  const request = fetch.mock.calls[0].arguments[1];
  assert.equal(request.headers['Idempotency-Key'], 'operation/123');
  assert.equal(JSON.parse(request.body).html, '<p>Private HTML</p>');
});

test('rejects invalid inputs before fetching', async () => {
  const invalid = [
    undefined, null, [], 'message', {},
    ...['', 'a', 'a@@example.org', 'a@example..org', 'a@-example.org',
      '.a@example.org', 'a..b@example.org', 'a@example.org,b@example.org',
      'Name <a@example.org>', 'a@example.org\r\nBcc: b@example.org', 'a@example.org\n', 'a\n@example.org',
      `${'a'.repeat(65)}@example.org`, `a@${'b'.repeat(64)}.org`, ['a@example.org']]
      .map((to) => ({ ...message, to })),
    ...['', '  ', null, 123, 'Subject\r\nBcc: b@example.org']
      .map((subject) => ({ ...message, subject })),
    ...['', '  ', null, 123].map((text) => ({ ...message, text })),
    ...[null, 123, {}].map((html) => ({ ...message, html })),
    ...['', ' ', 'a\nb', 'a\n', 'é', 'a'.repeat(257), null, 123]
      .map((idempotencyKey) => ({ ...message, idempotencyKey })),
  ];
  for (const input of invalid) await assert.rejects(sendEmail(input), sanitized('invalid_input'));
  assert.equal(globalThis.fetch.mock.callCount(), 0);
});

test('accepts plus addressing, multiline text and maximum-length idempotency key', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ id: 'accepted-id' }));
  await sendEmail({ ...message, to: 'first.last+test@sub.example.org', text: 'Line one\nLine two', idempotencyKey: 'a'.repeat(256) });
});

test('requires configuration only when called, and reads it again on each call', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json({ id: 'accepted-id' }));
  for (const key of ['RESEND_API_KEY', 'EMAIL_FROM']) {
    const value = process.env[key];
    for (const missing of ['', '   ', 'bad\r\nvalue', undefined]) {
      if (missing === undefined) delete process.env[key];
      else process.env[key] = missing;
      await assert.rejects(sendEmail(message), sanitized('not_configured'));
    }
    process.env[key] = value;
  }
  assert.equal(fetch.mock.callCount(), 0);
  await sendEmail(message);
  process.env.RESEND_API_KEY = 're_changed_key';
  process.env.EMAIL_FROM = 'Changed <sender@example.org>';
  await sendEmail(message);
  const request = fetch.mock.calls[1].arguments[1];
  assert.equal(request.headers.Authorization, 'Bearer re_changed_key');
  assert.equal(JSON.parse(request.body).from, 'Changed <sender@example.org>');
});

test('sanitizes provider rejections without reading the payload or retrying', async (t) => {
  const json = t.mock.fn(() => assert.fail('Must not read rejection payload.'));
  const fetch = t.mock.method(globalThis, 'fetch', async () => ({ ok: false, json }));
  for (const status of [400, 401, 403, 429, 500]) {
    fetch.mock.mockImplementation(async () => ({ ok: false, status, json, body: providerSecret }));
    await assert.rejects(sendEmail(message), sanitized('provider_rejected'));
  }
  assert.equal(fetch.mock.callCount(), 5);
  assert.equal(json.mock.callCount(), 0);
});

test('network failure has an uncertain outcome and is never retried', async () => {
  await assert.rejects(sendEmail(message), sanitized('send_unconfirmed'));
  assert.equal(globalThis.fetch.mock.callCount(), 1);
});

test('malformed success responses have an uncertain outcome', async (t) => {
  const responses = [
    new Response('not JSON'), new Response(null, { status: 204 }),
    ...[null, [], {}, { id: '' }, { id: '  ' }, { id: 123 }].map((body) => Response.json(body)),
  ];
  const fetch = t.mock.method(globalThis, 'fetch', async () => responses.shift());
  const count = responses.length;
  for (let i = 0; i < count; i++) await assert.rejects(sendEmail(message), sanitized('send_unconfirmed'));
  assert.equal(fetch.mock.callCount(), count);
});

for (const waitingForBody of [false, true]) {
  test(`10-second timeout covers ${waitingForBody ? 'response body' : 'request'} without retries`, async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    let signal;
    const fetch = t.mock.method(globalThis, 'fetch', async (_url, request) => {
      signal = request.signal;
      const pending = () => new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error(providerSecret)), { once: true });
      });
      return waitingForBody ? { ok: true, json: pending } : pending();
    });
    const assertion = assert.rejects(sendEmail(message), sanitized('send_unconfirmed'));
    await Promise.resolve();
    t.mock.timers.tick(9_999);
    assert.equal(signal.aborted, false);
    t.mock.timers.tick(1);
    await assertion;
    assert.equal(signal.aborted, true);
    assert.equal(fetch.mock.callCount(), 1);
  });
}

test('clears the timeout after acceptance or failure', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const signals = [];
  const fetch = t.mock.method(globalThis, 'fetch', async (_url, { signal }) => {
    signals.push(signal);
    return Response.json({ id: 'accepted-id' });
  });
  await sendEmail(message);
  fetch.mock.mockImplementation(async (_url, { signal }) => {
    signals.push(signal);
    throw new Error(providerSecret);
  });
  await assert.rejects(sendEmail(message), sanitized('send_unconfirmed'));
  t.mock.timers.tick(10_000);
  assert.ok(signals.every((signal) => !signal.aborted));
});
