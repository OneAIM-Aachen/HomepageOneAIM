-- ============================================================================
-- Personal team accounts, team profiles and departments (organigram)
--
-- • Every team member has their own login and a profile in team_members.
--   Accounts are created by invitation only (edge function "team-accounts"),
--   never by sign-up. All members have the same rights.
-- • Team members are part of the OneAIM network: each member is linked to
--   the network profile (people) with the same email and name, so an
--   applicant who joins the team (or a member who applies) is one person.
--   Universities, study programs, phone and LinkedIn live on that profile.
-- • Each city has departments (team_departments); presidents and
--   co-presidents sit above them, leads and members belong to one.
-- • The old city logins (team_accounts) only keep working until the first
--   personal account has set its password, so someone can invite the team.
--   Logins marked keep_active (aachen@one-aim.org) keep working for good.
-- ============================================================================

create type public.team_role as enum ('president', 'co_president', 'lead', 'member');

create table public.team_departments (
  id          uuid primary key default gen_random_uuid(),
  location_id text not null references public.locations (id) on update cascade on delete cascade,
  name        text not null check (length(btrim(name)) between 1 and 60),
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now(),
  unique (location_id, name)
);

create table public.team_members (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid unique references auth.users (id) on delete set null,
  person_id     uuid unique references public.people (id) on delete set null,   -- network profile
  email         text not null unique check (email = lower(email) and email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  name          text not null check (length(btrim(name)) between 1 and 120),
  location_id   text not null references public.locations (id) on update cascade,
  role          public.team_role not null default 'member',
  department_id uuid references public.team_departments (id) on delete set null,
  position      text check (position is null or length(position) <= 80),     -- e.g. "Head of Partnerships"
  photo_url     text check (photo_url is null or photo_url ~ '^https://'),
  member_since  text,                                                          -- semester label, e.g. "WS 25/26"
  about         text check (about is null or length(about) <= 600),
  invited_at    timestamptz,
  reset_sent_at timestamptz,                                                   -- throttles "forgot password"
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.team_members is
  'One row per team member: personal login (user_id) and team profile. Created by the team-accounts function.';

create index team_members_location on public.team_members (location_id);
create index team_members_department on public.team_members (department_id);

create trigger team_members_updated_at before update on public.team_members
  for each row execute function public.set_updated_at();

-- A department always belongs to the member's own city; presidents stand above departments.
create or replace function public.check_member_department()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.role in ('president', 'co_president') then
    new.department_id := null;
  end if;
  if new.department_id is not null and not exists (
    select 1 from public.team_departments d where d.id = new.department_id and d.location_id = new.location_id
  ) then
    raise exception 'department_other_city';
  end if;
  return new;
end;
$$;

create trigger team_members_department before insert or update on public.team_members
  for each row execute function public.check_member_department();

-- Link to the network profile with the same email, or create one.
-- Same email under a different name is refused, like in applications.
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
  select id, name into v_id, v_name from public.people where email = new.email;
  if v_id is null then
    insert into public.people (email, name) values (new.email, btrim(new.name)) returning id into v_id;
  elsif public.normalize_name(v_name) <> public.normalize_name(new.name) then
    raise exception 'member_name_mismatch:%', v_name;
  end if;
  new.person_id := v_id;
  return new;
end;
$$;

create trigger team_members_person before insert on public.team_members
  for each row execute function public.link_member_person();

-- Renaming a member renames their network profile too (one person, one name).
create or replace function public.sync_member_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.name is distinct from old.name and new.person_id is not null then
    update public.people set name = btrim(new.name) where id = new.person_id;
  end if;
  return new;
end;
$$;

create trigger team_members_name after update of name on public.team_members
  for each row execute function public.sync_member_name();

alter table public.team_accounts add column keep_active boolean not null default false;
update public.team_accounts a set keep_active = true
from auth.users u where u.id = a.user_id and lower(u.email) = 'aachen@one-aim.org';

-- ── Who is on the team ──────────────────────────────────────────────────────

-- True once any personal account has set its password: from then on the
-- city logins are switched off.
create or replace function public.personal_accounts_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.team_members m join auth.users u on u.id = m.user_id
    where coalesce(u.encrypted_password, '') <> ''
  );
$$;

create or replace function public.is_team()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.team_members where user_id = (select auth.uid()))
      or exists (select 1 from public.team_accounts
                 where user_id = (select auth.uid()) and (keep_active or not public.personal_accounts_active()));
$$;

-- Who acted, as shown in comments, status history and the email log:
-- "Name (City)" for personal accounts, the city for the old city logins.
create or replace function public.team_city()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select m.name || ' (' || l.name || ')' from public.team_members m
       join public.locations l on l.id = m.location_id
      where m.user_id = (select auth.uid())),
    (select city from public.team_accounts where user_id = (select auth.uid())));
$$;

-- Account state of each member for the Team page (invited / active, last login).
create or replace function public.team_member_status()
returns table (member_id uuid, has_password boolean, last_sign_in_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_team() then raise exception 'not_allowed'; end if;
  return query
    select m.id, coalesce(u.encrypted_password, '') <> '', u.last_sign_in_at
    from public.team_members m left join auth.users u on u.id = m.user_id;
end;
$$;

revoke execute on function public.personal_accounts_active(), public.team_member_status(),
  public.check_member_department(), public.link_member_person(), public.sync_member_name() from public, anon, authenticated;
grant execute on function public.personal_accounts_active(), public.team_member_status() to authenticated;
-- The login page asks whether the signed-in user may enter.
grant execute on function public.is_team() to authenticated;

-- ── Access ──────────────────────────────────────────────────────────────────
-- All members are equal: everyone may edit profiles and departments.
-- Accounts themselves (insert, delete, email, user_id) only change through
-- the team-accounts function (service role).

alter table public.team_departments enable row level security;
alter table public.team_members enable row level security;
revoke all on table public.team_departments, public.team_members from anon;
revoke insert, update, delete on table public.team_members from authenticated;
grant select on table public.team_members to authenticated;
grant update (name, location_id, role, department_id, position, photo_url, member_since, about) on table public.team_members to authenticated;

create policy "team full access" on public.team_departments
  for all to authenticated using ((select public.is_team())) with check ((select public.is_team()));
create policy "team reads members" on public.team_members
  for select to authenticated using ((select public.is_team()));
create policy "team edits profiles" on public.team_members
  for update to authenticated using ((select public.is_team())) with check ((select public.is_team()));

-- Starting departments for every city (rename or remove them on the Team page)
insert into public.team_departments (location_id, name, sort_order)
select l.id, d.name, d.ord
from public.locations l
cross join (values ('Events', 1), ('Partnerships', 2), ('Marketing', 3), ('IT', 4)) as d (name, ord)
on conflict do nothing;
