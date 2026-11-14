-- "Papers" are called "publications" everywhere (column, field kind, network
-- profile key, functions). Renamed the same day they were added; no data yet.

alter table public.people rename column papers to publications;

create or replace function public.clean_publications(v jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  out jsonb;
begin
  if v is null or jsonb_typeof(v) <> 'array' then return '[]'; end if;
  if exists (select 1 from jsonb_array_elements(v) e
             where jsonb_typeof(e) <> 'object' or coalesce(btrim(e ->> 'title'), '') = '' or coalesce(e ->> 'year', '') !~ '^(19|20)[0-9]{2}$') then
    raise exception 'missing_field:publications';
  end if;
  if exists (select 1 from jsonb_array_elements(v) e where nullif(btrim(e ->> 'url'), '') is not null and btrim(e ->> 'url') !~ '^https?://\S+$') then
    raise exception 'invalid_option:publications';
  end if;
  select coalesce(jsonb_agg(x order by (x ->> 'year') desc, x ->> 'title'), '[]') into out from (
    select distinct on (lower(btrim(e ->> 'title')), e ->> 'year')
           jsonb_build_object('title', left(btrim(e ->> 'title'), 300), 'year', (e ->> 'year')::int, 'url', nullif(btrim(e ->> 'url'), '')) x
    from jsonb_array_elements(v) e
    order by lower(btrim(e ->> 'title')), e ->> 'year', nullif(btrim(e ->> 'url'), '') nulls last
  ) d;
  return out;
end;
$$;

revoke execute on function public.clean_publications(jsonb) from public, anon, authenticated;

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
  v_groups       jsonb := '[]';
  v_publications jsonb := '[]';
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

    -- Research groups: [{group, role, from, to}, …]; publications: [{title, year, url}, …] (optional fields)
    if v_field ->> 'kind' = 'researchGroup' and v_value is not null and jsonb_typeof(v_value) = 'array' then
      v_groups := public.clean_research_groups(v_value);
    end if;
    if v_field ->> 'kind' = 'publications' and v_value is not null and jsonb_typeof(v_value) = 'array' then
      v_publications := public.clean_publications(v_value);
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

  insert into public.people as pe (email, name, phone, linkedin, universities, study_programs, companies, research_groups, publications, semester, degree)
  values (v_email, v_name, v_profile ->> 'phone', v_profile ->> 'linkedin', v_universities,
          v_programs, v_companies, v_groups, v_publications, v_profile ->> 'semester', v_profile ->> 'degree')
  on conflict (email) do update set
    phone          = coalesce(excluded.phone, pe.phone),
    linkedin       = coalesce(excluded.linkedin, pe.linkedin),
    -- the newest application describes the current affiliations completely
    universities   = excluded.universities,
    study_programs = excluded.study_programs,
    -- companies add up over time (an old internship stays an affiliation)
    companies      = (select coalesce(jsonb_agg(distinct x), '[]') from jsonb_array_elements(pe.companies || excluded.companies) x),
    research_groups = (select coalesce(jsonb_agg(distinct x), '[]') from jsonb_array_elements(pe.research_groups || excluded.research_groups) x),
    publications   = public.clean_publications(pe.publications || excluded.publications),
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

create or replace function public.network_profile_json(p_person uuid, p_member uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with p as (select * from public.people where id = p_person),
       m as (select * from public.team_members where id = coalesce(p_member, (select id from public.team_members where person_id = p_person)))
  select jsonb_build_object(
    'key', coalesce(p_person, p_member),
    'name', coalesce((select name from p), (select name from m)),
    'photo', coalesce((select photo_url from m), (select photo_url from p)),
    'email', (select email from p),
    'phone', (select phone from p),
    'linkedin', coalesce((select linkedin from p), (select linkedin from m)),
    'universities', coalesce((select universities from p), '{}'),
    'studyPrograms', coalesce((select study_programs from p), '{}'),
    'companies', coalesce((select companies from p), '[]'),
    'researchGroups', coalesce((select research_groups from p), '[]'),
    'publications', coalesce((select publications from p), '[]'),
    'semester', (select semester from p),
    'degree', (select degree from p),
    'participations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'title', coalesce(a.title, pr.name || ' ' || l.name || ' – ' || se.label),
        'program', pr.name, 'city', l.name, 'semester', se.label, 'event', a.pipeline = 'instant') order by a.opens_at desc)
      from public.submissions s
      join public.applications a on a.id = s.application_id
      join public.programs pr on pr.id = a.program_id
      join public.locations l on l.id = a.location_id
      join public.semesters se on se.id = a.semester_id
      where s.person_id = p_person and s.status in ('accepted', 'confirmed')), '[]'),
    'team', (select jsonb_build_object(
        'status', m.status, 'city', l.name, 'role', m.role, 'position', m.position,
        'department', (select name from public.team_departments where id = m.department_id),
        'alumniSince', m.alumni_since,
        'history', coalesce((select jsonb_agg(jsonb_build_object(
            'id', r.id, 'city', rl.name, 'role', r.role, 'department', r.department, 'position', r.position,
            'from', r.started_on, 'to', r.ended_on) order by r.started_on)
          from public.team_member_roles r join public.locations rl on rl.id = r.location_id where r.member_id = m.id), '[]'))
      from m join public.locations l on l.id = m.location_id)
  );
$$;

create or replace function public.network_update_me(p jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_person uuid := public.my_person_id();
begin
  if not public.is_network_member() or v_person is null then raise exception 'not_allowed'; end if;
  if p ? 'photo' and nullif(p ->> 'photo', '') is not null and (p ->> 'photo') !~ '^https://' then raise exception 'invalid_option'; end if;
  update public.people set
    phone          = case when p ? 'phone' then nullif(btrim(p ->> 'phone'), '') else phone end,
    linkedin       = case when p ? 'linkedin' then nullif(btrim(p ->> 'linkedin'), '') else linkedin end,
    universities   = case when p ? 'universities' then array(select jsonb_array_elements_text(p -> 'universities')) else universities end,
    study_programs = case when p ? 'studyPrograms' then array(select jsonb_array_elements_text(p -> 'studyPrograms')) else study_programs end,
    companies      = case when p ? 'companies' then public.clean_companies(p -> 'companies') else companies end,
    research_groups = case when p ? 'researchGroups' then public.clean_research_groups(p -> 'researchGroups') else research_groups end,
    publications   = case when p ? 'publications' then public.clean_publications(p -> 'publications') else publications end,
    semester       = case when p ? 'semester' then nullif(p ->> 'semester', '') else semester end,
    degree         = case when p ? 'degree' then nullif(p ->> 'degree', '') else degree end,
    photo_url      = case when p ? 'photo' then nullif(p ->> 'photo', '') else photo_url end
  where id = v_person;
  -- Team members: the photo is the team photo as well
  if p ? 'photo' then
    update public.team_members set photo_url = nullif(p ->> 'photo', '') where person_id = v_person;
  end if;
end;
$$;

drop function public.clean_papers(jsonb);
