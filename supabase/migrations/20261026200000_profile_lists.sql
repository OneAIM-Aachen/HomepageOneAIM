-- ============================================================================
-- Profile fields from lists (for clean statistics)
-- • universities / study_programs: managed lists (Settings in the team area),
--   study programs grouped by field ("category") for the analysis.
-- • people.universities / people.study_programs: several values per person
--   (double degrees, several affiliations). Values not in the list come from
--   "Other (please specify)" and can be merged by the team.
-- • Every form always contains name, email, university, study program,
--   semester and degree level, all mandatory (enforced by trigger).
-- ============================================================================

create table public.universities (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique check (length(trim(name)) > 0),
  city       text,
  created_at timestamptz not null default now()
);

create table public.study_programs (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique check (length(trim(name)) > 0),
  category   text not null default 'Other',
  created_at timestamptz not null default now()
);

alter table public.universities enable row level security;
alter table public.study_programs enable row level security;
revoke all on table public.universities, public.study_programs from anon;
create policy "team full access" on public.universities
  for all to authenticated using ((select public.is_team())) with check ((select public.is_team()));
create policy "team full access" on public.study_programs
  for all to authenticated using ((select public.is_team())) with check ((select public.is_team()));

insert into public.universities (name, city) values
  ('Technical University of Munich (TUM)', 'Munich'),
  ('LMU Munich', 'Munich'),
  ('Munich University of Applied Sciences (HM)', 'Munich'),
  ('University of the Bundeswehr Munich', 'Munich'),
  ('RWTH Aachen University', 'Aachen'),
  ('FH Aachen University of Applied Sciences', 'Aachen'),
  ('Goethe University Frankfurt', 'Frankfurt'),
  ('Frankfurt University of Applied Sciences', 'Frankfurt'),
  ('Frankfurt School of Finance & Management', 'Frankfurt'),
  ('TU Darmstadt', 'Frankfurt'),
  ('Johannes Gutenberg University Mainz', 'Frankfurt'),
  ('Heidelberg University', null),
  ('University of Cologne', null),
  ('Charité – Universitätsmedizin Berlin', null),
  ('Karlsruhe Institute of Technology (KIT)', null),
  ('ETH Zurich', null)
on conflict (name) do nothing;

insert into public.study_programs (name, category) values
  ('Medicine', 'Medicine & health'),
  ('Dentistry', 'Medicine & health'),
  ('Pharmacy', 'Medicine & health'),
  ('Molecular Medicine', 'Medicine & health'),
  ('Biomedical Sciences', 'Medicine & health'),
  ('Health Sciences', 'Medicine & health'),
  ('Psychology', 'Medicine & health'),
  ('Nursing / Midwifery', 'Medicine & health'),
  ('Mechanical Engineering', 'Engineering'),
  ('Electrical Engineering', 'Engineering'),
  ('Biomedical Engineering / Medical Technology', 'Engineering'),
  ('Chemical Engineering', 'Engineering'),
  ('Materials Science', 'Engineering'),
  ('Mechatronics / Robotics', 'Engineering'),
  ('Industrial Engineering', 'Engineering'),
  ('Computer Science', 'Computer science & data'),
  ('Data Science', 'Computer science & data'),
  ('Artificial Intelligence', 'Computer science & data'),
  ('Medical Informatics', 'Computer science & data'),
  ('Bioinformatics', 'Computer science & data'),
  ('Mathematics', 'Computer science & data'),
  ('Physics', 'Natural sciences'),
  ('Chemistry', 'Natural sciences'),
  ('Biology', 'Natural sciences'),
  ('Biochemistry', 'Natural sciences'),
  ('Biotechnology', 'Natural sciences'),
  ('Neuroscience', 'Natural sciences'),
  ('Business Administration', 'Business, economics & law'),
  ('Economics', 'Business, economics & law'),
  ('Management & Technology', 'Business, economics & law'),
  ('Law', 'Business, economics & law')
on conflict (name) do nothing;

-- Fixed answer options (same lists as the portal, portal/src/lib/fields.ts)
create or replace function public.degree_options()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['Bachelor', 'Master', 'State exam (Staatsexamen)', 'Diploma', 'PhD / Doctorate', 'Graduated / working', 'Not studying'];
$$;

create or replace function public.semester_options()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['1','2','3','4','5','6','7','8','9','10','11','12','12+','Not applicable'];
$$;

-- ── People: several universities / study programs ───────────────────────────

alter table public.people
  add column universities   text[] not null default '{}',
  add column study_programs text[] not null default '{}';

update public.people set
  universities   = case when university is not null and trim(university) <> '' then array[trim(university)] else '{}' end,
  study_programs = case when study_program is not null and trim(study_program) <> '' then array[trim(study_program)] else '{}' end;

alter table public.people drop column university, drop column study_program;

create index people_universities_idx on public.people using gin (universities);
create index people_study_programs_idx on public.people using gin (study_programs);

-- ── Mandatory core fields in every form ─────────────────────────────────────

create or replace function public.ensure_core_fields(f jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  core jsonb := '[
    {"id":"name","kind":"name","label":"Full name","required":true},
    {"id":"email","kind":"email","label":"Email address","required":true},
    {"id":"university","kind":"university","label":"University affiliations","help":"List every university you are or were affiliated with: your degree program(s), exchange semesters, research internships, theses abroad, etc.","required":true},
    {"id":"studyProgram","kind":"studyProgram","label":"Study program(s)","required":true},
    {"id":"semester","kind":"semester","label":"Current semester","required":true},
    {"id":"degree","kind":"degree","label":"Degree level","required":true}
  ]';
  kinds text[] := array['name', 'email', 'university', 'studyProgram', 'semester', 'degree'];
  fixed jsonb;
  missing jsonb;
begin
  if f is null or jsonb_typeof(f) <> 'array' then f := '[]'; end if;

  -- existing core fields: always required, options come from the lists;
  -- the university field always explains that every affiliation counts
  select coalesce(jsonb_agg(
           case
             when e ->> 'kind' = 'university' then (e - 'options') || ((core -> 2) - 'id')
             when e ->> 'kind' = any (kinds) then (e - 'options') || '{"required": true}'::jsonb
             else e
           end
           order by n), '[]'::jsonb)
    into fixed
  from jsonb_array_elements(f) with ordinality as t(e, n);

  -- missing core fields go to the top, in the fixed order
  select coalesce(jsonb_agg(c order by n), '[]'::jsonb)
    into missing
  from jsonb_array_elements(core) with ordinality as t(c, n)
  where not exists (select 1 from jsonb_array_elements(fixed) e where e ->> 'kind' = c ->> 'kind');

  if jsonb_array_length(missing) = 0 then return fixed; end if;

  -- keep name/email first if present, then the missing ones, then the rest
  return coalesce((select jsonb_agg(e order by n) from jsonb_array_elements(fixed) with ordinality as t(e, n)
                   where e ->> 'kind' in ('name', 'email')), '[]'::jsonb)
      || (select coalesce(jsonb_agg(c order by n), '[]'::jsonb) from jsonb_array_elements(missing) with ordinality as t(c, n)
          where c ->> 'kind' not in ('name', 'email'))
      || (select coalesce(jsonb_agg(c order by n), '[]'::jsonb) from jsonb_array_elements(missing) with ordinality as t(c, n)
          where c ->> 'kind' in ('name', 'email'))
      || coalesce((select jsonb_agg(e order by n) from jsonb_array_elements(fixed) with ordinality as t(e, n)
                   where e ->> 'kind' not in ('name', 'email')), '[]'::jsonb);
end;
$$;

create or replace function public.enforce_core_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.fields := public.ensure_core_fields(new.fields);
  return new;
end;
$$;

create trigger blueprints_core_fields before insert or update of fields on public.blueprints
  for each row execute function public.enforce_core_fields();
create trigger applications_core_fields before insert or update of fields on public.applications
  for each row execute function public.enforce_core_fields();

-- apply to existing forms
update public.blueprints set fields = fields;
update public.applications set fields = fields;

-- ── Public: list options for the apply form ─────────────────────────────────

create or replace function public.public_form_options()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'universities',  coalesce((select jsonb_agg(name order by name) from public.universities), '[]'::jsonb),
    'studyPrograms', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'category', category) order by category, name)
                               from public.study_programs), '[]'::jsonb),
    'degrees',   to_jsonb(public.degree_options()),
    'semesters', to_jsonb(public.semester_options())
  );
$$;

-- ── Team: merge an "Other" value into a list entry (or rename) ──────────────

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
  elsif p_kind = 'studyProgram' then
    update public.people
       set study_programs = (select array_agg(distinct x order by x) from unnest(array_replace(study_programs, p_from, p_to)) x)
     where p_from = any (study_programs);
  else
    raise exception 'invalid_kind';
  end if;
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function public.ensure_core_fields(jsonb), public.enforce_core_fields(),
  public.degree_options(), public.semester_options() from public, anon;
revoke execute on function public.enforce_core_fields() from authenticated;
revoke execute on function public.merge_profile_value(text, text, text) from public, anon;
grant execute on function public.merge_profile_value(text, text, text) to authenticated;
revoke execute on function public.public_form_options() from public;
grant execute on function public.public_form_options() to anon, authenticated;
