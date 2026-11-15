# OneAIM Website

Website and internal tools of OneAIM. Four parts, one repository, one shared Supabase backend.

| Part | Live address | Test address | Code |
|---|---|---|---|
| Main website | `one-aim.org` | `oneaim-test.netlify.app` | `/` (repo root) |
| Team area (team portal) | `team.one-aim.org` | `lambent-rolypoly-19b487.netlify.app` | `portal/` (pages at `/`) |
| Applications | `apply.one-aim.org` | `…lambent…/apply` | `portal/` (pages at `/apply`) |
| Members network | `network.one-aim.org` | `…lambent…/network` | `portal/` (pages at `/network`) |

Until launch, only the main website is live; the other parts run on the test addresses.
Launch steps: [`docs/launch-checklist.md`](docs/launch-checklist.md).

## Sites

**Testing** (branch `branchLucas`; one address with paths instead of subdomains)

| Address | Netlify project | Base directory | Shows |
|---|---|---|---|
| https://oneaim-test.netlify.app | `oneaim-test` | *(root)* | Main website, not indexed by search engines |
| https://lambent-rolypoly-19b487.netlify.app | `lambent-rolypoly-19b487` | `portal` | Team area at `/`, applications at `/apply`, members network at `/network` |

**Production** (branch `main`)

| Address | Netlify project | Base directory | Status |
|---|---|---|---|
| https://one-aim.org | existing one-aim.org project | *(root)* | Live |
| https://team.one-aim.org | new, created at launch | `portal` | Planned |
| https://apply.one-aim.org | new, created at launch | `deploy/apply` | Planned (forwards to the team site's `/apply`) |
| https://network.one-aim.org | new, created at launch | `deploy/network` | Planned (forwards to the team site's `/network`) |

Test and production use the **same Supabase project**: data entered on a test site is real data.

**Dashboards**

| Service | Where |
|---|---|
| Netlify | app.netlify.com (projects above) |
| Supabase | supabase.com/dashboard/project/wenkvkkfmclhycyxnxxu |
| Cloudflare R2 | dash.cloudflare.com → R2 → bucket `oneaim-files` |
| Brevo | app.brevo.com |
| Enable Banking | enablebanking.com → control panel |
| Strato | strato.de → domain one-aim.org (DNS, mailbox) |
| GitHub | github.com/OneAIM-Aachen/HomepageOneAIM (issues: bug reports) |

## Repository

```
src/                 Main website (Astro). Content in src/data/, see CONTENT-GUIDE.md
portal/              Team area, applications, members network (Astro + Preact), one build
deploy/apply|network Forwarding sites: show the portal's /apply and /network on their subdomains
supabase/migrations  Database schema, access rules, server-side functions (SQL)
supabase/functions   Edge functions (TypeScript, Deno)
docs/                Deployment, Supabase setup, launch checklist, portal spec
```

## Services

| Service | Used for | Settings / keys |
|---|---|---|
| **Netlify** | Hosting and builds of all sites | Environment variables per site, see `docs/deployment.md` |
| **Supabase** (EU, Ireland) | Database, logins, access rules, scheduled jobs, edge functions | Project `wenkvkkfmclhycyxnxxu`; keys as Edge Function secrets |
| **Cloudflare R2** (EU) | Files: CVs, receipts, photos | Secrets `R2_*` |
| **Brevo** | Sending emails | Secret `BREVO_API_KEY`; sender and test mode in team area → Settings → Emails |
| **Strato** | Domain/DNS, mailbox (incoming emails via IMAP) | Secrets `IMAP_USER`, `IMAP_PASSWORD` |
| **Enable Banking** | Read-only bank access for Finance | Secrets `ENABLE_BANKING_*` |
| **GitHub** | Code; bug report button → issues | Secret `BUG_REPORT_GITHUB_TOKEN` |

Secrets live only in Supabase (Edge Functions → Secrets), never in the code or in Netlify.
The `PUBLIC_*` variables in Netlify are public values (addresses, on/off switches).

### Edge functions

| Function | Purpose |
|---|---|
| `send-emails` | Sends queued emails (Brevo) |
| `sync-mailbox` | Reads replies from the mailbox (IMAP) into the team area |
| `team-accounts` | Invitations, password resets, network accounts |
| `files` | Upload/download links for R2 |
| `bank` | Bank connection and sync (Enable Banking) |
| `bug-report` | Bug report button → GitHub issue (team area) |

## How the main website gets application rounds

Rounds exist only in the database: created and published in the team area. Home, city
and program pages are rendered on request and cached by Netlify for 5 minutes, so
changes appear without a new build.

## Development

```bash
npm install && npm run dev                        # main website, localhost:4321
cd portal && npm install && npm run dev           # portal, localhost:4400
```

Both need a `.env` with `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY`
(public values, see `portal/.env.example`). Local development uses the real database.

- Work on your own branch (e.g. `branchYourName`), never directly on `main`.
- `branchLucas` builds the test sites; `main` builds the live sites.
- Each Netlify site only rebuilds when its own folder changed.
- Database changes: add a file to `supabase/migrations/`, then `supabase db push`.
  They go live immediately for all sites, test and live.
- Edge functions: `supabase functions deploy <name> --use-api`.

A GitHub Action (`.github/workflows/nightly-build.yml`) rebuilds the main website at
midnight on days when an event in `src/data/eventsData.ts` moves to "past".

## Docs

- [`docs/deployment.md`](docs/deployment.md): sites, addresses, environment variables, going live
- [`docs/supabase-setup.md`](docs/supabase-setup.md): database, emails, secrets, R2, Enable Banking
- [`docs/launch-checklist.md`](docs/launch-checklist.md): steps before, on and after launch
- [`CONTENT-GUIDE.md`](CONTENT-GUIDE.md): editing main website content
