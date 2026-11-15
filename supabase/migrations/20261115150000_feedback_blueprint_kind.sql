-- Feedback forms that were created as application blueprints (the old "New blueprint"
-- button always made application forms) become feedback forms: they no longer show up
-- when creating a new application. Only blueprints with "feedback" in the name that no
-- application uses. The profile fields added for application forms are removed.
update public.blueprints b
set kind = 'feedback',
    fields = coalesce((
      select jsonb_agg(f order by n)
      from jsonb_array_elements(b.fields) with ordinality as x(f, n)
      where f ->> 'kind' not in ('name', 'email', 'university', 'studyProgram', 'company', 'semester', 'degree')
    ), '[]'::jsonb)
where b.kind = 'application'
  and b.name ilike '%feedback%'
  and not exists (select 1 from public.applications a where a.blueprint_name = b.name);
