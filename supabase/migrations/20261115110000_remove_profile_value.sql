-- "Deny" a value entered via "Other" (Settings → Universities, study programs
-- & companies): remove it from every profile that has it. The people keep
-- their other entries; the original application answers stay unchanged.

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

revoke execute on function public.remove_profile_value(text, text) from public, anon;
grant execute on function public.remove_profile_value(text, text) to authenticated;
