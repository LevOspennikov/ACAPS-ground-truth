import { randomUUID } from 'node:crypto';
import { db } from '../../../../server/db.js';
import { cookieOptions, denyUnlessAdmin } from '../../../../server/auth.js';
import { textField, redirect, reject } from '../../../../server/forms.js';
import { readCoverage, coverageQueries } from '../../../../server/coverage.js';
import { profileFields } from '../../../../server/profiles.js';
import { validId, createQuestionnaire, assignQuestionnaire, generateInvitation, setUserActive } from '../../../../server/management.js';

export async function POST({ request, cookies, params }) {
  const denied = denyUnlessAdmin(request, cookies);
  if (denied) return denied;
  const form = await request.formData();
  const sql = db();
  const idField = (name) => {
    const id = form.get(name);
    if (!validId(id)) throw new Error('Choose a valid record.');
    return id;
  };
  const title = () => textField(form, 'title', 180, true);
  let destination = '/admin';
  try {
    switch (params.action) {
      case 'user-create': {
        const p = profileFields(form);
        const id = randomUUID();
        const coverage = await readCoverage(form);
        await sql.transaction([sql`INSERT INTO experts (id, pseudonym, profile_mode, name, email, region_slug) VALUES (${id}, ${p.pseudonym}, ${p.mode}, ${p.name}, ${p.email}, ${coverage[0].region})`, ...coverageQueries(sql, id, coverage)]);
        destination = `/admin/users/${id}`;
        break;
      }
      case 'user-edit': {
        const id = idField('user');
        const p = profileFields(form);
        const [existing] = await sql`SELECT profile_mode FROM experts WHERE id = ${id}`;
        if (!existing) return reject('User not found.', 404);
        if (existing.profile_mode === 'named' && p.mode === 'anonymous' && form.get('confirm_anonymous') !== 'yes') throw new Error('Confirm that switching to anonymous permanently removes the stored name and email.');
        const coverage = await readCoverage(form);
        await sql.transaction([sql`UPDATE experts SET pseudonym = ${p.pseudonym}, profile_mode = ${p.mode}, name = ${p.name}, email = ${p.email}, region_slug = ${coverage[0].region} WHERE id = ${id}`, ...coverageQueries(sql, id, coverage)]);
        destination = `/admin/users/${id}`;
        break;
      }
      case 'user-status': {
        const id = idField('user');
        const active = form.get('active');
        if (!['true', 'false'].includes(active)) throw new Error('Choose a valid status.');
        await setUserActive(id, active === 'true');
        destination = `/admin/users/${id}`;
        break;
      }
      case 'category-create':
        await sql`INSERT INTO categories (id, name) VALUES (${randomUUID()}, ${textField(form, 'name', 100, true)})`;
        destination = '/admin/crises';
        break;
      case 'category-edit': {
        const id = idField('category');
        const archived = form.get('archived');
        if (!['true', 'false'].includes(archived)) throw new Error('Choose a valid status.');
        const [updated] = await sql`UPDATE categories SET name = ${textField(form, 'name', 100, true)}, archived = ${archived === 'true'} WHERE id = ${id} RETURNING id`;
        if (!updated) return reject('Category not found.', 404);
        destination = '/admin/crises';
        break;
      }
      case 'crisis-create': {
        const id = randomUUID();
        const category = idField('category');
        const [created] = await sql`INSERT INTO crises (id, category_id, title, description, country)
          SELECT ${id}, id, ${title()}, ${textField(form, 'description', 4000)}, ${textField(form, 'country', 100, true)} FROM categories WHERE id = ${category} AND archived = false RETURNING id`;
        if (!created) throw new Error('Choose an active category.');
        destination = `/admin/crises/${id}`;
        break;
      }
      case 'crisis-edit': {
        const id = idField('crisis');
        const category = idField('category');
        const [updated] = await sql`UPDATE crises c SET title = ${title()}, description = ${textField(form, 'description', 4000)}, country = ${textField(form, 'country', 100, true)}, category_id = ${category}
          WHERE c.id = ${id} AND EXISTS(SELECT 1 FROM categories k WHERE k.id = ${category} AND (k.archived = false OR k.id = c.category_id)) RETURNING c.id`;
        if (!updated) throw new Error('Crisis not found or category is archived.');
        destination = `/admin/crises/${id}`;
        break;
      }
      case 'crisis-status': {
        const id = idField('crisis');
        const archived = form.get('archived');
        if (!['true', 'false'].includes(archived)) throw new Error('Choose a valid status.');
        const [updated] = await sql`UPDATE crises SET archived = ${archived === 'true'} WHERE id = ${id} RETURNING id`;
        if (!updated) return reject('Crisis not found.', 404);
        destination = `/admin/crises/${id}`;
        break;
      }
      case 'questionnaire-create': {
        const crisis = idField('crisis');
        await createQuestionnaire(crisis, title(), textField(form, 'context', 4000, true));
        destination = `/admin/crises/${crisis}`;
        break;
      }
      case 'assign': {
        const user = idField('user');
        await assignQuestionnaire(user, idField('questionnaire'));
        destination = `/admin/users/${user}`;
        break;
      }
      case 'invite': {
        const assignment = idField('assignment');
        const [record] = await sql`SELECT expert_id FROM assignments WHERE id = ${assignment}`;
        if (!record) return reject('Assignment not found.', 404);
        const invitation = await generateInvitation(assignment, new URL(request.url).origin);
        cookies.set('new-invitation', invitation.token, { ...cookieOptions, path: '/admin', maxAge: 300 });
        cookies.set('invitation-email-status', invitation.emailStatus, { ...cookieOptions, path: '/admin', maxAge: 300 });
        destination = `/admin/users/${record.expert_id}`;
        break;
      }
      default: return reject('Action not found.', 404);
    }
  } catch (error) {
    if (error.code === '23505') return reject('That category name already exists. Go back and choose another name.');
    // Do not expose database errors, queries, or identity fields.
    if (error.code || !error.message || error.message.includes('fetch')) return reject('Could not save this change. Check the database connection and retry.', 503);
    const safeMessages = ['Choose', 'Enter', 'Please', 'Anonymous', 'Confirm', 'Crisis', 'No active', 'Questionnaire', 'Invalid', 'Answers'];
    return reject(safeMessages.some((prefix) => error.message.startsWith(prefix)) ? `${error.message} Go back to edit the form.` : 'Could not save this change. Go back and check the form.');
  }
  return redirect(destination + '?saved=1');
}
