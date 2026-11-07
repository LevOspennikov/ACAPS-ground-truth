import test from 'node:test';
import assert from 'node:assert/strict';
import { rating, textField, sameOrigin, contactField, contactHref } from '../src/server/forms.js';

test('ratings accept only scale values or empty drafts', () => {
  for (let i = 1; i <= 5; i++) assert.equal(rating(String(i)), i);
  assert.equal(rating(null), null);
  assert.equal(rating(''), null);
  for (const value of ['0', '6', '1.5', '1junk', '01', 'NaN']) assert.throws(() => rating(value));
});
test('text validates required and bounded fields', () => {
  const form = new FormData();
  form.set('title', ' Example ');
  assert.equal(textField(form, 'title', 20, true), 'Example');
  assert.throws(() => textField(form, 'title', 2));
  form.set('title', '  ');
  assert.throws(() => textField(form, 'title', 20, true));
  assert.throws(() => textField(form, 'missing', 20));
});
test('a contact is an email address or a phone number', () => {
  const form = new FormData();
  form.set('contact', ' expert@example.org ');
  assert.equal(contactField(form), 'expert@example.org');
  assert.equal(contactHref('expert@example.org'), 'mailto:expert@example.org');
  form.set('contact', '+93 70 123 4567');
  assert.equal(contactField(form), '+93 70 123 4567');
  assert.equal(contactHref('+93 70 123 4567'), 'tel:+93701234567');
  for (const value of ['', 'food security', '12', 'not-an-email', '+++']) {
    form.set('contact', value);
    assert.throws(() => contactField(form));
  }
});
test('form mutations require an explicit matching origin', () => {
  const request = (origin) => new Request('https://example.org/api/action', { method: 'POST', headers: origin ? { origin } : {} });
  assert.equal(sameOrigin(request('https://example.org')), true);
  assert.equal(sameOrigin(request('https://evil.example')), false);
  assert.equal(sameOrigin(request('null')), false);
  assert.equal(sameOrigin(request()), false);
});
