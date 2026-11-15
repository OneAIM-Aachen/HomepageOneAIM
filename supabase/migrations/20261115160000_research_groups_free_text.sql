-- ============================================================================
-- Research groups as free text
--   • An entry is: university (from the university list), group and professor
--     (free text), role, start / end. No managed list of research groups.
--   • Existing entries get the university from the old list (its institution).
--   • The research_groups list is removed (Settings, form options, merge / deny).
--   • Merging a university in Settings also renames it in research group entries.
-- ============================================================================

-- University for existing entries, from the old list
update public.people pe
set research_groups = (
  select coalesce(jsonb_agg(
           case when coalesce(x ->> 'university', '') = '' and rg.institution is not null
                then x || jsonb_build_object('university', rg.institution) else x end), '[]'::jsonb)
  from jsonb_array_elements(pe.research_groups) x
  left join public.research_groups rg on rg.name = x ->> 'group'
)
where jsonb_array_length(pe.research_groups) > 0;

create or replace function public.clean_research_groups(v jsonb)
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
             where jsonb_typeof(e) <> 'object'
                or coalesce(btrim(e ->> 'university'), '') = ''
                or coalesce(btrim(e ->> 'group'), '') = ''
                or coalesce(btrim(e ->> 'role'), '') = ''
                or coalesce(e ->> 'from', '') !~ '^[0-9]{4}-(0[1-9]|1[0-2])$') then
    raise exception 'missing_field:researchGroup';
  end if;
  if exists (select 1 from jsonb_array_elements(v) e
             where nullif(e ->> 'to', '') is not null and ((e ->> 'to') !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' or (e ->> 'to') < (e ->> 'from'))) then
    raise exception 'invalid_option:researchGroup';
  end if;
  select coalesce(jsonb_agg(distinct jsonb_strip_nulls(jsonb_build_object(
           'university', left(btrim(e ->> 'university'), 200),
           'group',      left(btrim(e ->> 'group'), 200),
           'professor',  nullif(left(btrim(coalesce(e ->> 'professor', '')), 120), ''),
           'role',       left(btrim(e ->> 'role'), 120),
           'from',       e ->> 'from',
           'to',         nullif(e ->> 'to', '')))), '[]')
    into out from jsonb_array_elements(v) e;
  return out;
end;
$$;

revoke execute on function public.clean_research_groups(jsonb) from public, anon, authenticated;

create or replace function public.public_form_options()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'universities',  coalesce((select jsonb_agg(jsonb_build_object('name', name, 'country', country, 'aliases', aliases) order by name)
                               from public.universities), '[]'::jsonb),
    'studyPrograms', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'category', category) order by category, name)
                               from public.study_programs), '[]'::jsonb),
    'companies',     coalesce((select jsonb_agg(jsonb_build_object('name', name, 'category', category, 'aliases', aliases) order by name)
                               from public.companies), '[]'::jsonb),
    'degrees',   to_jsonb(public.degree_options()),
    'semesters', to_jsonb(public.semester_options())
  );
$$;

create or replace function public.merge_profile_value(p_kind text, p_from text, p_to text)
returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  n int;
begin
  if not public.is_team() then raise exception 'not_allowed'; end if;
  if p_kind = 'university' then
    update public.people
       set universities = (select array_agg(distinct x order by x) from unnest(array_replace(universities, p_from, p_to)) x)
     where p_from = any (universities);
    get diagnostics n = row_count;
    -- research group entries name a university too
    update public.people
       set research_groups = (select jsonb_agg(case when x ->> 'university' = p_from then jsonb_set(x, '{university}', to_jsonb(p_to)) else x end)
                              from jsonb_array_elements(research_groups) x)
     where research_groups @> jsonb_build_array(jsonb_build_object('university', p_from));
    return n;
  elsif p_kind = 'studyProgram' then
    update public.people
       set study_programs = (select array_agg(distinct x order by x) from unnest(array_replace(study_programs, p_from, p_to)) x)
     where p_from = any (study_programs);
  elsif p_kind = 'company' then
    update public.people
       set companies = (select jsonb_agg(distinct case when x ->> 'company' = p_from then jsonb_set(x, '{company}', to_jsonb(p_to)) else x end)
                        from jsonb_array_elements(companies) x)
     where companies @> jsonb_build_array(jsonb_build_object('company', p_from));
  else
    raise exception 'invalid_kind';
  end if;
  get diagnostics n = row_count;
  return n;
end;
$$;

create or replace function public.remove_profile_value(p_kind text, p_value text)
returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  n int;
begin
  if not public.is_team() then raise exception 'not_allowed'; end if;
  if p_kind = 'university' then
    update public.people set universities = array_remove(universities, p_value) where p_value = any (universities);
  elsif p_kind = 'studyProgram' then
    update public.people set study_programs = array_remove(study_programs, p_value) where p_value = any (study_programs);
  elsif p_kind = 'company' then
    update public.people
       set companies = coalesce((select jsonb_agg(x) from jsonb_array_elements(companies) x where x ->> 'company' is distinct from p_value), '[]'::jsonb)
     where companies @> jsonb_build_array(jsonb_build_object('company', p_value));
  else
    raise exception 'invalid_kind';
  end if;
  get diagnostics n = row_count;
  return n;
end;
$$;

drop table public.research_groups;
