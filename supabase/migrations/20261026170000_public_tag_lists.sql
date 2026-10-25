-- Public list of locations and programs for the filters on apply.one-aim.org
-- (names only; the tables themselves stay closed to the public key).
create or replace function public.public_tag_lists()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'locations', coalesce((select jsonb_agg(name order by sort_order, name) from public.locations), '[]'::jsonb),
    'programs',  coalesce((select jsonb_agg(name order by sort_order, name) from public.programs), '[]'::jsonb)
  );
$$;

revoke execute on function public.public_tag_lists() from public;
grant execute on function public.public_tag_lists() to anon, authenticated;
