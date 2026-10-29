-- Alumni from the website (src/data/teamData.ts, alumni: true).
-- The date they left isn't known: alumni_since stays empty, and their
-- positions can be added in the profile ("Add earlier position").

create temporary table website_alumni (name text, city text, position text, photo text, linkedin text);
insert into website_alumni values
  ('Matthias Lutz', 'munich', 'Co-Founder OneAIM', 'https://one-aim.org/images/team/matthias-lutz.jpg', 'https://www.linkedin.com/in/matthias-lutz'),
  ('Finn Kosina', 'munich', 'Co-Founder OneAIM', 'https://one-aim.org/images/team/finn-kosina.jpg', 'https://www.linkedin.com/in/finn-kosina/');

insert into public.team_members (name, location_id, role, position, photo_url, linkedin, status)
select a.name, a.city, 'member', a.position, a.photo, a.linkedin, 'alumni'
from website_alumni a
where not exists (select 1 from public.team_members m where m.location_id = a.city and lower(m.name) = lower(a.name));

-- The status trigger dates new alumni with today; here the date is unknown
update public.team_members m set alumni_since = null
from website_alumni a
where m.location_id = a.city and m.name = a.name and m.status = 'alumni';

drop table website_alumni;
