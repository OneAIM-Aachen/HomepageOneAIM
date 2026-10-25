-- ============================================================================
-- OneAIM team portal – core schema
--
-- Tables
--   team_accounts         one login per city (links auth.users → city)
--   programs, locations,  managed tag lists (Settings → Tags)
--   semesters
--   blueprints            reusable application forms
--   applications          one round = program × location × semester
--   interview_slots       bookable interview times per application
--   people                network database, one row per email address
--   submissions           one person's application to one round
--   submission_comments   internal team notes
--   status_history        every status change of a submission
--   email_log             outgoing emails (queued → sent by an edge function)
--
-- Access rules live in the next migration (security).
-- ============================================================================

create extension if not exists citext with schema extensions;

-- ── Enums ───────────────────────────────────────────────────────────────────

create type public.pipeline as enum ('instant', 'screening', 'interview');

create type public.submission_status as enum (
  'new',        -- submitted, waiting for screening
  'invited',    -- invited to interview (pipeline 'interview')
  'accepted',
  'rejected',
  'confirmed'   -- pipeline 'instant': confirmed right away
);

create type public.email_template as enum ('confirmation', 'invite', 'rejection', 'acceptance');

-- ── Helpers ─────────────────────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- "Today" as a German calendar date (deadlines are German dates).
create or replace function public.today_berlin()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Europe/Berlin')::date;
$$;

-- ── Team accounts ───────────────────────────────────────────────────────────

create table public.team_accounts (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  city       text not null unique,
  created_at timestamptz not null default now()
);

comment on table public.team_accounts is
  'One login per city. Only users listed here can use the team area.';

-- ── Tag lists ───────────────────────────────────────────────────────────────
-- Text slugs as keys, the same ones the main website uses
-- (programs.ts → "aim-connect", cityData.ts → "aachen").

create table public.programs (
  id         text primary key check (id ~ '^[a-z0-9-]+$'),
  name       text not null unique,
  sort_order int  not null default 0,
  created_at timestamptz not null default now()
);

create table public.locations (
  id         text primary key check (id ~ '^[a-z0-9-]+$'),
  name       text not null unique,
  sort_order int  not null default 0,
  created_at timestamptz not null default now()
);

create table public.semesters (
  id         text primary key check (id ~ '^(ws|ss)[0-9]{2}$'),   -- "ws26"
  term       text not null check (term in ('WS', 'SS')),
  start_year int  not null check (start_year between 2020 and 2100),
  label      text generated always as (
               case when term = 'WS'
                 then 'WS ' || lpad((start_year % 100)::text, 2, '0') || '/' || lpad(((start_year + 1) % 100)::text, 2, '0')
                 else 'SS ' || lpad((start_year % 100)::text, 2, '0')
               end) stored,
  created_at timestamptz not null default now(),
  unique (term, start_year)
);

-- ── Blueprints ──────────────────────────────────────────────────────────────
-- fields: JSON array of
--   { id, kind, label, help?, required, options?: string[], maxWords? }
-- kind ∈ name, email, phone, linkedin, university, studyProgram, semester,
--        degree, cv, shortText, longText, single, multi, dropdown, file,
--        url, number, date, yesno

create table public.blueprints (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique check (length(trim(name)) > 0),
  description text not null default '',
  fields      jsonb not null default '[]' check (jsonb_typeof(fields) = 'array'),
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger blueprints_updated_at before update on public.blueprints
  for each row execute function public.set_updated_at();

-- ── Applications ────────────────────────────────────────────────────────────

create table public.applications (
  id              uuid primary key default gen_random_uuid(),
  -- Public key, e.g. "aachen-aim-connect-ws26" → apply.one-aim.org/aachen-aim-connect-ws26
  slug            text not null unique check (slug ~ '^[a-z0-9-]+$'),
  title           text,                     -- optional, otherwise "<Program> <Location> – <Semester>"
  blueprint_id    uuid references public.blueprints (id) on delete set null,
  blueprint_name  text not null default '',
  fields          jsonb not null default '[]' check (jsonb_typeof(fields) = 'array'),  -- copied on use
  program_id      text not null references public.programs (id) on update cascade,
  location_id     text not null references public.locations (id) on update cascade,
  semester_id     text not null references public.semesters (id) on update cascade,
  pipeline        public.pipeline not null,
  published       boolean not null default false,

  opens_at        date not null,
  deadline        date not null,
  deadline_time   time,                     -- optional, e.g. 12:00 (German time)
  interviews_from date,
  interviews_to   date,
  interviews_label text,                    -- free text instead of from/to, e.g. "Oct"
  decision_by     date,
  starts_at       date,

  spots           int check (spots > 0),
  fee             text,
  intro           text not null default '',
  image_path      text,                     -- storage path in bucket "public-images"
  -- { confirmation: {subject, body}, invite: {...}, rejection: {...}, acceptance: {...} }
  templates       jsonb not null default '{}' check (jsonb_typeof(templates) = 'object'),
  -- Rounds still running on an external form (e.g. Tally) during the switch
  external_url    text check (external_url ~ '^https://'),

  created_by      uuid references auth.users (id) on delete set null,
  created_by_city text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint deadline_after_opening check (deadline >= opens_at),
  constraint interviews_in_order    check (interviews_to is null or interviews_from is null or interviews_to >= interviews_from)
);

create index applications_published_idx on public.applications (published, deadline);
create index applications_tags_idx on public.applications (location_id, program_id, semester_id);

create trigger applications_updated_at before update on public.applications
  for each row execute function public.set_updated_at();

-- ── Interview slots ─────────────────────────────────────────────────────────

create table public.interview_slots (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  starts_at      timestamptz not null,
  duration_min   int  not null default 15 check (duration_min > 0),
  location       text not null default '',
  capacity       int  not null default 1 check (capacity >= 1),
  created_at     timestamptz not null default now()
);

create index interview_slots_app_idx on public.interview_slots (application_id, starts_at);

-- ── People (network database) ───────────────────────────────────────────────

create table public.people (
  id            uuid primary key default gen_random_uuid(),
  email         extensions.citext not null unique,
  name          text not null,
  phone         text,
  linkedin      text,
  university    text,
  study_program text,
  semester      text,
  degree        text,
  -- Latest CV upload: { path, fileName, size, submissionId, uploadedAt }.
  -- Older CVs stay with their submission (submissions.answers).
  cv            jsonb check (cv is null or jsonb_typeof(cv) = 'object'),
  first_seen_at timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index people_name_idx on public.people (name);

create trigger people_updated_at before update on public.people
  for each row execute function public.set_updated_at();

-- ── Submissions ─────────────────────────────────────────────────────────────
-- answers: { <field id>: value }. Files are stored as
--   { "path": "uploads/<application id>/<uuid>/cv.pdf", "fileName": "...", "size": 12345 }

create table public.submissions (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  person_id      uuid not null references public.people (id) on delete cascade,
  answers        jsonb not null default '{}' check (jsonb_typeof(answers) = 'object'),
  status         public.submission_status not null default 'new',
  score          smallint check (score between 1 and 5),
  slot_id        uuid references public.interview_slots (id) on delete set null,
  -- Secret for the interview booking link (apply.one-aim.org/book/<token>)
  booking_token  uuid not null unique default gen_random_uuid(),
  consent_at     timestamptz not null,
  submitted_at   timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (application_id, person_id)       -- one application per person per round
);

create index submissions_app_status_idx on public.submissions (application_id, status);
create index submissions_person_idx on public.submissions (person_id);
create index submissions_slot_idx on public.submissions (slot_id) where slot_id is not null;

create trigger submissions_updated_at before update on public.submissions
  for each row execute function public.set_updated_at();

-- A booked slot must belong to the same application.
create or replace function public.check_submission_slot()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.slot_id is not null and not exists (
    select 1 from public.interview_slots s
    where s.id = new.slot_id and s.application_id = new.application_id
  ) then
    raise exception 'slot_belongs_to_other_application';
  end if;
  return new;
end;
$$;

create trigger submissions_check_slot before insert or update of slot_id on public.submissions
  for each row execute function public.check_submission_slot();

-- ── Comments ────────────────────────────────────────────────────────────────

create table public.submission_comments (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete cascade,
  author_id     uuid references auth.users (id) on delete set null,
  author_city   text not null,
  body          text not null check (length(trim(body)) > 0),
  created_at    timestamptz not null default now()
);

create index submission_comments_sub_idx on public.submission_comments (submission_id, created_at);

-- ── Status history ──────────────────────────────────────────────────────────

create table public.status_history (
  id            bigint generated always as identity primary key,
  submission_id uuid not null references public.submissions (id) on delete cascade,
  status        public.submission_status not null,
  changed_by    text not null,              -- city name or "Applicant"
  changed_at    timestamptz not null default now()
);

create index status_history_sub_idx on public.status_history (submission_id, changed_at);

-- ── Email log ───────────────────────────────────────────────────────────────
-- Rows are inserted as 'queued'; an edge function renders the template,
-- sends the email and sets status 'sent' / 'failed'.

create table public.email_log (
  id                  uuid primary key default gen_random_uuid(),
  application_id      uuid references public.applications (id) on delete set null,
  submission_id       uuid references public.submissions (id) on delete set null,
  template            public.email_template not null,
  to_email            text not null,
  to_name             text not null,
  subject             text,
  body                text,
  status              text not null default 'queued' check (status in ('queued', 'sent', 'failed')),
  provider_message_id text,
  error               text,
  queued_by           text not null,        -- city name or "Applicant"
  created_at          timestamptz not null default now(),
  sent_at             timestamptz
);

create index email_log_queued_idx on public.email_log (created_at) where status = 'queued';
create index email_log_app_idx on public.email_log (application_id, created_at desc);
