-- Aachen: "Interview & Application Management" → "Interview & Applications"
update public.team_departments
set name = 'Interview & Applications'
where name in ('Interview & Application Management', 'Interview & Application')
  and not exists (select 1 from public.team_departments d2
                  where d2.location_id = team_departments.location_id and d2.name = 'Interview & Applications');
