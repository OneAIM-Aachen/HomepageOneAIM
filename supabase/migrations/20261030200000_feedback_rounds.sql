-- ============================================================================
-- Participant feedback: several feedbacks per application
--   Each feedback has a name, its own form (copy of a feedback blueprint),
--   its own email text and a send time. The personal link is
--   /apply/feedback?t=<submissions.feedback_token>&f=<feedback id>.
--   Replaces the one-form-per-application tables (still empty).
-- ============================================================================

do $$
begin
  if exists (select 1 from public.feedback_forms) or exists (select 1 from public.feedback_responses) then
    raise exception 'feedback data exists, migrate it instead of dropping';
  end if;
end;
$$;

drop function public.send_feedback_now(uuid);
drop function public.queue_feedback(uuid, text);
drop function public.get_feedback(uuid);
drop function public.submit_feedback(uuid, jsonb);
drop table public.feedback_responses;
drop table public.feedback_forms;

create table public.feedback_forms (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  name           text not null check (length(trim(name)) > 0),
  blueprint_name text not null default '',
  intro          text not null default '',
  fields         jsonb not null default '[]' check (jsonb_typeof(fields) = 'array'),
  subject        text not null default '',
  body           text not null default '',
  send_at        timestamptz,             -- null = not scheduled (send by hand)
  sent_at        timestamptz,             -- first sending (scheduled or "send now")
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index feedback_forms_app_idx on public.feedback_forms (application_id, created_at);

create trigger feedback_forms_updated_at before update on public.feedback_forms
  for each row execute function public.set_updated_at();

create table public.feedback_responses (
  id             uuid primary key default gen_random_uuid(),
  feedback_id    uuid not null references public.feedback_forms (id) on delete cascade,
  submission_id  uuid not null references public.submissions (id) on delete cascade,
  answers        jsonb not null default '{}' check (jsonb_typeof(answers) = 'object'),
  submitted_at   timestamptz not null default now(),
  unique (feedback_id, submission_id)
);

alter table public.feedback_forms enable row level security;
alter table public.feedback_responses enable row level security;

create policy "team full access" on public.feedback_forms
  for all to authenticated using ((select public.is_team())) with check ((select public.is_team()));
create policy "team full access" on public.feedback_responses
  for all to authenticated using ((select public.is_team())) with check ((select public.is_team()));

alter publication supabase_realtime add table public.feedback_forms, public.feedback_responses;

-- Which feedback an email belongs to (for the link and the text)
alter table public.email_log
  add column feedback_id uuid references public.feedback_forms (id) on delete set null;

-- ── Sending ─────────────────────────────────────────────────────────────────

-- Queues the email for every accepted participant who hasn't got this
-- feedback yet (also those accepted after the first sending). Returns how many.
create or replace function public.queue_feedback(p_feedback uuid, p_by text)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_form  public.feedback_forms;
  v_count int;
begin
  select * into v_form from public.feedback_forms where id = p_feedback;
  if v_form.id is null or jsonb_array_length(v_form.fields) = 0 then raise exception 'feedback_form_missing'; end if;

  insert into public.email_log (application_id, submission_id, feedback_id, template, to_email, to_name, queued_by)
  select su.application_id, su.id, v_form.id, 'feedback', pe.email, pe.name, p_by
  from public.submissions su
  join public.people pe on pe.id = su.person_id
  where su.application_id = v_form.application_id
    and su.status in ('accepted', 'confirmed')
    and not exists (select 1 from public.feedback_responses r where r.feedback_id = v_form.id and r.submission_id = su.id)
    and not exists (
      select 1 from public.email_log m
      where m.feedback_id = v_form.id and m.submission_id = su.id and m.status <> 'failed'
    );
  get diagnostics v_count = row_count;

  update public.feedback_forms set sent_at = coalesce(sent_at, now()) where id = v_form.id;
  return v_count;
end;
$$;

revoke execute on function public.queue_feedback(uuid, text) from public, anon, authenticated;

create or replace function public.send_feedback_now(p_feedback uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_team() then raise exception 'not_allowed'; end if;
  return public.queue_feedback(p_feedback, coalesce(public.team_city(), 'Team'));
end;
$$;

revoke execute on function public.send_feedback_now(uuid) from public, anon;
grant execute on function public.send_feedback_now(uuid) to authenticated;

-- Scheduled sending (pg_cron job "send-due-feedback", every 5 minutes)
create or replace function public.send_due_feedback()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_total int := 0;
begin
  for v_id in
    select f.id from public.feedback_forms f
    where f.send_at is not null and f.send_at <= now() and f.sent_at is null and jsonb_array_length(f.fields) > 0
  loop
    v_total := v_total + public.queue_feedback(v_id, 'Scheduled');
  end loop;
  return v_total;
end;
$$;

revoke execute on function public.send_due_feedback() from public, anon, authenticated;

-- ── Public form (personal link) ─────────────────────────────────────────────

-- state: open (can answer), done (already answered), closed (not a participant / no such feedback)
create or replace function public.get_feedback(p_token uuid, p_feedback uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'first_name',  split_part(pe.name, ' ', 1),
    'application', coalesce(a.title, p.name || ' ' || l.name || ' – ' || s.label),
    'name',        coalesce(f.name, ''),
    'intro',       coalesce(f.intro, ''),
    'fields',      case when f.id is null or su.status not in ('accepted', 'confirmed') then '[]'::jsonb else f.fields end,
    'state',       case
                     when exists (select 1 from public.feedback_responses r where r.feedback_id = f.id and r.submission_id = su.id) then 'done'
                     when f.id is null or su.status not in ('accepted', 'confirmed') then 'closed'
                     else 'open'
                   end
  )
  from public.submissions su
  join public.people pe      on pe.id = su.person_id
  join public.applications a on a.id = su.application_id
  join public.programs  p    on p.id = a.program_id
  join public.locations l    on l.id = a.location_id
  join public.semesters s    on s.id = a.semester_id
  left join public.feedback_forms f on f.id = p_feedback and f.application_id = a.id
  where su.feedback_token = p_token;
$$;

create or replace function public.submit_feedback(p_token uuid, p_feedback uuid, p_answers jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub   public.submissions;
  v_form  public.feedback_forms;
  v_field jsonb;
  v_val   jsonb;
begin
  select * into v_sub from public.submissions where feedback_token = p_token;
  if v_sub.id is null then raise exception 'feedback_link_invalid'; end if;
  select * into v_form from public.feedback_forms where id = p_feedback and application_id = v_sub.application_id;
  if v_form.id is null or v_sub.status not in ('accepted', 'confirmed') then raise exception 'feedback_closed'; end if;
  if exists (select 1 from public.feedback_responses r where r.feedback_id = v_form.id and r.submission_id = v_sub.id) then
    raise exception 'feedback_already_sent';
  end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' or length(p_answers::text) > 100000 then raise exception 'invalid_answers'; end if;

  -- Mandatory questions
  for v_field in select * from jsonb_array_elements(v_form.fields) loop
    if coalesce((v_field->>'required')::boolean, false) then
      v_val := p_answers -> (v_field->>'id');
      if v_val is null or v_val = 'null'::jsonb or v_val = '""'::jsonb or v_val = '[]'::jsonb then
        raise exception 'missing_required_answer';
      end if;
    end if;
  end loop;

  -- Only answers to questions of this form
  insert into public.feedback_responses (feedback_id, submission_id, answers)
  values (v_form.id, v_sub.id, (
    select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) from jsonb_each(p_answers) e(k, v)
    where exists (select 1 from jsonb_array_elements(v_form.fields) x where x->>'id' = k)
  ));
end;
$$;

revoke execute on function public.get_feedback(uuid, uuid), public.submit_feedback(uuid, uuid, jsonb) from public;
grant execute on function public.get_feedback(uuid, uuid), public.submit_feedback(uuid, uuid, jsonb) to anon, authenticated;
