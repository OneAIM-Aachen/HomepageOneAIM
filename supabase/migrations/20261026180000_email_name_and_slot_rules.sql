-- ============================================================================
-- 1) Same email, different name: refuse instead of merging.
--    Before, a second applicant using an existing email address silently
--    took over that person's profile (incl. renaming it).
-- 2) Interview slots: can't be created in the past; invite_blocker tells
--    "slots_in_past" apart from "no_free_slots".
-- ============================================================================

-- Name comparison ignoring case and extra spaces ("Eric  hölpes" = "Eric Hölpes")
create or replace function public.normalize_name(n text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(regexp_replace(trim(coalesce(n, '')), '\s+', ' ', 'g'));
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
  v_existing_name text;
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

  -- One profile per email address. An address that already belongs to
  -- someone with a different name is refused (no silent merging/renaming).
  select id, name into v_person_id, v_existing_name from public.people where email = v_email;
  if v_person_id is not null and public.normalize_name(v_existing_name) <> public.normalize_name(v_name) then
    raise exception 'email_name_mismatch';
  end if;

  -- Newest answers update the profile (the name stays as first registered)
  insert into public.people as pe (email, name, phone, linkedin, university, study_program, semester, degree)
  values (v_email, v_name, v_profile ->> 'phone', v_profile ->> 'linkedin', v_profile ->> 'university',
          v_profile ->> 'studyProgram', v_profile ->> 'semester', v_profile ->> 'degree')
  on conflict (email) do update set
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

-- ── Interview slots ─────────────────────────────────────────────────────────

create or replace function public.check_slot_in_future()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (tg_op = 'INSERT' or new.starts_at is distinct from old.starts_at) and new.starts_at <= now() then
    raise exception 'slot_in_past';
  end if;
  return new;
end;
$$;

create trigger interview_slots_future before insert or update of starts_at on public.interview_slots
  for each row execute function public.check_slot_in_future();

create or replace function public.invite_blocker(p_application_id uuid)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when exists (select 1 from public.interview_slots s where s.application_id = p_application_id)
     and not exists (select 1 from public.interview_slots s where s.application_id = p_application_id and s.starts_at > now())
      then 'slots_in_past'
    when not exists (
      select 1 from public.interview_slots s
      where s.application_id = p_application_id and s.starts_at > now()
        and s.capacity > (select count(*) from public.submissions x where x.slot_id = s.id)
    ) then 'no_free_slots'
    when exists (
      select 1 from public.interview_slots s
      where s.application_id = p_application_id and s.starts_at > now() and not public.slot_complete(s)
    ) then 'slots_incomplete'
    else null
  end;
$$;

revoke execute on function public.normalize_name(text), public.check_slot_in_future() from public, anon, authenticated;
grant execute on function public.normalize_name(text) to authenticated;
revoke execute on function public.submit_application(uuid, jsonb, boolean) from public;
grant execute on function public.submit_application(uuid, jsonb, boolean) to anon, authenticated;
