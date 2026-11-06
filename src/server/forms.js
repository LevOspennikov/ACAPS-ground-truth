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
