# Deployment: main website, team area, applications, network site

The website consists of four parts. Each has its own address; Supabase (database,
logins, server functions) is shared.

| Part | Live address | Test address (Netlify) | Built from |
|---|---|---|---|
| Main website | `one-aim.org` | `oneaim-test.netlify.app` | repo root (`npm run build` → `dist`) |
| Team area | `team.one-aim.org` | `lambent-rolypoly-19b487.netlify.app` | `portal/` (team pages at `/`) |
| Applications | `apply.one-aim.org` | `oneaim-test-apply.netlify.app` | `deploy/apply` → shows the portal's `/apply` pages |
| Network site | `network.one-aim.org` | `oneaim-test-network.netlify.app` | `deploy/network` → shows the portal's `/network` pages |

The portal is built once. The apply and network sites have no pages of their own:
`deploy/proxy.mjs` writes Netlify rules that show the portal's `/apply` and
`/network` pages at their address (the address in the browser stays the same).
Each site only rebuilds when its own folder changed (`ignore` in the `netlify.toml` files).

## Settings (Netlify → Site configuration → Environment variables)

**Portal site** (team area) and **main website**:

```
PUBLIC_SITE_URL     = address of the main website
PUBLIC_TEAM_URL     = address of the team area
PUBLIC_APPLY_URL    = address of the applications
PUBLIC_NETWORK_URL  = address of the network site
```

All links between the parts are built from these (`portal/src/lib/areas.ts`;
main website: `src/data/applications.ts` for “Apply”, `navData.ts` / `Footer.astro`
for “Member network”). Without them (local development) the portal runs on one
address: team at `/`, applications at `/apply`, network at `/network`.

Additionally:
- Portal: `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`; `PUBLIC_INDEXABLE = true`
  **only live** (lets search engines list the application pages; team area and
  network site are never listed).
- Main website test copy: `PUBLIC_NOINDEX = true` (keeps it out of search engines).
- Apply / network sites: `PORTAL_URL` = address of the portal site.

**Email links** (Supabase, table `email_settings`): `team_url`, `apply_url`,
`network_url` with the same addresses. Booking and feedback links use `apply_url`,
team invitations / password / yearly check `team_url`, network welcome `network_url`.

## Test setup (once)

1. **Main website test site**: Netlify → Add new site → Import from GitHub
   `OneAIM-Aachen/HomepageOneAIM`, branch `branchLucas`, base directory *(empty)*,
   build command `npm run build`, publish `dist`. Name e.g. `oneaim-test`.
   Environment: `PUBLIC_APPLY_URL`, `PUBLIC_NETWORK_URL`, `PUBLIC_NOINDEX = true`.
2. **Apply site**: same import, base directory `deploy/apply` (build command and
   publish directory come from its `netlify.toml`). Name e.g. `oneaim-test-apply`.
   Environment: `PORTAL_URL = https://lambent-rolypoly-19b487.netlify.app`.
3. **Network site**: same, base directory `deploy/network`, e.g. `oneaim-test-network`,
   same `PORTAL_URL`.
4. **Portal site** (existing, base directory `portal`): add the four `PUBLIC_*_URL`
   settings, trigger a new deploy.
5. **Cloudflare R2**: add the test addresses to the bucket's CORS policy
   (applicants upload CVs from the apply address).
6. **Supabase** `email_settings`: `team_url`, `apply_url`, `network_url` = test addresses.

## Going live

1. Merge `branchLucas` into `main` (portal and forwarding sites then build from `main`).
2. Portal site for `main` with the domain `team.one-aim.org`; apply and network
   sites for `main` with `apply.one-aim.org` and `network.one-aim.org`
   (their `PORTAL_URL = https://team.one-aim.org`).
3. Settings with the real addresses on the portal and the main website,
   `PUBLIC_INDEXABLE = true` on the portal; remove `PUBLIC_DEMO_MODE` from `portal/netlify.toml`.
4. DNS: `team`, `apply`, `network` as CNAME to the Netlify sites (Netlify shows the targets).
5. Supabase `email_settings` with the real addresses; Enable Banking redirect URL
   `https://team.one-aim.org/bank-callback`.

Old portal addresses (`/team/…`, `/portal/…`, `/members/…`) are forwarded by
`portal/public/_redirects`, so links in emails sent earlier keep working.
