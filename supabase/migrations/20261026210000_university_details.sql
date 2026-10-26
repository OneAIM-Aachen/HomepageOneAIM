-- ============================================================================
-- Universities: country + search terms (original local name, abbreviations),
-- so applicants find "Technical University of Munich" also by typing
-- "Technische Universität München" or "TUM". Names are always English.
-- ============================================================================

alter table public.universities
  add column country text,
  add column aliases text[] not null default '{}';

create index universities_name_lower_idx on public.universities (lower(name));

-- The hand-picked entries
update public.universities u set country = v.country, aliases = v.aliases
from (values
  ('Technical University of Munich (TUM)', 'Germany', array['Technische Universität München', 'TUM', 'TU München']),
  ('LMU Munich', 'Germany', array['Ludwig-Maximilians-Universität München', 'LMU', 'Ludwig Maximilian University of Munich']),
  ('Munich University of Applied Sciences (HM)', 'Germany', array['Hochschule München', 'HM', 'Hochschule für angewandte Wissenschaften München']),
  ('University of the Bundeswehr Munich', 'Germany', array['Universität der Bundeswehr München', 'UniBw']),
  ('RWTH Aachen University', 'Germany', array['Rheinisch-Westfälische Technische Hochschule Aachen', 'RWTH']),
  ('FH Aachen University of Applied Sciences', 'Germany', array['Fachhochschule Aachen', 'FH Aachen']),
  ('Goethe University Frankfurt', 'Germany', array['Johann Wolfgang Goethe-Universität Frankfurt am Main', 'Goethe-Universität']),
  ('Frankfurt University of Applied Sciences', 'Germany', array['Frankfurt UAS', 'Fachhochschule Frankfurt am Main']),
  ('Frankfurt School of Finance & Management', 'Germany', array['Frankfurt School', 'FS']),
  ('TU Darmstadt', 'Germany', array['Technische Universität Darmstadt', 'Technical University of Darmstadt']),
  ('Johannes Gutenberg University Mainz', 'Germany', array['Johannes Gutenberg-Universität Mainz', 'JGU']),
  ('Heidelberg University', 'Germany', array['Ruprecht-Karls-Universität Heidelberg', 'Universität Heidelberg']),
  ('University of Cologne', 'Germany', array['Universität zu Köln']),
  ('Charité – Universitätsmedizin Berlin', 'Germany', array['Charité', 'Charite']),
  ('Karlsruhe Institute of Technology (KIT)', 'Germany', array['Karlsruher Institut für Technologie', 'KIT']),
  ('ETH Zurich', 'Switzerland', array['Eidgenössische Technische Hochschule Zürich', 'ETH Zürich', 'Swiss Federal Institute of Technology'])
) as v(name, country, aliases)
where u.name = v.name;

-- Apply form: universities with country and search terms
create or replace function public.public_form_options()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'universities',  coalesce((select jsonb_agg(jsonb_build_object('name', name, 'country', country, 'aliases', aliases) order by name)
                               from public.universities), '[]'::jsonb),
    'studyPrograms', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'category', category) order by category, name)
                               from public.study_programs), '[]'::jsonb),
    'degrees',   to_jsonb(public.degree_options()),
    'semesters', to_jsonb(public.semester_options())
  );
$$;

revoke execute on function public.public_form_options() from public;
grant execute on function public.public_form_options() to anon, authenticated;
