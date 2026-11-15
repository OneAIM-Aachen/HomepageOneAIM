-- Bug reports from the team area (edge function bug-report → GitHub issue).
-- Only used to limit reports per person and hour, and as a record of sent issues.
create table public.bug_reports (
  id         uuid primary key default gen_random_uuid(),
  reporter   text not null,          -- team member id (or user id for shared city logins)
  page       text not null default '',
  issue_url  text,
  created_at timestamptz not null default now()
);
create index bug_reports_reporter_idx on public.bug_reports (reporter, created_at desc);
alter table public.bug_reports enable row level security;   -- no policies: only the edge function (service role) reads and writes
revoke all on table public.bug_reports from anon, authenticated;
