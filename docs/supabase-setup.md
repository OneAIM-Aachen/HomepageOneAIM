# Supabase setup (team portal)

The database lives in `supabase/migrations/`:

| File | What |
|---|---|
| `…180000_core_schema.sql` | Tables: team accounts, tags, blueprints, applications, interview slots, people (network), submissions, comments, status history, email log |
| `…180100_security.sql` | Access rules (RLS) and the functions the public apply site may call |
| `…180200_storage.sql` | File buckets: `application-files` (private: CVs, uploads), `public-images` (header images) |
| `…180300_reference_data.sql` | Programs, locations, semesters, 4 starter blueprints (the imported Tally rounds are removed again later) |
| `…200000_revoke_anon_functions.sql` | Removes Supabase's automatic public access to team-only functions |
| `…210000_email_settings.sql` | Email settings (sender, test mode, limit) |
| `…210100_email_trigger.sql` | Starts the email sender automatically (trigger + every 2 min) |
| `…090000/090100_…interview…` | Interview confirmation email, meeting links, invite guard |
| `…120000/120100_…mailbox.sql` | Incoming emails (mailbox sync), team replies, threading |
| `…180000_email_name_and_slot_rules.sql` | Same email + different name is refused; no interview slots in the past |
| `…190000_remove_external_forms.sql` | Removes external forms (Tally): every application uses our own form |
| `20261029100000_team_members.sql` | Personal team accounts, team profiles (linked to the network person), departments for the organigram |
| `20261029120000_team_profiles_without_login.sql` | Profiles without login; import of the website team |
| `20261030120000_review_workflow.sql` | Interviewers per slot, reviewers per applicant, notes with stage, scorecards (templates + per application, one sheet per member and stage) |
| `20261029220000_network_site.sql` | Network site (/members): logins for everyone in the network, directory/profile functions, welcome email when someone is accepted |
| `20261029160000_team_history_alumni_checkins.sql` | Position history, alumni, yearly "still active?" check (pg_cron daily → team-accounts `checkins`) |

## Who can do what

- **Team** = a logged-in user with a row in `team_members` (personal account). All members have the same rights: full access to everything, incl. all CVs, and they can invite and remove members.
  - Accounts are created only by invitation (Team overview → "Invite member", edge function `team-accounts`). The email (via Brevo) links to `/team/welcome`, where the person sets their password. "Forgot password?" works the same way.
  - Every member is linked to the network person (`people`) with the same email; same email under a different name is refused. Universities, study programs, phone and LinkedIn live on that person.
  - Only `status = 'active'` members have access. Alumni keep profile and position history (`team_member_roles`) but can't sign in.
  - Yearly check: one year after the email is added (and a year after every "yes"), team-accounts emails a link to `/team/checkin`; "no" makes the member alumni. One reminder after 14 days; without an answer within one month they become alumni anyway (`expire_team_checkins()`, pg_cron daily).
  - The old city logins (`team_accounts`) stop working once the first personal account has set its password, except logins marked `keep_active` (`aachen@one-aim.org`).
- **Network members** (members site `/members`): everyone accepted after a selection (screening / interview), plus team and team alumni. Their logins (`network_accounts`) have no table access and are not team (`is_team()` is false). They only call `network_directory()`, `network_me()` and `network_update_me()`, which return the network profile fields (contact, studies, OneAIM programs/events, team history) and nothing else. Accepting someone queues a welcome email with a set-password link (`network_invites`, sent by team-accounts `network_queue`).
- **Applicants / public** have no table access at all. They can only:
  - `published_applications()`: list published rounds (also used by one-aim.org)
  - `submit_application(id, answers, consent)`: checks the form, consent and duplicates, creates/updates the person, queues the confirmation email
  - upload files into the folder of an **open** application (never read them)
  - `get_booking(token)` / `book_slot(token, slot)`: interview booking via the secret link
- Team decisions go through `decide(ids, 'invite' | 'accept' | 'reject' | 'reset')`, which checks the pipeline step, logs the history and queues the email.

## One-time setup

Project: **OneAIM Website**, ref `wenkvkkfmclhycyxnxxu`, region West EU (Ireland).
Steps 1–3 are done (25 Oct 2026); all migrations are pushed.

1. **Create the project** on supabase.com in an EU region, strong database password (keep it in your password manager).
2. **Log in and link the CLI** (in the repo folder; you type the token/password yourself):

   ```bash
   supabase login
   ```

   ```bash
   supabase link --project-ref <your-project-ref>
   ```

   The project ref is the part of the project URL after `/project/`.
3. **Push the migrations:**

   ```bash
   supabase db push
   ```

4. **Turn off public sign-ups:** Dashboard → Authentication → Sign In / Providers → Email → disable "Allow new users to sign up". Only the team accounts may exist.
5. **(Historic) city accounts** – only needed to invite the first personal accounts: Dashboard → Authentication → Users → "Add user" → "Create new user", once per city
   (e.g. `aachen@one-aim.org`), with a strong password and "Auto confirm user" on.
6. **Mark them as team accounts:** Dashboard → SQL Editor:

   ```sql
   insert into public.team_accounts (user_id, city)
   select id, case email
     when 'munich@one-aim.org'    then 'Munich'
     when 'aachen@one-aim.org'    then 'Aachen'
     when 'frankfurt@one-aim.org' then 'Frankfurt'
   end
   from auth.users
   where email in ('munich@one-aim.org', 'aachen@one-aim.org', 'frankfurt@one-aim.org');
   ```

## Emails (Brevo)

- Queued emails (`email_log`) are sent by the edge function `supabase/functions/send-emails`,
  started right after new emails are queued (trigger) and every 2 minutes (pg_cron, retries).
- Sender, test mode, test inbox, link base URL and daily limit: team area → Settings → Emails
  (table `email_settings`). Test mode is on by default; without a test inbox nothing is sent.
- One-time setup:
  1. Brevo account; domain `one-aim.org` authenticated (DNS records at Strato); sender
     `aachen@one-aim.org` (later `applications@one-aim.org`) added in Brevo.
  2. Brevo API key stored as a function secret (you type the key yourself):

     ```bash
     supabase secrets set BREVO_API_KEY=your-key-here
     ```

  3. Deploy changes to the function with:

     ```bash
     supabase functions deploy send-emails --use-api --no-verify-jwt
     ```

- Going live: set the sender to `applications@one-aim.org`, link base to `https://apply.one-aim.org`,
  switch test mode off.

## Mailbox (incoming emails)

- The edge function `supabase/functions/sync-mailbox` reads the inbox of the sender account via IMAP
  every 2 minutes (pg_cron) and on "Sync now" (team area → Emails). The first sync reads the last
  90 days (`mailbox_state.sync_since`).
- Matching: replies to our emails → exact application (Message-ID); otherwise by sender address →
  person (if they have one application, that one). The team can link emails manually.
- Team replies from the portal are sent via Brevo with In-Reply-To/References, so they stay in the
  applicant's thread.
- One-time setup (you type the mailbox password yourself):

  ```bash
  supabase secrets set IMAP_USER=aachen@one-aim.org IMAP_PASSWORD=your-mailbox-password
  ```

  `IMAP_HOST` defaults to `imap.strato.de`. When switching to `applications@one-aim.org`, set
  `IMAP_USER`/`IMAP_PASSWORD` again and reset the sync in the SQL editor:
  `update public.mailbox_state set uid_validity = null, last_uid = 0;`

## Later steps

- Main site: read `published_applications()` at build time instead of `src/data/applications.ts`.
- Spam protection for the public form (e.g. Cloudflare Turnstile).
