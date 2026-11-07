import { env } from 'node:process';

const messages = {
  not_configured: 'Email sending is not configured.',
  invalid_input: 'Email input is invalid.',
  provider_rejected: 'The email provider rejected the request.',
  send_unconfirmed: 'Email sending could not be confirmed. The message may have been accepted.',
};

function emailError(code) {
  return Object.assign(new Error(messages[code]), { code });
}

const nonempty = (value) => typeof value === 'string' && value.trim().length > 0;

// A single bare address: no display names, lists, quoted local parts or controls.
function validRecipient(value) {
  if (typeof value !== 'string' || value.length > 254 || /[\s\x00-\x1f\x7f]/.test(value)) return false;
  const parts = value.split('@');
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  return local.length <= 64 && /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/.test(local)
    && domain.includes('.') && domain.split('.').every((label) =>
      label.length <= 63 && /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(label));
}

/**
 * Server-only, standalone Resend sender. Configuration is read at call time.
 * Returns { id } on provider acceptance; this does not confirm inbox delivery.
 * Throws an Error with code: not_configured, invalid_input, provider_rejected,
 * or send_unconfirmed. No retries; reuse an idempotency key for caller retries.
 */
export async function sendEmail(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw emailError('invalid_input');
  }
  const { to, subject, text, html, idempotencyKey } = input;
  if (!validRecipient(to) || !nonempty(subject) || /[\r\n\x00]/.test(subject)
    || !nonempty(text) || (html !== undefined && typeof html !== 'string')
    || (idempotencyKey !== undefined && (typeof idempotencyKey !== 'string'
      || idempotencyKey.length < 1 || idempotencyKey.length > 256 || /[^\x21-\x7e]/.test(idempotencyKey)))) {
    throw emailError('invalid_input');
  }

  const apiKey = env.RESEND_API_KEY;
  const from = env.EMAIL_FROM;
  if (!nonempty(apiKey) || !nonempty(from) || /[\r\n\x00]/.test(apiKey + from)) {
    throw emailError('not_configured');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  let response;
  let result;
  try {
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      redirect: 'error',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...(idempotencyKey === undefined ? {} : { 'Idempotency-Key': idempotencyKey }),
      },
      body: JSON.stringify({ from, to: [to], subject, text, ...(html === undefined ? {} : { html }) }),
      signal: controller.signal,
    });
    // Never read or attach provider error payloads, which may include private data.
    if (response.ok) result = await response.json();
  } catch {
    throw emailError('send_unconfirmed');
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) throw emailError('provider_rejected');
  if (!nonempty(result?.id)) throw emailError('send_unconfirmed');
  return { id: result.id };
}
