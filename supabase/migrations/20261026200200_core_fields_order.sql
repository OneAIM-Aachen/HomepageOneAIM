-- Core profile fields always at the top of every form, in a fixed order:
-- name, email, university affiliations, study programs, semester, degree.
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
begin
  if f is null or jsonb_typeof(f) <> 'array' then f := '[]'; end if;
  return
    -- core fields: existing one (first of its kind) or the default, in fixed order
    (select coalesce(jsonb_agg(
              case
                when c ->> 'kind' = 'university' then coalesce(ex - 'options', '{}'::jsonb) || (c - 'id') || jsonb_build_object('id', coalesce(ex ->> 'id', c ->> 'id'))
                when ex is not null then (ex - 'options') || '{"required": true}'::jsonb
                else c
              end order by n), '[]'::jsonb)
     from jsonb_array_elements(core) with ordinality as t(c, n)
     left join lateral (
       select e as ex from jsonb_array_elements(f) with ordinality as u(e, m)
       where e ->> 'kind' = c ->> 'kind' order by m limit 1
     ) x on true)
    ||
    -- all other fields, in their order (duplicates of core kinds dropped)
    coalesce((select jsonb_agg(e order by m) from jsonb_array_elements(f) with ordinality as u(e, m)
              where not (e ->> 'kind' = any (kinds))), '[]'::jsonb);
end;
$$;

update public.blueprints set fields = fields;
update public.applications set fields = fields;
