export function textField(form, name, max, required = false) {
  const value = form.get(name);
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new Error('Please check the form fields.');
  return value.trim();
}
export function rating(value) {
  if (value === '' || value === null) return null;
  if (!/^[1-5]$/.test(String(value))) throw new Error('Choose a rating between 1 and 5.');
  return Number(value);
}
export function sameOrigin(request) {
  return request.headers.get('origin') === new URL(request.url).origin;
}
export const redirect = (url) => new Response(null, { status: 303, headers: { Location: url } });
export const reject = (message, status = 400) => new Response(message, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
