-- The application rounds that were written into the main website's code
-- (src/data/applications.ts, Tally forms, WS 26/27) move into the database, so
-- rounds come only from here. Published and closed; they keep the website's
-- semester timelines. Skipped when a round for the same program, city and
-- semester already exists.
do $$
declare
  r record;
  v_slug text;
begin
  for r in
    select * from (values
      ('aim-connect',  'munich',    'ws26', 'interview'::public.pipeline, date '2026-09-01', date '2026-09-13', null::time, date '2026-09-18', date '2026-09-22', null::text, date '2026-09-27', date '2026-10-16'),
      ('aim-connect',  'frankfurt', 'ws26', 'interview',                  date '2026-08-30', date '2026-09-25', null,       null,              null,              'Oct',      date '2026-10-11', date '2026-10-24'),
      ('aim-connect',  'aachen',    'ws26', 'interview',                  date '2026-08-30', date '2026-09-22', null,       date '2026-09-25', date '2026-09-27', null,       date '2026-09-27', date '2026-10-23'),
      ('aim-innovate', 'munich',    'ws26', 'screening',                  date '2026-10-20', date '2026-11-01', null,       null,              null,              null,       null,              null),
      ('aim-code',     'aachen',    'ws26', 'screening',                  date '2026-10-21', date '2026-11-06', time '12:00', null,            null,              null,       null,              null)
    ) as t(program_id, location_id, semester_id, pipeline, opens_at, deadline, deadline_time,
           interviews_from, interviews_to, interviews_label, decision_by, starts_at)
  loop
    if exists (select 1 from public.applications a
               where a.program_id = r.program_id and a.location_id = r.location_id and a.semester_id = r.semester_id) then
      raise notice 'skipped % % %: a round exists already', r.location_id, r.program_id, r.semester_id;
      continue;
    end if;
    v_slug := r.location_id || '-' || r.program_id || '-' || r.semester_id;
    if exists (select 1 from public.applications where slug = v_slug) then v_slug := v_slug || '-tally'; end if;
    insert into public.applications (slug, blueprint_name, program_id, location_id, semester_id, pipeline, published,
                                     opens_at, deadline, deadline_time, interviews_from, interviews_to, interviews_label,
                                     decision_by, starts_at, created_by_city)
    values (v_slug, 'Tally form (before the team area)', r.program_id, r.location_id, r.semester_id, r.pipeline, true,
            r.opens_at, r.deadline, r.deadline_time, r.interviews_from, r.interviews_to, r.interviews_label,
            r.decision_by, r.starts_at, (select name from public.locations where id = r.location_id));
    raise notice 'imported %', v_slug;
  end loop;
end;
$$;
