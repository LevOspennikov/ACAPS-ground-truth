import { shouldResetDatabase, resetPrototypeDatabase } from './prototype-reset.js';

if (shouldResetDatabase(process.env)) {
  console.log('Prototype reset enabled: recreating all application tables.');
  await resetPrototypeDatabase(process.env);
  console.log('Prototype database reset complete.');
} else {
  console.log('Database preserved. Reset requires RESET_DATABASE_ON_DEPLOY=true on Vercel production.');
}
