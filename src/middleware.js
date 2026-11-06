import { defineMiddleware } from 'astro:middleware';
export const onRequest = defineMiddleware(async (_context, next) => {
  const response = await next();
  response.headers.set('Cache-Control', 'no-store');
  // Hide paths and invitation tokens while preserving Origin on native form
  // submissions. no-referrer makes browsers send Origin: null on these POSTs.
  response.headers.set('Referrer-Policy', 'strict-origin');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  // Vite injects styles and development tools inline. Enforce the production
  // policy only on builds, where Astro emits external stylesheets.
  if (import.meta.env.PROD) {
    response.headers.set('Content-Security-Policy', "default-src 'self'; style-src 'self'; script-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
  }
  return response;
});
