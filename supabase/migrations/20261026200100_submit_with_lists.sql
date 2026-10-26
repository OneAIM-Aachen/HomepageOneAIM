-- ============================================================================
-- submit_application(): university affiliations and study programs are lists
-- (several values; "Other" values as free text), semester and degree level
-- only from the fixed options. All six profile fields are mandatory
-- (enforced on the form by ensure_core_fields()).
-- ============================================================================

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
  v_universities text[] := '{}';
  v_programs     text[] := '{}';
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

    -- University affiliations / study programs: lists of names (several allowed)
    if v_field ->> 'kind' in ('university', 'studyProgram') and v_value is not null then
      if jsonb_typeof(v_value) = 'string' then v_value := jsonb_build_array(v_value); end if;
      if jsonb_typeof(v_value) <> 'array' then raise exception 'missing_field:%', v_field ->> 'id'; end if;
      if v_field ->> 'kind' = 'university' then
        select coalesce(array_agg(distinct trim(x)) filter (where trim(x) <> ''), '{}') into v_universities
        from jsonb_array_elements_text(v_value) x;
      else
        select coalesce(array_agg(distinct trim(x)) filter (where trim(x) <> ''), '{}') into v_programs
        from jsonb_array_elements_text(v_value) x;
      end if;
    end if;

    -- Semester / degree level: only the defined options
    if v_field ->> 'kind' = 'semester' and v_value is not null and jsonb_typeof(v_value) <> 'null'
       and not ((v_value #>> '{}') = any (public.semester_options())) then
      raise exception 'invalid_option:%', v_field ->> 'id';
    end if;
    if v_field ->> 'kind' = 'degree' and v_value is not null and jsonb_typeof(v_value) <> 'null'
       and not ((v_value #>> '{}') = any (public.degree_options())) then
      raise exception 'invalid_option:%', v_field ->> 'id';
    end if;

    if v_field ->> 'kind' in ('name', 'email', 'phone', 'linkedin', 'semester', 'degree')
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
  if cardinality(v_universities) = 0 then raise exception 'missing_field:university'; end if;
  if cardinality(v_programs) = 0 then raise exception 'missing_field:studyProgram'; end if;

  insert into public.people as pe (email, name, phone, linkedin, universities, study_programs, semester, degree)
  values (v_email, v_name, v_profile ->> 'phone', v_profile ->> 'linkedin', v_universities,
          v_programs, v_profile ->> 'semester', v_profile ->> 'degree')
  on conflict (email) do update set
    phone          = coalesce(excluded.phone, pe.phone),
    linkedin       = coalesce(excluded.linkedin, pe.linkedin),
    -- the newest application describes the current affiliations completely
    universities   = excluded.universities,
    study_programs = excluded.study_programs,
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

revoke execute on function public.submit_application(uuid, jsonb, boolean) from public;
grant execute on function public.submit_application(uuid, jsonb, boolean) to anon, authenticated;
