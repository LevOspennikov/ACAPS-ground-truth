import { textField } from './forms.js';
export function profileFields(form) {
  const pseudonym = textField(form, 'pseudonym', 100, true);
  const mode = form.get('profile_mode');
  if (!['named', 'anonymous'].includes(mode)) throw new Error('Choose named or anonymous.');
  const name = textField(form, 'name', 150);
  const email = textField(form, 'email', 254);
  if (mode === 'anonymous' && (name || email)) throw new Error('Anonymous profiles cannot store name or email. Clear those fields, or choose named.');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');
  return { pseudonym, mode, name: name || null, email: email || null };
}
