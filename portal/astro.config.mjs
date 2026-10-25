// @ts-check
import { defineConfig } from "astro/config";
import preact from "@astrojs/preact";

// Prototype of team.one-aim.org (/team/…) and apply.one-aim.org (/apply/…).
// The design tokens are imported from the main site (../src/styles), so the
// parent folder has to be readable for the dev server.
export default defineConfig({
  integrations: [preact()],
  vite: {
    server: { fs: { allow: [".."] } },
  },
});
