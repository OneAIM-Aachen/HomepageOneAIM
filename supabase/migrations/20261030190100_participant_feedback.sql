-- ============================================================================
-- Participant feedback
--   • Blueprints have a kind: application forms or feedback forms.
--   • Each application can have one feedback form (a copy of a feedback
--     blueprint) with a date and time to send it.
--   • At that time every participant (accepted / confirmed) gets an email
--     with a personal link (submissions.feedback_token) to the form.
--   • Answers are stored in feedback_responses, one per participant.
-- ============================================================================

-- ── Blueprint kinds ─────────────────────────────────────────────────────────

alter table public.blueprints
  add column kind text not null default 'application' check (kind in ('application', 'feedback'));

-- Feedback forms don't ask for the profile fields (participants are known)
create or replace function public.enforce_blueprint_core_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.kind = 'application' then new.fields := public.ensure_core_fields(new.fields); end if;
  return new;
end;
$$;

drop trigger blueprints_core_fields on public.blueprints;
create trigger blueprints_core_fields before insert or update of fields, kind on public.blueprints
  for each row execute function public.enforce_blueprint_core_fields();

insert into public.blueprints (name, description, kind, fields) values (
  'Participant feedback – standard',
  'Thank you for taking part! Your feedback helps us make the next round even better. It takes about 3 minutes.',
  'feedback',
  '[
    {"id": "fb_overall", "kind": "single", "label": "Overall, how satisfied were you with the program?", "required": true,
     "options": ["5 – Excellent", "4 – Good", "3 – Okay", "2 – Poor", "1 – Very poor"]},
    {"id": "fb_recommend", "kind": "single", "label": "How likely are you to recommend it to a friend?", "required": true,
     "options": ["Very likely", "Likely", "Not sure", "Unlikely", "Very unlikely"]},
    {"id": "fb_liked", "kind": "longText", "label": "What did you like most?", "required": false, "maxWords": 300},
    {"id": "fb_improve", "kind": "longText", "label": "What should we improve?", "required": false, "maxWords": 300},
    {"id": "fb_team", "kind": "yesno", "label": "Would you be interested in joining the OneAIM team?", "required": false},
    {"id": "fb_other", "kind": "longText", "label": "Anything else you would like to tell us?", "required": false, "maxWords": 300}
  ]'::jsonb
) on conflict (name) do nothing;

-- ── Personal link per participant ───────────────────────────────────────────

alter table public.submissions
  add column feedback_token uuid not null unique default gen_random_uuid();

-- ── Feedback form per application ───────────────────────────────────────────

create table public.feedback_forms (
  application_id uuid primary key references public.applications (id) on delete cascade,
  blueprint_name text not null default '',
  intro          text not null default '',
  fields         jsonb not null default '[]' check (jsonb_typeof(fields) = 'array'),
  send_at        timestamptz,             -- null = not scheduled yet
  sent_at        timestamptz,             -- first sending (scheduled or "send now")
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create trigger feedback_forms_updated_at before update on public.feedback_forms
  for each row execute function public.set_updated_at();

create table public.feedback_responses (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  submission_id  uuid not null unique references public.submissions (id) on delete cascade,
  answers        jsonb not null default '{}' check (jsonb_typeof(answers) = 'object'),
  submitted_at   timestamptz not null default now()
);

create index feedback_responses_app_idx on public.feedback_responses (application_id);

alter table public.feedback_forms enable row level security;
alter table public.feedback_responses enable row level security;

create policy "team full access" on public.feedback_forms
  for all to authenticated using ((select public.is_team())) with check ((select public.is_team()));
create policy "team full access" on public.feedback_responses
  for all to authenticated using ((select public.is_team())) with check ((select public.is_team()));

alter publication supabase_realtime add table public.feedback_forms, public.feedback_responses;

-- ── Sending ─────────────────────────────────────────────────────────────────

-- Queues the feedback email for every participant who hasn't got it yet
-- (also those accepted after the first sending). Returns the number queued.
create or replace function public.queue_feedback(p_application uuid, p_by text)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  if not exists (select 1 from public.feedback_forms f where f.application_id = p_application and jsonb_array_length(f.fields) > 0) then
    raise exception 'feedback_form_missing';
  end if;

  insert into public.email_log (application_id, submission_id, template, to_email, to_name, queued_by)
  select su.application_id, su.id, 'feedback', pe.email, pe.name, p_by
  from public.submissions su
  join public.people pe on pe.id = su.person_id
  where su.application_id = p_application
    and su.status in ('accepted', 'confirmed')
    and not exists (select 1 from public.feedback_responses r where r.submission_id = su.id)
    and not exists (
      select 1 from public.email_log m
      where m.submission_id = su.id and m.template = 'feedback' and m.status <> 'failed'
    );
  get diagnostics v_count = row_count;

  update public.feedback_forms set sent_at = coalesce(sent_at, now()) where application_id = p_application;
  return v_count;
end;
$$;

revoke execute on function public.queue_feedback(uuid, text) from public, anon, authenticated;

-- "Send now" in the portal (team only)
create or replace function public.send_feedback_now(p_application uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_team() then raise exception 'not_allowed'; end if;
  return public.queue_feedback(p_application, coalesce(public.team_city(), 'Team'));
end;
$$;

revoke execute on function public.send_feedback_now(uuid) from public, anon;
grant execute on function public.send_feedback_now(uuid) to authenticated;

-- Scheduled sending (pg_cron, every 5 minutes)
create or replace function public.send_due_feedback()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_app uuid;
  v_total int := 0;
begin
  for v_app in
    select f.application_id from public.feedback_forms f
    where f.send_at is not null and f.send_at <= now() and f.sent_at is null and jsonb_array_length(f.fields) > 0
  loop
    v_total := v_total + public.queue_feedback(v_app, 'Scheduled');
  end loop;
  return v_total;
end;
$$;

revoke execute on function public.send_due_feedback() from public, anon, authenticated;

select cron.schedule('send-due-feedback', '*/5 * * * *', $$ select public.send_due_feedback() $$);

-- ── Public form (personal link) ─────────────────────────────────────────────

-- state: open (can answer), done (already answered), closed (no form / not a participant)
create or replace function public.get_feedback(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'first_name',  split_part(pe.name, ' ', 1),
    'application', coalesce(a.title, p.name || ' ' || l.name || ' – ' || s.label),
    'intro',       coalesce(f.intro, ''),
    'fields',      case when f.application_id is null or su.status not in ('accepted', 'confirmed') then '[]'::jsonb else f.fields end,
    'state',       case
                     when exists (select 1 from public.feedback_responses r where r.submission_id = su.id) then 'done'
                     when f.application_id is null or su.status not in ('accepted', 'confirmed') then 'closed'
                     else 'open'
                   end
  )
  from public.submissions su
  join public.people pe      on pe.id = su.person_id
  join public.applications a on a.id = su.application_id
  join public.programs  p    on p.id = a.program_id
  join public.locations l    on l.id = a.location_id
  join public.semesters s    on s.id = a.semester_id
  left join public.feedback_forms f on f.application_id = a.id
  where su.feedback_token = p_token;
$$;

create or replace function public.submit_feedback(p_token uuid, p_answers jsonb)
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
  select * into v_form from public.feedback_forms where application_id = v_sub.application_id;
  if v_form.application_id is null or v_sub.status not in ('accepted', 'confirmed') then raise exception 'feedback_closed'; end if;
  if exists (select 1 from public.feedback_responses r where r.submission_id = v_sub.id) then raise exception 'feedback_already_sent'; end if;
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
  insert into public.feedback_responses (application_id, submission_id, answers)
  values (v_sub.application_id, v_sub.id, (
    select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) from jsonb_each(p_answers) e(k, v)
    where exists (select 1 from jsonb_array_elements(v_form.fields) x where x->>'id' = k)
  ));
end;
$$;

revoke execute on function public.get_feedback(uuid), public.submit_feedback(uuid, jsonb) from public;
grant execute on function public.get_feedback(uuid), public.submit_feedback(uuid, jsonb) to anon, authenticated;
