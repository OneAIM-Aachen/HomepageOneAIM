-- ============================================================================
-- OneAIM team portal – access rules
--
-- Team (logged-in user listed in team_accounts): full access to everything.
-- Applicants / public (anon key): NO direct table access. They only call
--   published_applications()   → open/upcoming/past published rounds (website + apply site)
--   submit_application(...)    → submit a form
--   get_booking(token)         → interview booking page
--   book_slot(token, slot)     → book an interview slot
-- ============================================================================

-- ── Team helpers ────────────────────────────────────────────────────────────

create or replace function public.is_team()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.team_accounts where user_id = (select auth.uid()));
$$;

create or replace function public.team_city()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select city from public.team_accounts where user_id = (select auth.uid());
$$;

revoke execute on function public.is_team(), public.team_city() from public, anon;
grant execute on function public.is_team(), public.team_city() to authenticated;

-- ── Row level security ──────────────────────────────────────────────────────

do $$
declare
  t text;
begin
  foreach t in array array[
    'team_accounts', 'programs', 'locations', 'semesters', 'blueprints', 'applications',
    'interview_slots', 'people', 'submissions', 'submission_comments', 'status_history', 'email_log'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    -- Defence in depth: the public key gets no table privileges at all.
    execute format('revoke all on table public.%I from anon', t);
  end loop;
end;
$$;

-- Team: full access on the working tables
do $$
declare
  t text;
begin
  foreach t in array array[
    'programs', 'locations', 'semesters', 'blueprints', 'applications',
    'interview_slots', 'people', 'submissions', 'submission_comments', 'email_log'
  ] loop
    execute format(
      'create policy "team full access" on public.%I for all to authenticated using ((select public.is_team())) with check ((select public.is_team()))',
      t);
  end loop;
end;
$$;

-- Accounts and history: team can read, nobody writes through the API
-- (accounts are created in the dashboard, history by trigger).
create policy "team reads accounts" on public.team_accounts
  for select to authenticated using ((select public.is_team()));

create policy "team reads history" on public.status_history
  for select to authenticated using ((select public.is_team()));

-- Comments: author fields are filled from the session, not from the client.
create or replace function public.fill_comment_author()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.author_id   := auth.uid();
  new.author_city := coalesce(public.team_city(), 'Unknown');
  return new;
end;
$$;

create trigger submission_comments_author before insert on public.submission_comments
  for each row execute function public.fill_comment_author();

-- ── Status history (automatic) ──────────────────────────────────────────────

create or replace function public.log_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.status_history (submission_id, status, changed_by)
    values (new.id, new.status, coalesce(public.team_city(), 'Applicant'));
  end if;
  return new;
end;
$$;

create trigger submissions_status_history after insert or update of status on public.submissions
  for each row execute function public.log_status_change();

-- ── Public: published applications ──────────────────────────────────────────
-- Used by one-aim.org at build time and by apply.one-aim.org.
-- Returns only safe columns (no email templates, no internal fields).

create or replace function public.published_applications()
returns table (
  id uuid, slug text, title text, display_title text,
  program_id text, program_name text, location_id text, location_name text,
  semester_id text, semester_label text, pipeline public.pipeline, phase text,
  opens_at date, deadline date, deadline_time time,
  interviews_from date, interviews_to date, interviews_label text,
  decision_by date, starts_at date, spots int, fee text, intro text, image_path text,
  fields jsonb, external_url text
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.slug, a.title,
         coalesce(a.title, p.name || ' ' || l.name || ' – ' || s.label) as display_title,
         a.program_id, p.name, a.location_id, l.name, a.semester_id, s.label, a.pipeline,
         case when public.today_berlin() < a.opens_at then 'upcoming'
              when public.today_berlin() <= a.deadline then 'open'
              else 'closed' end as phase,
         a.opens_at, a.deadline, a.deadline_time,
         a.interviews_from, a.interviews_to, a.interviews_label,
         a.decision_by, a.starts_at, a.spots, a.fee, a.intro, a.image_path,
         a.fields, a.external_url
  from public.applications a
  join public.programs  p on p.id = a.program_id
  join public.locations l on l.id = a.location_id
  join public.semesters s on s.id = a.semester_id
  where a.published
  order by a.deadline desc;
$$;

-- ── Public: submit an application ───────────────────────────────────────────

create or replace function public.is_application_open(p_application_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.applications a
    where a.id = p_application_id
      and a.published
      and a.external_url is null
      and public.today_berlin() between a.opens_at and a.deadline
  );
$$;

create or replace function public.submit_application(
  p_application_id uuid,
  p_answers jsonb,
  p_consent boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_app        public.applications;
  v_field      jsonb;
  v_value      jsonb;
  v_email      text;
  v_name       text;
  v_person_id  uuid;
  v_sub_id     uuid;
  v_status     public.submission_status;

  -- Profile values by field kind (name, email, phone, …)
  v_profile    jsonb := '{}';
  v_cv         jsonb;
begin
  if not coalesce(p_consent, false) then
    raise exception 'consent_required';
  end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then
    raise exception 'invalid_answers';
  end if;
  if not public.is_application_open(p_application_id) then
    raise exception 'application_not_open';
  end if;

  select * into v_app from public.applications where id = p_application_id;

  -- Validate every field of the form
  for v_field in select * from jsonb_array_elements(v_app.fields) loop
    v_value := p_answers -> (v_field ->> 'id');

    if coalesce((v_field ->> 'required')::boolean, false) and (
         v_value is null
      or jsonb_typeof(v_value) = 'null'
      or (jsonb_typeof(v_value) = 'string' and length(trim(v_value #>> '{}')) = 0)
      or (jsonb_typeof(v_value) = 'array'  and jsonb_array_length(v_value) = 0)
    ) then
      raise exception 'missing_field:%', v_field ->> 'id';
    end if;

    if v_value is not null and jsonb_typeof(v_value) = 'string' and length(v_value #>> '{}') > 20000 then
      raise exception 'answer_too_long:%', v_field ->> 'id';
    end if;

    -- Files must have been uploaded into this application's upload folder
    if v_field ->> 'kind' in ('cv', 'file') and v_value is not null and jsonb_typeof(v_value) = 'object'
       and (v_value ->> 'path') not like 'uploads/' || p_application_id::text || '/%' then
      raise exception 'invalid_file:%', v_field ->> 'id';
    end if;

    if v_field ->> 'kind' = 'cv' and v_value is not null and jsonb_typeof(v_value) = 'object' then
      v_cv := v_value;
    end if;

    if v_field ->> 'kind' in ('name', 'email', 'phone', 'linkedin', 'university', 'studyProgram', 'semester', 'degree')
       and v_value is not null and jsonb_typeof(v_value) in ('string', 'number') then
      v_profile := v_profile || jsonb_build_object(v_field ->> 'kind', trim(v_value #>> '{}'));
    end if;
  end loop;

  v_email := lower(v_profile ->> 'email');
  v_name  := v_profile ->> 'name';
  if v_email is null or v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    raise exception 'invalid_email';
  end if;
  if v_name is null or length(v_name) = 0 then
    raise exception 'missing_field:name';
  end if;

  -- One profile per email address; newest answers update the profile.
  insert into public.people as pe (email, name, phone, linkedin, university, study_program, semester, degree)
  values (v_email, v_name, v_profile ->> 'phone', v_profile ->> 'linkedin', v_profile ->> 'university',
          v_profile ->> 'studyProgram', v_profile ->> 'semester', v_profile ->> 'degree')
  on conflict (email) do update set
    name          = excluded.name,
    phone         = coalesce(excluded.phone, pe.phone),
    linkedin      = coalesce(excluded.linkedin, pe.linkedin),
    university    = coalesce(excluded.university, pe.university),
    study_program = coalesce(excluded.study_program, pe.study_program),
    semester      = coalesce(excluded.semester, pe.semester),
    degree        = coalesce(excluded.degree, pe.degree)
  returning id into v_person_id;

  if exists (select 1 from public.submissions where application_id = p_application_id and person_id = v_person_id) then
    raise exception 'already_applied';
  end if;

  v_status := case when v_app.pipeline = 'instant' then 'confirmed' else 'new' end;

  insert into public.submissions (application_id, person_id, answers, status, consent_at)
  values (p_application_id, v_person_id, p_answers, v_status, now())
  returning id into v_sub_id;

  -- Newest CV becomes the profile CV in the network database
  if v_cv is not null then
    update public.people
       set cv = v_cv || jsonb_build_object('submissionId', v_sub_id, 'uploadedAt', now())
     where id = v_person_id;
  end if;

  insert into public.email_log (application_id, submission_id, template, to_email, to_name, queued_by)
  values (p_application_id, v_sub_id, 'confirmation', v_email, v_name, 'Applicant');

  return v_sub_id;
end;
$$;

-- ── Public: interview booking ───────────────────────────────────────────────

create or replace function public.get_booking(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'first_name',  split_part(pe.name, ' ', 1),
    'application', coalesce(a.title, p.name || ' ' || l.name || ' – ' || s.label),
    'status',      su.status,
    'slot_id',     su.slot_id,
    'slots', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', sl.id, 'starts_at', sl.starts_at, 'duration_min', sl.duration_min,
               'location', sl.location,
               'available', sl.capacity - (select count(*) from public.submissions x where x.slot_id = sl.id and x.id <> su.id) > 0)
             order by sl.starts_at)
      from public.interview_slots sl
      where sl.application_id = a.id and sl.starts_at > now()
    ), '[]'::jsonb)
  )
  from public.submissions su
  join public.people pe     on pe.id = su.person_id
  join public.applications a on a.id = su.application_id
  join public.programs  p   on p.id = a.program_id
  join public.locations l   on l.id = a.location_id
  join public.semesters s   on s.id = a.semester_id
  where su.booking_token = p_token;
$$;

create or replace function public.book_slot(p_token uuid, p_slot_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub  public.submissions;
  v_slot public.interview_slots;
  v_taken int;
begin
  select * into v_sub from public.submissions where booking_token = p_token for update;
  if not found then raise exception 'invalid_token'; end if;
  if v_sub.status <> 'invited' then raise exception 'not_invited'; end if;

  -- Lock the slot so two people can't take the last seat at the same time
  select * into v_slot from public.interview_slots
  where id = p_slot_id and application_id = v_sub.application_id
  for update;
  if not found then raise exception 'invalid_slot'; end if;
  if v_slot.starts_at <= now() then raise exception 'slot_in_past'; end if;

  select count(*) into v_taken from public.submissions where slot_id = p_slot_id and id <> v_sub.id;
  if v_taken >= v_slot.capacity then raise exception 'slot_full'; end if;

  update public.submissions set slot_id = p_slot_id where id = v_sub.id;
end;
$$;

-- ── Team: decisions (invite / accept / reject / reset) ──────────────────────
-- Validates the transition for the pipeline, logs history (trigger) and
-- queues the matching email. Runs with the caller's rights → team only.

create or replace function public.decide(p_submission_ids uuid[], p_decision text, p_send_email boolean default true)
returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_sub      record;
  v_new      public.submission_status;
  v_template public.email_template;
  v_count    int := 0;
begin
  if not public.is_team() then raise exception 'not_allowed'; end if;
  if p_decision not in ('invite', 'accept', 'reject', 'reset') then raise exception 'invalid_decision'; end if;

  for v_sub in
    select su.id, su.status, su.application_id, a.pipeline, pe.email, pe.name
    from public.submissions su
    join public.applications a on a.id = su.application_id
    join public.people pe on pe.id = su.person_id
    where su.id = any (p_submission_ids)
    for update of su
  loop
    v_new := null;
    v_template := null;

    if p_decision = 'invite' and v_sub.pipeline = 'interview' and v_sub.status = 'new' then
      v_new := 'invited'; v_template := 'invite';
    elsif p_decision = 'accept' and ((v_sub.pipeline = 'screening' and v_sub.status = 'new')
                                  or (v_sub.pipeline = 'interview' and v_sub.status = 'invited')) then
      v_new := 'accepted'; v_template := 'acceptance';
    elsif p_decision = 'reject' and v_sub.pipeline <> 'instant' and v_sub.status in ('new', 'invited') then
      v_new := 'rejected'; v_template := 'rejection';
    elsif p_decision = 'reset' and v_sub.pipeline <> 'instant' and v_sub.status <> 'new' then
      v_new := 'new';
    end if;

    continue when v_new is null;   -- not a valid step for this applicant: skip

    update public.submissions
       set status = v_new,
           slot_id = case when v_new = 'new' then null else slot_id end
     where id = v_sub.id;

    if p_send_email and v_template is not null then
      insert into public.email_log (application_id, submission_id, template, to_email, to_name, queued_by)
      values (v_sub.application_id, v_sub.id, v_template, v_sub.email, v_sub.name, coalesce(public.team_city(), 'Team'));
    end if;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- ── Function privileges ─────────────────────────────────────────────────────

revoke execute on function
  public.published_applications(), public.is_application_open(uuid),
  public.submit_application(uuid, jsonb, boolean), public.get_booking(uuid), public.book_slot(uuid, uuid),
  public.decide(uuid[], text, boolean)
from public;

grant execute on function
  public.published_applications(), public.is_application_open(uuid),
  public.submit_application(uuid, jsonb, boolean), public.get_booking(uuid), public.book_slot(uuid, uuid)
to anon, authenticated;

grant execute on function public.decide(uuid[], text, boolean) to authenticated;

-- Internal trigger/helper functions are not callable through the API.
revoke execute on function
  public.set_updated_at(), public.check_submission_slot(), public.fill_comment_author(), public.log_status_change()
from public, anon, authenticated;
