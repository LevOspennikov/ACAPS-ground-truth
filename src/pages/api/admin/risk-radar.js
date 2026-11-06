import { denyUnlessAdmin } from '../../../server/regions.js';
import { reject } from '../../../server/forms.js';
export async function POST({ request, cookies }) {
  const denied = denyUnlessAdmin(request, cookies);
  return denied || reject('The prototype catalog has moved. Add risks under the selected country at /admin.', 410);
}
