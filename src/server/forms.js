const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isEmail(value) {
  return emailPattern.test(value);
}

export function isPhone(value) {
  if (!/^[+0-9() ./-]+$/.test(value)) return false;
  const digits = value.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

export function contactField(form) {
  const value = textField(form, "contact", 120, true);
  if (!isEmail(value) && !isPhone(value)) throw new Error("Enter an email address or a phone number.");
  return value;
}

export function contactHref(value) {
  if (value.includes("@")) return `mailto:${value}`;
  return `tel:${value.replace(/[^\d+]/g, "")}`;
}

export function textField(form, name, max, required = false) {
  const value = form.get(name);
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new Error('Please check the form fields.');
  return value.trim();
}
export function sameOrigin(request) {
  return request.headers.get('origin') === new URL(request.url).origin;
}
export const redirect = (url) => new Response(null, { status: 303, headers: { Location: url } });
export const reject = (message, status = 400) => new Response(message, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
