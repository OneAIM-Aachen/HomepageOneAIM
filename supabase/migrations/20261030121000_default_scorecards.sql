-- Existing applications get the standard scorecards (new ones get them on creation):
-- screening for screening/interview pipelines, interview for interview pipelines.
update public.applications a
set scorecards = jsonb_strip_nulls(jsonb_build_object(
  'screening', (select jsonb_build_object('name', name, 'criteria', criteria) from public.scorecards where name = 'Screening – standard'),
  'interview', case when a.pipeline = 'interview'
                    then (select jsonb_build_object('name', name, 'criteria', criteria) from public.scorecards where name = 'Interview – standard') end))
where a.pipeline <> 'instant' and a.scorecards = '{}';
