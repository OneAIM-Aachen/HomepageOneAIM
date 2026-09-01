# OneAIM Website

The website of OneAIM (one-aim.org), built with [Astro](https://astro.build) as a static site.

## Hosting

The site is hosted on **Netlify**. Every push to `main` triggers an automatic
build and deploy (`npm run build`, output in `dist/`). The domain
`one-aim.org` points to Netlify via DNS records managed at Strato.

## Making changes

1. Work on your **own branch** (e.g. `branchYourName`), never directly on `main`.
2. Test locally:

   ```bash
   npm install
   npm run dev
   ```

3. When your changes are ready, merge your branch into `main` and push.
   Netlify picks it up and the live site updates automatically within a
   minute or two.

Most content (team, partners, news, events, application rounds, city pages)
lives in the databases under `src/data/`. See **CONTENT-GUIDE.md** for how to
edit them without touching any components.

Note: A GitHub Action (`.github/workflows/nightly-build.yml`) pushes an
empty commit to `main` every night, so that e.g. new applications that
have opened or closed, are live by the next morning.
