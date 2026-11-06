import test from 'node:test';
import assert from 'node:assert/strict';
import { textField, sameOrigin } from '../src/server/forms.js';

test('text validates required and bounded fields', () => {
  const form = new FormData();
  form.set('title', ' Example ');
  assert.equal(textField(form, 'title', 20, true), 'Example');
  assert.throws(() => textField(form, 'title', 2));
  form.set('title', '  ');
  assert.throws(() => textField(form, 'title', 20, true));
  assert.throws(() => textField(form, 'missing', 20));
});
test('form mutations require an explicit matching origin', () => {
  const request = (origin) => new Request('https://example.org/api/action', { method: 'POST', headers: origin ? { origin } : {} });
  assert.equal(sameOrigin(request('https://example.org')), true);
  assert.equal(sameOrigin(request('https://evil.example')), false);
  assert.equal(sameOrigin(request('null')), false);
  assert.equal(sameOrigin(request()), false);
});
