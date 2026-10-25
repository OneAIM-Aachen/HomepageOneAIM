# OneAIM Team Portal & Application System – Spec

Status: agreed requirements (Oct 2026), clickable prototype in `portal/`.
Real backend (Supabase, login, emails) follows after the design is approved.

## Two new sites

| Site | Who | What |
|---|---|---|
| **team.one-aim.org** | OneAIM team (login required) | Create and manage applications, blueprints, applicant pipeline, network database, settings |
| **apply.one-aim.org** | Applicants (public) | Fill in application forms, book interview slots |

Both use the design language of one-aim.org (Raleway, AIM Blue `#0052E9`,
Dark Blue `#232ACF`, purple/pink accents, rounded cards). All text is English.

## Access

- Login with **email + password**.
- **One account per city** (Munich, Aachen, Frankfurt). This is the only way into the team site.
- All accounts are admins and see **all cities, unfiltered**.

## Blueprints

- A blueprint is a named, reusable application form (e.g. "AIM Connect – standard").
- **Name and email are always included** and mandatory.
- Every other field is optional to add and can be made mandatory per form:
  CV, phone, LinkedIn, university, study program, semester / degree level.
- Question types: short text, long text (with word/character limit), single choice,
  multiple choice, dropdown, file upload, link/URL, number, date, yes/no.
- Every form ends with a **mandatory consent checkbox** for storing the data
  in the OneAIM network database.
- **Copy on use**: creating an application from a blueprint copies its fields.
  Editing the blueprint later never changes existing applications.

## Applications (one application = one round)

- Created from a blueprint, then the copied form can be adjusted.
- **Tags (required)**: semester, program, location. Options come from managed lists
  in Settings (e.g. add "SS 27" or a new city there).
- **Pipeline type**, chosen per application:
  1. **Instant confirmation**: submitted → confirmed (open events etc.)
  2. **Screening**: submitted → accepted / rejected
  3. **Screening + interview**: submitted → invited to interview or rejected → accepted / rejected
- Settings per application:
  - Dates: opens at, deadline, interview period, decision date, program start
  - Spots and participation fee
  - Email templates per step (confirmation, interview invite, rejection, acceptance), pre-filled from defaults, with placeholders like `{first_name}`
  - Intro text and header image for the public form
  - Interview slots (date, time, place or video link, capacity)
- **Automatic publishing**: the application appears on one-aim.org (city/program pages,
  status card, timeline, Apply button) when it opens and disappears after the deadline.
  `src/data/applications.ts` is then filled from the database instead of by hand.

## Review workflow (team)

- Applicant list per application with status, score, tags, filters and search.
- Score / rating per applicant, internal comments (never visible to applicants).
- Actions: invite to interview, reject, accept. All of them work as **bulk actions** too.
- Interview invite and rejection/acceptance emails are **sent automatically from the tool**.
- Interview invite contains a link where the applicant **books one of the slots**.
- Final selection: accepted participants are stored in the database.

## Applicants (apply.one-aim.org)

- Open applications listed, each with its own form.
- Automatic **confirmation email** after submitting.
- **One submission per email per application**; applying to several programs/cities is allowed.
- Interview slot booking page (link from the invite email).

## Network database

- **Every applicant appears**, merged into one person per email address.
- Profile shows all their applications, statuses, programs, semesters, cities.
- Filter by program, city, semester, status (e.g. accepted), university, study program.
- Data is kept (consent is mandatory in every form).

## Technical plan

- Database, login and CV storage: **Supabase, EU region (Frankfurt)**.
- Emails: a transactional email service (e.g. Resend) from an address like
  `applications@one-aim.org` (needs DNS records at Strato).
- Code lives in this repo in its own folders; team, apply and the main site
  share design tokens; each deploys as its own Netlify site.
- Main site reads applications from the database at build time
  (nightly rebuild + a rebuild trigger when an application is published).

## Prototype (`portal/`)

- Astro project with both sites as route groups: `/team/…` and `/apply/…`.
- Runs entirely in the browser with fake data (localStorage), so the whole flow can be clicked through:
  log in → create blueprint → create application → apply as an applicant →
  screen, invite, book a slot, accept/reject → see the person in the network.
- Demo login: any city account, see `portal/src/lib/mockData.ts`.
- Run it:

  ```bash
  npm --prefix portal install
  npm --prefix portal run dev
  ```

  Then open http://localhost:4400 (team at `/team`, applicant site at `/apply`).
  Emails are not sent; they appear under "Sent emails" in the team area, and
  their links (e.g. interview booking) work. Settings → "Reset demo data"
  starts over.
