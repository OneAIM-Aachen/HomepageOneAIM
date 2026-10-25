-- ============================================================================
-- OneAIM team portal – starting data
--   • tag lists (same slugs as the main website)
--   • four starter blueprints
--   • the WS 26/27 rounds from src/data/applications.ts, still pointing to
--     their Tally forms (external_url), so one-aim.org keeps showing them
--     once it reads from the database
-- ============================================================================

insert into public.programs (id, name, sort_order) values
  ('aim-connect',  'AIM Connect',  1),
  ('aim-code',     'AIM Code',     2),
  ('aim-innovate', 'AIM Innovate', 3),
  ('aim-educate',  'AIM Educate',  4),
  ('aim-science',  'AIM Science',  5)
on conflict (id) do nothing;

insert into public.locations (id, name, sort_order) values
  ('munich',    'Munich',    1),
  ('aachen',    'Aachen',    2),
  ('frankfurt', 'Frankfurt', 3)
on conflict (id) do nothing;

insert into public.semesters (id, term, start_year) values
  ('ss26', 'SS', 2026),
  ('ws26', 'WS', 2026),
  ('ss27', 'SS', 2027),
  ('ws27', 'WS', 2027)
on conflict (id) do nothing;

-- ── Starter blueprints ──────────────────────────────────────────────────────

insert into public.blueprints (name, description, fields) values
(
  'AIM Connect – standard',
  'Semester program application with CV, motivation and kickoff availability.',
  '[
    {"id":"name","kind":"name","label":"Full name","required":true},
    {"id":"email","kind":"email","label":"Email address","required":true},
    {"id":"cv","kind":"cv","label":"CV (PDF)","required":true},
    {"id":"phone","kind":"phone","label":"Phone number","required":false},
    {"id":"linkedin","kind":"linkedin","label":"LinkedIn profile","required":false},
    {"id":"uni","kind":"university","label":"University","required":true},
    {"id":"prog","kind":"studyProgram","label":"Study program","required":true},
    {"id":"sem","kind":"semester","label":"Current semester","required":true},
    {"id":"deg","kind":"degree","label":"Degree level","required":true,
     "options":["Bachelor","Master","State exam (Staatsexamen)","PhD","Other"]},
    {"id":"why","kind":"longText","label":"Why do you want to join AIM Connect?","required":true,"maxWords":200},
    {"id":"idea","kind":"longText","label":"Which problem in healthcare would you like to solve?","required":false,"maxWords":150},
    {"id":"heard","kind":"single","label":"How did you hear about us?","required":false,
     "options":["Instagram","LinkedIn","Friends","University","Event"]},
    {"id":"kickoff","kind":"yesno","label":"Can you attend the kickoff weekend?","required":true}
  ]'::jsonb
),
(
  'AIM Code – technical',
  'Course application focused on programming experience.',
  '[
    {"id":"name","kind":"name","label":"Full name","required":true},
    {"id":"email","kind":"email","label":"Email address","required":true},
    {"id":"cv","kind":"cv","label":"CV (PDF)","required":true},
    {"id":"uni","kind":"university","label":"University","required":true},
    {"id":"prog","kind":"studyProgram","label":"Study program","required":true},
    {"id":"sem","kind":"semester","label":"Current semester","required":false},
    {"id":"level","kind":"single","label":"How much programming experience do you have?","required":true,
     "options":["None yet","Some (courses)","Solid (projects)","Advanced (work experience)"]},
    {"id":"langs","kind":"multi","label":"Which languages have you used?","required":false,
     "options":["Python","R","MATLAB","JavaScript","C/C++","Other"]},
    {"id":"github","kind":"url","label":"GitHub or portfolio","required":false},
    {"id":"project","kind":"longText","label":"Tell us about a project you are proud of","required":true,"maxWords":150}
  ]'::jsonb
),
(
  'AIM Innovate – teams',
  'Founder teams applying with an idea and optional pitch deck.',
  '[
    {"id":"name","kind":"name","label":"Full name","required":true},
    {"id":"email","kind":"email","label":"Email address","required":true},
    {"id":"cv","kind":"cv","label":"CV (PDF)","required":true},
    {"id":"linkedin","kind":"linkedin","label":"LinkedIn profile","required":true},
    {"id":"uni","kind":"university","label":"University","required":true},
    {"id":"team","kind":"longText","label":"Describe your team and idea","required":true,"maxWords":250},
    {"id":"deck","kind":"file","label":"Pitch deck (optional)","required":false}
  ]'::jsonb
),
(
  'Event registration',
  'Short registration for open events (summits, lectures).',
  '[
    {"id":"name","kind":"name","label":"Full name","required":true},
    {"id":"email","kind":"email","label":"Email address","required":true},
    {"id":"uni","kind":"university","label":"University / organisation","required":false},
    {"id":"role","kind":"dropdown","label":"I am a …","required":true,
     "options":["Student","PhD candidate","Doctor / clinician","Industry professional","Other"]},
    {"id":"diet","kind":"shortText","label":"Dietary requirements","required":false}
  ]'::jsonb
)
on conflict (name) do nothing;

-- ── Current rounds (from src/data/applications.ts) ──────────────────────────

insert into public.applications (
  slug, blueprint_name, program_id, location_id, semester_id, pipeline, published,
  opens_at, deadline, deadline_time, interviews_from, interviews_to, interviews_label,
  decision_by, starts_at, external_url, created_by_city
) values
  ('munich-aim-connect-ws26',    'Tally (imported)', 'aim-connect',  'munich',    'ws26', 'interview', true,
   '2026-09-01', '2026-09-13', null, '2026-09-18', '2026-09-22', null, '2026-09-27', '2026-10-16',
   'https://tally.so/r/5BAxZM', 'Munich'),
  ('frankfurt-aim-connect-ws26', 'Tally (imported)', 'aim-connect',  'frankfurt', 'ws26', 'interview', true,
   '2026-08-30', '2026-09-25', null, null, null, 'Oct', '2026-10-11', '2026-10-24',
   'https://tally.so/r/WOVevk', 'Frankfurt'),
  ('aachen-aim-connect-ws26',    'Tally (imported)', 'aim-connect',  'aachen',    'ws26', 'interview', true,
   '2026-08-30', '2026-09-22', null, '2026-09-25', '2026-09-27', null, '2026-09-27', '2026-10-23',
   'https://tally.so/r/7RgbEL', 'Aachen'),
  ('munich-aim-innovate-ws26',   'Tally (imported)', 'aim-innovate', 'munich',    'ws26', 'interview', true,
   '2026-10-20', '2026-11-01', null, null, null, null, null, null,
   'https://tally.so/r/laDy65', 'Munich'),
  ('aachen-aim-code-ws26',       'Tally (imported)', 'aim-code',     'aachen',    'ws26', 'screening', true,
   '2026-10-21', '2026-11-06', '12:00', null, null, null, null, null,
   'https://tally.so/r/5XKBp6', 'Aachen')
on conflict (slug) do nothing;
