// @ts-check
import { defineConfig } from 'astro/config';
import netlify from '@astrojs/netlify';

// https://astro.build/config
// Pages are pre-built, except the ones showing application rounds
// (`export const prerender = false`): they are created when opened, with the
// rounds published in the team area, and kept by Netlify for a few minutes
// (see liveRounds() in src/data/applications.ts).
export default defineConfig({
  adapter: netlify(),
});
