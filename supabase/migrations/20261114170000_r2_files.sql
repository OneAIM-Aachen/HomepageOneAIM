-- ============================================================================
-- Files on Cloudflare R2 (CVs and other application uploads, claim receipts)
--   Supabase keeps all data; for each file it stores where the file is:
--   "r2:uploads/<application>/<uuid>/<file>" or
--   "r2:receipts/<city>/<member>/<uuid>/<file>". Paths without "r2:" are
--   files still in Supabase Storage (until moved).
--   The edge function "files" signs short-lived upload/download links after
--   checking the rules below. The R2 keys are in storage_settings (service
--   role only), entered under Settings → File storage.
-- ============================================================================

create table public.storage_settings (
  id                boolean primary key default true check (id),
  account_id        text not null check (account_id ~ '^[0-9a-f]{32}$'),
  access_key_id     text not null,
  secret_access_key text not null,
  bucket            text not null check (bucket ~ '^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$'),
  jurisdiction      text not null default 'eu' check (jurisdiction in ('eu', 'default')),
  updated_at        timestamptz not null default now(),
  updated_by        text
);
alter table public.storage_settings enable row level security;   -- no policies: service role only

create or replace function public.storage_settings_status()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when not public.is_team() then null else coalesce(
    (select jsonb_build_object('configured', true, 'bucket', bucket, 'jurisdiction', jurisdiction, 'updated_at', updated_at, 'updated_by', updated_by)
     from public.storage_settings),
    jsonb_build_object('configured', false)) end;
$$;
revoke execute on function public.storage_settings_status() from public, anon;
grant execute on function public.storage_settings_status() to authenticated;

-- Who may open a stored file (R2 or Supabase path)
create or replace function public.can_read_file(p_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_path like 'r2:uploads/%' or p_path like 'uploads/%' then public.is_team()
    when p_path like 'r2:receipts/%' then
      split_part(p_path, '/', 3) = coalesce(public.my_member_id()::text, '-')
      or exists (select 1 from public.claims c where c.receipt_path = p_path and public.is_finance(c.location_id))
    else public.can_read_receipt(p_path)
  end;
$$;

-- Who may delete a stored R2 file: the team (application uploads), or the
-- member for their own receipt that no claim uses (any more)
create or replace function public.can_delete_file(p_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_path like 'r2:uploads/%' then public.is_team()
    when p_path like 'r2:receipts/%' then
      split_part(p_path, '/', 3) = coalesce(public.my_member_id()::text, '-')
      and not exists (select 1 from public.claims c where c.receipt_path = p_path)
    else false
  end;
$$;

revoke execute on function public.can_read_file(text), public.can_delete_file(text) from public, anon;
grant execute on function public.can_read_file(text), public.can_delete_file(text) to authenticated;

-- Claims: receipts in Supabase Storage (<city>/<member>/…) or on R2 (r2:receipts/<city>/<member>/…)
drop policy "submit own claim" on public.claims;
create policy "submit own claim" on public.claims
  for insert to authenticated
  with check (
    member_id = (select public.my_member_id())
    and status = 'submitted' and note is null and answer is null
    and decided_by is null and decided_at is null and paid_by is null and paid_at is null
    and (receipt_path like location_id || '/' || member_id::text || '/%'
         or receipt_path like 'r2:receipts/' || location_id || '/' || member_id::text || '/%')
  );

-- Applications: uploaded files may also be on R2 (r2:uploads/<application>/…)
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
  v_companies    jsonb := '[]';
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
       and (v_value ->> 'path') not like 'uploads/' || p_application_id::text || '/%'
       and (v_value ->> 'path') not like 'r2:uploads/' || p_application_id::text || '/%' then
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

    -- Company affiliations: [{company, position, from, to}, …], or "none" (no company yet)
    if v_field ->> 'kind' = 'company' and v_value is not null and jsonb_typeof(v_value) <> 'null' then
      if jsonb_typeof(v_value) = 'array' then
        v_companies := public.clean_companies(v_value);
      elsif not (jsonb_typeof(v_value) = 'string' and v_value #>> '{}' = 'none') then
        raise exception 'missing_field:%', v_field ->> 'id';
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

  insert into public.people as pe (email, name, phone, linkedin, universities, study_programs, companies, semester, degree)
  values (v_email, v_name, v_profile ->> 'phone', v_profile ->> 'linkedin', v_universities,
          v_programs, v_companies, v_profile ->> 'semester', v_profile ->> 'degree')
  on conflict (email) do update set
    phone          = coalesce(excluded.phone, pe.phone),
    linkedin       = coalesce(excluded.linkedin, pe.linkedin),
    -- the newest application describes the current affiliations completely
    universities   = excluded.universities,
    study_programs = excluded.study_programs,
    -- companies add up over time (an old internship stays an affiliation)
    companies      = (select coalesce(jsonb_agg(distinct x), '[]') from jsonb_array_elements(pe.companies || excluded.companies) x),
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

grant execute on function public.submit_application(uuid, jsonb, boolean) to anon, authenticated;
