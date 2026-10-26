-- ============================================================================
-- Remove external forms (Tally): every application uses our own form.
-- • rounds that only pointed to an external form are removed
-- • published_applications() / is_application_open() no longer use the field
-- • column applications.external_url is dropped
-- ============================================================================

delete from public.applications a
where a.external_url is not null
  and not exists (select 1 from public.submissions s where s.application_id = a.id);

drop function if exists public.published_applications();

create or replace function public.published_applications()
returns table (
  id uuid, slug text, title text, display_title text,
  program_id text, program_name text, location_id text, location_name text,
  semester_id text, semester_label text, pipeline public.pipeline, phase text,
  opens_at date, deadline date, deadline_time time,
  interviews_from date, interviews_to date, interviews_label text,
  decision_by date, starts_at date, spots int, fee text, intro text, image_path text,
  fields jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.slug, a.title,
         coalesce(a.title, p.name || ' ' || l.name || ' – ' || s.label) as display_title,
         a.program_id, p.name, a.location_id, l.name, a.semester_id, s.label, a.pipeline,
         case when public.today_berlin() < a.opens_at then 'upcoming'
              when public.today_berlin() <= a.deadline then 'open'
              else 'closed' end as phase,
         a.opens_at, a.deadline, a.deadline_time,
         a.interviews_from, a.interviews_to, a.interviews_label,
         a.decision_by, a.starts_at, a.spots, a.fee, a.intro, a.image_path,
         a.fields
  from public.applications a
  join public.programs  p on p.id = a.program_id
  join public.locations l on l.id = a.location_id
  join public.semesters s on s.id = a.semester_id
  where a.published
  order by a.deadline desc;
$$;

create or replace function public.is_application_open(p_application_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.applications a
    where a.id = p_application_id
      and a.published
      and public.today_berlin() between a.opens_at and a.deadline
  );
$$;

alter table public.applications drop column external_url;

revoke execute on function public.published_applications() from public;
grant execute on function public.published_applications() to anon, authenticated;
