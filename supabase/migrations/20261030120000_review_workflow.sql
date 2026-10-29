-- ============================================================================
-- Review workflow: interviewers, reviewers, staged notes, scorecards
--
-- • interview_slots.interviewer_ids: team members who lead the interview.
-- • submission_reviewers: team members assigned to review an applicant.
-- • submission_comments.stage: the applicant's status when the note was
--   written (filled by the database), plus the author's team profile.
-- • scorecards: reusable rating forms (blueprints) with weighted criteria,
--   each rated 1–5. An application gets its own copies, one for screening
--   and one for the interview (applications.scorecards).
-- • submission_scores: one filled-in scorecard per team member and stage
--   (screening / interview).
-- ============================================================================

-- ── Interviewers per slot ───────────────────────────────────────────────────

alter table public.interview_slots add column interviewer_ids uuid[] not null default '{}';

-- ── Reviewers per applicant ─────────────────────────────────────────────────

create table public.submission_reviewers (
  submission_id uuid not null references public.submissions (id) on delete cascade,
  member_id     uuid not null references public.team_members (id) on delete cascade,
  assigned_by   text not null,
  assigned_at   timestamptz not null default now(),
  primary key (submission_id, member_id)
);

create index submission_reviewers_member on public.submission_reviewers (member_id);

create or replace function public.fill_assigned_by()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.assigned_by := coalesce(public.team_city(), 'Team');
  return new;
end;
$$;

create trigger submission_reviewers_by before insert on public.submission_reviewers
  for each row execute function public.fill_assigned_by();

-- ── Notes: stage + author ───────────────────────────────────────────────────

alter table public.submission_comments
  add column stage text,
  add column author_member_id uuid references public.team_members (id) on delete set null;

-- Existing notes: the status the applicant had at that time
update public.submission_comments c
set stage = coalesce((select h.status::text from public.status_history h
                      where h.submission_id = c.submission_id and h.changed_at <= c.created_at
                      order by h.changed_at desc limit 1),
                     (select status::text from public.submissions where id = c.submission_id));

create or replace function public.fill_comment_author()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.author_id        := auth.uid();
  new.author_city      := coalesce(public.team_city(), 'Unknown');
  new.author_member_id := (select id from public.team_members where user_id = auth.uid());
  new.stage            := (select status::text from public.submissions where id = new.submission_id);
  return new;
end;
$$;

-- ── Scorecards ──────────────────────────────────────────────────────────────

create table public.scorecards (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique check (length(trim(name)) > 0),
  description text not null default '',
  -- [{ id, label, help?, weight }] – every criterion is rated 1–5
  criteria    jsonb not null default '[]' check (jsonb_typeof(criteria) = 'array'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger scorecards_updated_at before update on public.scorecards
  for each row execute function public.set_updated_at();

-- The application's own copies per stage: { screening?: {name, criteria}, interview?: {name, criteria} }
alter table public.applications add column scorecards jsonb not null default '{}' check (jsonb_typeof(scorecards) = 'object');

create table public.submission_scores (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete cascade,
  member_id     uuid not null references public.team_members (id) on delete cascade,
  stage         text not null check (stage in ('screening', 'interview')),
  -- { criterionId: 1..5 }
  scores        jsonb not null default '{}' check (jsonb_typeof(scores) = 'object'),
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (submission_id, member_id, stage)
);

create trigger submission_scores_updated_at before update on public.submission_scores
  for each row execute function public.set_updated_at();

-- A scorecard always belongs to the signed-in member (personal account), values 1–5
create or replace function public.check_score_sheet()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.member_id := (select id from public.team_members where user_id = auth.uid());
  if new.member_id is null then raise exception 'personal_account_needed'; end if;
  if exists (select 1 from jsonb_each(new.scores) e
             where jsonb_typeof(e.value) <> 'number' or (e.value)::numeric not in (1, 2, 3, 4, 5)) then
    raise exception 'invalid_option:score';
  end if;
  return new;
end;
$$;

create trigger submission_scores_check before insert or update on public.submission_scores
  for each row execute function public.check_score_sheet();

-- ── Access: team only ───────────────────────────────────────────────────────

alter table public.submission_reviewers enable row level security;
alter table public.scorecards enable row level security;
alter table public.submission_scores enable row level security;
revoke all on table public.submission_reviewers, public.scorecards, public.submission_scores from anon;

create policy "team full access" on public.submission_reviewers
  for all to authenticated using ((select public.is_team())) with check ((select public.is_team()));
create policy "team full access" on public.scorecards
  for all to authenticated using ((select public.is_team())) with check ((select public.is_team()));
create policy "team reads scores" on public.submission_scores
  for select to authenticated using ((select public.is_team()));
-- Everyone fills in and changes only their own sheets
create policy "team writes own scores" on public.submission_scores
  for insert to authenticated with check ((select public.is_team()));
create policy "team changes own scores" on public.submission_scores
  for update to authenticated
  using ((select public.is_team()) and member_id = (select id from public.team_members where user_id = (select auth.uid())))
  with check ((select public.is_team()));
create policy "team deletes own scores" on public.submission_scores
  for delete to authenticated
  using ((select public.is_team()) and member_id = (select id from public.team_members where user_id = (select auth.uid())));

revoke execute on function public.fill_assigned_by(), public.check_score_sheet() from public, anon, authenticated;

-- Starting scorecards (edit them under Blueprints → Scorecards)
insert into public.scorecards (name, description, criteria) values
  ('Screening – standard', 'For reading applications and CVs.', '[
    {"id": "motivation", "label": "Motivation", "help": "Why OneAIM, why this program? Specific and genuine?", "weight": 2},
    {"id": "background", "label": "Background & experience", "help": "Studies, projects, work experience relevant to AI in medicine.", "weight": 1},
    {"id": "contribution", "label": "What they bring", "help": "Skills or perspective the cohort benefits from.", "weight": 1},
    {"id": "quality", "label": "Quality of the application", "help": "Clear, complete, thoughtful.", "weight": 1}
  ]'),
  ('Interview – standard', 'For the interview conversation.', '[
    {"id": "motivation", "label": "Motivation", "help": "Convincing and well reflected?", "weight": 2},
    {"id": "communication", "label": "Communication", "help": "Clear, structured, open.", "weight": 1},
    {"id": "interdisciplinary", "label": "Interdisciplinary thinking", "help": "Connects medicine and technology, curious about the other side.", "weight": 1},
    {"id": "teamfit", "label": "Team & cohort fit", "help": "Would they contribute to and enrich the cohort?", "weight": 2}
  ]')
on conflict (name) do nothing;
