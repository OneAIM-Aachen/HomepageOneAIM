-- Short names people type for famous universities (exact match ranks first)
update public.universities u
   set aliases = (select array_agg(distinct x) from unnest(u.aliases || v.extra) x)
from (values
  ('University of Oxford', array['Oxford']),
  ('University of Cambridge', array['Cambridge']),
  ('University of Edinburgh', array['Edinburgh']),
  ('University of Copenhagen', array['Copenhagen', 'KU']),
  ('University of Vienna', array['Universität Wien', 'Uni Wien']),
  ('University of Munich', array['LMU'])
) as v(name, extra)
where u.name = v.name;
