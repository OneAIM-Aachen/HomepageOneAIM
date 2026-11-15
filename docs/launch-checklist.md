# Launch checklist

Everything between today's test setup and the live website with the team, apply and
members network subdomains. Work top to bottom: part 1 can happen any time, part 2 on
launch day, part 3 right after. Details for each step: `docs/deployment.md` and
`docs/supabase-setup.md`.

## 1. Before launch

On the test sites (lambent, oneaim-test). Nothing here touches one-aim.org.

### Finish and test

- [ ] **Push the local changes and check them on the test sites:** Members network in the menu, sign-in text, page titles, research groups as free text.
- [ ] **Test a full application end to end:** apply with a CV via the apply site, screen, invite, book an interview slot, accept or reject. Check every email and its links.
- [ ] **Test participant feedback:** set up a feedback round, use "Send now", fill in the form from the email.
- [ ] **Test the members network:** welcome email, first login, edit "My profile" (including research groups and publications), see other profiles.
- [ ] **Test finance:** submit a claim with a receipt, approve with a second person (four-eyes), export the SEPA file, mark paid.
- [ ] **Test team accounts:** invite a member, set password via `/welcome`, "Forgot password?", yearly check-in.
- [ ] **Decide on the old rounds in the website code:** the Tally rounds in `src/data/applications.ts` are all closed. Keep them as history or remove them; new rounds come from the team area.

### Legal and privacy

- [ ] **Update the privacy policy (Datenschutzerklärung):** name every service that processes personal data: Supabase (database, EU/Ireland), Cloudflare R2 (files, EU), Brevo (emails), Netlify (hosting), Enable Banking (bank data). Describe what applicants' data is kept, why and for how long.
- [ ] **Sign data processing agreements (AVV/DPA)** with Supabase, Cloudflare, Brevo and Netlify (each offers one in their dashboard or on request).
- [ ] **Decide how long applicant data is kept,** e.g. rejected applicants deleted after 12 months. Then delete accordingly, or set up a cleanup job.
- [ ] **Check the consent text on the application form:** it should link to the updated privacy policy.
- [ ] **Self-host the Google Fonts:** the team, apply and network pages load Raleway from Google's servers. German courts have ruled that this needs consent; serving the font file from our own site avoids it.

### Accounts and services

- [ ] **Turn off public sign-ups in Supabase:** Authentication → Sign In / Providers → Email → "Allow new users to sign up" off. Only invited team accounts may exist.
- [ ] **Decide on the Supabase plan:** the free plan has no automatic backups and pauses projects with no activity for a week. Pro (about $25/month) adds daily backups. Real applicant data argues for Pro, or at least a regular manual export.
- [ ] **Create the sender address applications@one-aim.org:** mailbox at Strato, add it as sender in Brevo (the domain is already authenticated).
- [ ] **Point the inbox sync to the new address:** set `IMAP_USER` / `IMAP_PASSWORD` for applications@one-aim.org yourself, then reset the sync (see `supabase-setup.md`).
- [ ] **Read through all email texts:** Settings → Emails and each application's email templates (invitation, booking, decisions, feedback, network welcome).
- [ ] **Spam protection for the public form (recommended),** e.g. Cloudflare Turnstile, so bots can't flood the CRM.
- [ ] **Decide how to test after launch:** test and live sites share one Supabase database, so test applications land in real data. Either name tests clearly and delete them, or set up a second Supabase project for testing.

## 2. Launch day

In this order. Turn email test mode off last, once the links point to the real addresses.

### Code

- [ ] **Merge `branchLucas` into `main`** via a pull request on GitHub. From then on the live sites build from `main`.
- [ ] **Remove the demo data switch:** delete `PUBLIC_DEMO_MODE` from `portal/netlify.toml` (on `main`).

### Netlify

- [ ] **Main website (one-aim.org): set the environment variables** `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, `PUBLIC_APPLY_URL = https://apply.one-aim.org`, `PUBLIC_NETWORK_URL = https://network.one-aim.org` (not `PUBLIC_NOINDEX`). Then redeploy.
- [ ] **Team portal site for `main`:** new Netlify project from `main`, base directory `portal`, domain team.one-aim.org. Variables: the two Supabase ones, `PUBLIC_SITE_URL`, `PUBLIC_TEAM_URL`, `PUBLIC_APPLY_URL`, `PUBLIC_NETWORK_URL` (real addresses) and `PUBLIC_INDEXABLE = true`.
- [ ] **Apply and network sites:** two Netlify projects from `main`, base directories `deploy/apply` and `deploy/network`, each with `PORTAL_URL = https://team.one-aim.org`, domains apply.one-aim.org and network.one-aim.org.

### Domains

- [ ] **DNS at Strato: team, apply, network:** one CNAME each, pointing to the Netlify targets that Netlify shows when you add the domain. Wait until Netlify shows HTTPS as active.
- [ ] **Check the Cloudflare R2 CORS rule:** `https://one-aim.org` and `https://*.one-aim.org` are already allowed. Confirm a CV upload works from apply.one-aim.org.

### Supabase

- [ ] **Email links: real addresses.** Table `email_settings`: `team_url`, `apply_url`, `network_url` = https://team. / apply. / network.one-aim.org; sender applications@one-aim.org.
- [ ] **Auth redirect addresses:** Authentication → URL Configuration: Site URL https://team.one-aim.org, and add team. and network.one-aim.org to the redirect list, so password links work.
- [ ] **Bank connection (Enable Banking):** add the redirect https://team.one-aim.org/bank-callback, set `ENABLE_BANKING_APP_ID` and `ENABLE_BANKING_PRIVATE_KEY` yourself, connect each city's account in Finance.
- [ ] **Turn email test mode off:** team area → Settings → Emails. From now on emails go to the real recipients.

## 3. Right after launch

### Smoke tests

- [ ] **Apply once on apply.one-aim.org with your own address:** check the confirmation email arrives and all its links go to the real subdomains. Delete the test afterwards.
- [ ] **Publish a round and see it on one-aim.org:** it should appear on the city and program pages within about 5 minutes.
- [ ] **Sign in on team. and network.one-aim.org,** and try "Forgot password?" once.
- [ ] **Old links still work:** one-aim.org/team, /portal and /members links from earlier emails should forward.

### Search engines and people

- [ ] **Google Search Console:** add one-aim.org and apply.one-aim.org, submit the sitemap, check that the team and network sites are not indexed.
- [ ] **Invite the team:** Team overview → Invite member, for everyone who doesn't have a personal account yet.
- [ ] **Decide what happens to the test sites:** keep lambent and oneaim-test as test copies on `branchLucas`, or switch them off.
