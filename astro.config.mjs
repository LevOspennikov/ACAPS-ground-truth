import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

export default defineConfig({
  output: 'server',
  adapter: vercel(),
  // Keep production CSS compatible with style-src 'self'.
  build: { inlineStylesheets: 'never' },
});
