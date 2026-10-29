-- ============================================================================
-- Team profiles without a login + import of the current team from the
-- website (src/data/teamData.ts, without former members and alumni).
--
-- • A member can exist without email/login: the profile shows in the
--   organigram, and "Add email & invite" on the profile sends the
--   invitation later (edge function team-accounts). Only then the profile
--   is linked to the network person with that email.
-- • LinkedIn of members without a network profile is kept on the member
--   and copied to the network profile when it gets linked.
-- • The starting departments (Events, Partnerships, Marketing, IT) are
--   replaced by the website's teams where they're unused.
-- ============================================================================

alter table public.team_members alter column email drop not null;
alter table public.team_members add column linkedin text;
grant update (linkedin) on table public.team_members to authenticated;

create or replace function public.link_member_person()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id   uuid;
  v_name text;
begin
  -- No email yet (profile without login), or email unchanged
  if new.email is null or (tg_op = 'UPDATE' and new.email is not distinct from old.email) then
    return new;
  end if;
  select id, name into v_id, v_name from public.people where email = new.email;
  if v_id is null then
    insert into public.people (email, name, linkedin) values (new.email, btrim(new.name), new.linkedin) returning id into v_id;
  elsif public.normalize_name(v_name) <> public.normalize_name(new.name) then
    raise exception 'member_name_mismatch:%', v_name;
  elsif new.linkedin is not null then
    update public.people set linkedin = coalesce(linkedin, new.linkedin) where id = v_id;
  end if;
  new.person_id := v_id;
  return new;
end;
$$;

drop trigger team_members_person on public.team_members;
create trigger team_members_person before insert or update of email on public.team_members
  for each row execute function public.link_member_person();

-- ── Import ──────────────────────────────────────────────────────────────────

create temporary table website_team (
  ord serial, name text, city text, role public.team_role, dept text, position text, photo text, linkedin text
);
insert into website_team (name, city, role, dept, position, photo, linkedin) values
  ('Nick Breit', 'munich', 'president', null, null, 'https://one-aim.org/images/team/nick-breit.jpg', 'https://www.linkedin.com/in/nick-breit/'),
  ('Ahmed Ghaleb', 'munich', 'co_president', null, 'Vice-President', 'https://one-aim.org/images/team/ahmed-ghaleb.jpg', 'https://www.linkedin.com/in/ahmedghaleb/'),
  ('Gertrūda Bazytė', 'munich', 'lead', 'AIM Connect', null, 'https://one-aim.org/images/team/gertruda-bazyte.jpg', 'https://www.linkedin.com/in/gertruda-bazyte/'),
  ('Raphael Franzen', 'munich', 'lead', 'AIM Innovate', null, 'https://one-aim.org/images/team/raphael-franzen.jpg', 'https://www.linkedin.com/in/raphael-franzen-7b88b3256/'),
  ('Jimin Nam', 'munich', 'lead', 'AIM Code', null, 'https://one-aim.org/images/team/jimin-nam.jpg', 'https://www.linkedin.com/in/jimin-nam/'),
  ('Ali Allameh', 'munich', 'lead', 'Finance & Legal', null, 'https://one-aim.org/images/team/ali-allameh.jpg', 'https://www.linkedin.com/in/ali-allameh/'),
  ('Anna Hohlweger', 'munich', 'lead', 'Marketing', null, 'https://one-aim.org/images/team/anna-hohlweger.jpg', 'https://www.linkedin.com/in/anna-hohlweger/'),
  ('Nadja', 'munich', 'lead', 'Partnerships', null, null, null),
  ('Maren Raab', 'munich', 'lead', 'Community & Recruitment', null, 'https://one-aim.org/images/team/maren-raab.jpg', 'https://www.linkedin.com/in/maren-raab/'),
  ('Eva Wanninger', 'munich', 'lead', 'Community & Recruitment', 'Co-Team Lead | Community & Recruitment', 'https://one-aim.org/images/team/eva-wanninger.jpg', 'https://www.linkedin.com/in/eva-wanninger/'),
  ('Alvaro Acevedo', 'munich', 'member', 'AIM Connect', null, 'https://one-aim.org/images/team/alvaro-acevedo.jpeg', 'https://www.linkedin.com/in/alvaro-acevedo-06006629a/'),
  ('Andreas Nibler', 'munich', 'member', 'AIM Connect', null, null, 'https://www.linkedin.com/in/andreas-nibler-172697273'),
  ('Daniel Centelles Steiger', 'munich', 'member', 'AIM Connect', null, 'https://one-aim.org/images/team/daniel-steiger.jpeg', 'https://www.linkedin.com/in/daniel-centelles-steiger-b8725a245'),
  ('Denisa Pitzl', 'munich', 'member', 'AIM Connect', null, 'https://one-aim.org/images/team/denisa-pitzl.jpg', 'https://www.linkedin.com/in/denisa-pitzl-24aa02222'),
  ('Jona von Reischach', 'munich', 'member', 'AIM Connect', null, 'https://one-aim.org/images/team/jona-reischach.jpeg', 'https://www.linkedin.com/in/jona-von-reischach-535004391'),
  ('Jonas Laoudi', 'munich', 'member', 'AIM Connect', null, 'https://one-aim.org/images/team/jonas-laoudi.jpg', 'https://www.linkedin.com/in/jonas-laoudi'),
  ('Laurenz Stastka', 'munich', 'member', 'AIM Connect', null, 'https://one-aim.org/images/team/laurenz-stastka.png', 'https://www.linkedin.com/in/laurenz-stastka-685103221'),
  ('Marius Moldovan', 'munich', 'member', 'AIM Connect', null, 'https://one-aim.org/images/team/marius-moldovan.jpg', 'https://www.linkedin.com/in/marius-moldovan-405151231'),
  ('Niklas Kronewiter', 'munich', 'member', 'AIM Connect', null, 'https://one-aim.org/images/team/niklas-kronewiter.jpeg', 'https://www.linkedin.com/in/niklaskronewiter/en'),
  ('Samira Saidova', 'munich', 'member', 'AIM Connect', null, null, 'https://www.linkedin.com/in/samira-s-96029a325'),
  ('Viktoria Bals', 'munich', 'member', 'AIM Connect', null, null, 'https://www.linkedin.com/in/viktoria-josephine-bals-043689382'),
  ('Lili Song', 'munich', 'member', 'AIM Connect', null, null, null),
  ('Eliane Bähre', 'munich', 'member', 'AIM Innovate', null, 'https://one-aim.org/images/team/eliane-baehre.jpg', 'https://www.linkedin.com/in/eliane-baehre'),
  ('Jannis Kornilakis', 'munich', 'member', 'AIM Innovate', null, null, 'https://www.linkedin.com/in/jannis-kornilakis-b13782341'),
  ('Kaidi Qu', 'munich', 'member', 'AIM Innovate', null, null, null),
  ('Lea Schleemann', 'munich', 'member', 'AIM Innovate', null, null, null),
  ('Magali Fischbach', 'munich', 'member', 'AIM Innovate', null, null, null),
  ('Manuel Reiter', 'munich', 'member', 'AIM Innovate', null, 'https://one-aim.org/images/team/manuel-reiter.jpg', 'https://www.linkedin.com/in/manuel-reiter-351912381'),
  ('Varvara Danylchenko', 'munich', 'member', 'AIM Innovate', null, null, null),
  ('Dominik Schopper', 'munich', 'member', 'AIM Innovate', null, null, null),
  ('Charlotte Heuberger', 'munich', 'member', 'AIM Innovate', null, null, null),
  ('Annik Arnold', 'munich', 'member', 'AIM Innovate', null, null, null),
  ('Maria Metodieva', 'munich', 'member', 'AIM Innovate', null, null, null),
  ('Laetitia Wandtke', 'munich', 'member', 'AIM Innovate', null, 'https://one-aim.org/images/team/laetitia-wandtke.jpg', 'https://www.linkedin.com/in/laetitia-wandtke/'),
  ('Philipp Liedtke', 'munich', 'member', 'AIM Innovate', null, 'https://one-aim.org/images/team/philipp-liedtke.png', 'https://www.linkedin.com/in/philipp-liedtke/'),
  ('Jonathan Welte', 'munich', 'member', 'AIM Code', null, null, 'https://www.linkedin.com/in/jonathan-welte-a8745b1a4/'),
  ('Benedict Böhler', 'munich', 'member', 'AIM Code', null, null, null),
  ('Michael Röhrl', 'munich', 'member', 'AIM Code', null, 'https://one-aim.org/images/team/michael-roehrl.jpg', 'https://www.linkedin.com/in/michael-r%C3%B6hrl/'),
  ('Leo Eckert', 'munich', 'member', 'AIM Code', null, 'https://one-aim.org/images/team/leo-eckert.jpg', 'https://www.linkedin.com/in/leo-eckert-6953a2222/'),
  ('Florian Grabert', 'munich', 'member', 'AIM Code', null, null, null),
  ('Verona Miftari', 'munich', 'member', 'AIM Code', null, 'https://one-aim.org/images/team/verona-miftari.jpg', 'https://www.linkedin.com/in/verona-miftari-83172528a/'),
  ('Esra Kocaarslan', 'munich', 'member', 'AIM Code', null, 'https://one-aim.org/images/team/esra-kocaarslan.jpg', 'https://www.linkedin.com/in/esra-kocaarslan-76892020a/'),
  ('Nithin Balan', 'munich', 'member', 'AIM Code', null, 'https://one-aim.org/images/team/nithin-balan.jpg', 'https://www.linkedin.com/in/nithin-balan-02b026103'),
  ('Kathryna Jornet', 'munich', 'member', 'Finance & Legal', null, null, 'https://www.linkedin.com/in/kathryna-jornet-107b283a2'),
  ('Oscar Wiederhold', 'munich', 'member', 'Finance & Legal', null, 'https://one-aim.org/images/team/oscar-wiederhold.jpg', 'https://www.linkedin.com/in/oscar-wiederhold-lahoz-5964b02a6/'),
  ('Kevin Gyojun Ku', 'munich', 'member', 'Finance & Legal', null, null, null),
  ('Kimia Hassanpour', 'munich', 'member', 'Finance & Legal', null, null, null),
  ('Sophie Ihrler', 'munich', 'member', 'Community & Recruitment', null, null, null),
  ('Sidney Radsak', 'munich', 'member', 'Community & Recruitment', null, null, null),
  ('Laura Bauer', 'munich', 'member', 'Community & Recruitment', null, null, null),
  ('Felix Gillhuber', 'munich', 'member', 'Community & Recruitment', null, 'https://one-aim.org/images/team/felix-gillhuber.jpeg', 'https://www.linkedin.com/in/felix-gillhuber/'),
  ('Viktoria Klein', 'munich', 'member', 'Partnerships', null, null, null),
  ('Paul Herr', 'munich', 'member', 'Partnerships', null, 'https://one-aim.org/images/team/paul-herr.png', 'https://www.linkedin.com/in/paul-e-herr/'),
  ('Laura Niedermeier', 'munich', 'member', 'Partnerships', null, 'https://one-aim.org/images/team/laura-niedermeier.jpg', 'https://www.linkedin.com/in/laura-niedermeier-239086220'),
  ('Lena Müller', 'munich', 'member', 'Partnerships', null, null, null),
  ('Jeanette Luu', 'munich', 'member', 'Marketing', null, null, null),
  ('Lucas Gildehaus', 'aachen', 'president', null, null, 'https://one-aim.org/images/team/lucas-gildehaus.jpg', 'https://www.linkedin.com/in/lucas-gildehaus-0b3bba291/'),
  ('Aliya Zwiens', 'aachen', 'lead', 'Interview & Application Management', null, 'https://one-aim.org/images/team/aliya-zwiens.jpg', null),
  ('Eric Hölpes', 'aachen', 'lead', 'Social Media', null, 'https://one-aim.org/images/team/eric-hoelpes.jpg', 'https://www.linkedin.com/in/eric-h%C3%B6lpes-07bb07337/'),
  ('Jonathan Rempel', 'aachen', 'member', 'Finance & Legal', null, 'https://one-aim.org/images/team/jonathan-rempel.jpg', 'https://www.linkedin.com/in/jonathan-rempel-633418293/'),
  ('Sebastian Ha', 'aachen', 'lead', 'AIM Code', null, 'https://one-aim.org/images/team/sebastian-ha.jpg', 'https://www.linkedin.com/in/hasebastian/'),
  ('David Forster', 'aachen', 'lead', 'Makeathon & Summit', null, 'https://one-aim.org/images/team/david-forster.jpg', 'https://www.linkedin.com/in/codingdavid/'),
  ('Alexander Mladenov', 'aachen', 'lead', 'Partnerships', null, 'https://one-aim.org/images/team/alexander-mladenov.jpg', 'https://www.linkedin.com/in/alexander-mladenov-8a961141b/'),
  ('Yujin Song', 'aachen', 'lead', 'Kickoff', null, 'https://one-aim.org/images/team/yujin-song.jpg', 'https://www.linkedin.com/in/yujin-song-b341433a7/'),
  ('Karl Kindermann', 'aachen', 'member', null, null, 'https://one-aim.org/images/team/karl-kindermann.jpg', 'https://www.linkedin.com/in/karlkindermann/'),
  ('Sven Mattus', 'aachen', 'lead', 'Finance & Legal', null, 'https://one-aim.org/images/team/sven-mattus.jpg', 'https://www.linkedin.com/in/sven-mattus-522494177/'),
  ('Dr. Anton Dimroth', 'aachen', 'member', null, null, 'https://one-aim.org/images/team/anton-dimroth.jpg', 'https://www.linkedin.com/in/anton-dimroth-35ba0aa8/'),
  ('Constantin Lemler', 'aachen', 'member', null, null, 'https://one-aim.org/images/team/constantin-lemler.jpg', 'https://www.linkedin.com/in/constantin-lemler/'),
  ('Timo Klein', 'aachen', 'member', null, null, 'https://one-aim.org/images/team/timo-klein.jpg', 'https://www.linkedin.com/in/timo-klein-327149353/'),
  ('Adam Khizar', 'aachen', 'member', null, null, 'https://one-aim.org/images/team/adam-khizar.jpg', null),
  ('Huang Lin', 'aachen', 'member', null, null, 'https://one-aim.org/images/team/huang-lin.jpg', 'https://www.linkedin.com/in/huang-lin-b05628252/'),
  ('Seiar Yousofi', 'aachen', 'member', null, null, null, null),
  ('Julian Sandten', 'aachen', 'member', null, null, null, 'https://www.linkedin.com/in/julian-sandten/'),
  ('Medi Bergmann', 'frankfurt', 'president', null, null, 'https://one-aim.org/images/team/medi-bergmann.jpg', 'https://www.linkedin.com/in/medi-bergmann-305644250'),
  ('Maximilian Pfeiffer', 'frankfurt', 'lead', 'Marketing', 'Vice-President | Marketing', 'https://one-aim.org/images/team/maximilian-pfeiffer.jpg', 'https://www.linkedin.com/in/maximilian-pfeiffer-52576a1bb/'),
  ('Paul Rössler', 'frankfurt', 'lead', 'Community & Recruiting', null, 'https://one-aim.org/images/team/paul-roessler.jpg', 'https://www.linkedin.com/in/paul-r%C3%B6ssler-925b301b7'),
  ('Hendrik Noffke', 'frankfurt', 'lead', 'Community & Recruiting', null, 'https://one-aim.org/images/team/hendrik-noffke.jpg', 'https://www.linkedin.com/in/hendrik-noffke-6110542a2'),
  ('Amelie Biallas', 'frankfurt', 'lead', 'PR & Legal', null, 'https://one-aim.org/images/team/amelie-biallas.jpg', null),
  ('Justus Fricke', 'frankfurt', 'lead', 'AIM Connect', null, 'https://one-aim.org/images/team/justus-fricke.jpg', 'https://www.linkedin.com/in/justus-fricke');

-- Departments = the website's teams; unused starting departments go
delete from public.team_departments d
where not exists (select 1 from public.team_members m where m.department_id = d.id)
  and not exists (select 1 from website_team w where w.city = d.location_id and w.dept = d.name);

insert into public.team_departments (location_id, name, sort_order)
select city, dept, row_number() over (partition by city order by min(ord))
from website_team where dept is not null
group by city, dept
on conflict (location_id, name) do update set sort_order = excluded.sort_order;

-- Members (skipped if someone with that name is already in the city's team)
insert into public.team_members (name, location_id, role, department_id, position, photo_url, linkedin)
select w.name, w.city, w.role, d.id, w.position, w.photo, w.linkedin
from website_team w
left join public.team_departments d on d.location_id = w.city and d.name = w.dept
where not exists (select 1 from public.team_members m where m.location_id = w.city and lower(m.name) = lower(w.name))
order by w.ord;

drop table website_team;

