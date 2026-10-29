-- ============================================================================
-- OneAIM network site (/members): logins for everyone in the network
--
-- • In the network = accepted/confirmed in an application with a selection
--   (screening or interview), or on the team (current or alumni).
-- • network_accounts links a login to a network person. Team members use
--   their team login (team_members.user_id) here as well.
-- • Network logins get NO table access. They only call the functions below
--   (directory, own profile), which check network membership. is_team()
--   stays false for them, so the team area is closed.
-- • Joining the network queues a welcome email (network_invites); the edge
--   function team-accounts (action network_queue) sends it with a link to
--   set a password. The team can also invite people by hand.
-- ============================================================================

alter table public.people add column photo_url text check (photo_url is null or photo_url ~ '^https://');

create table public.network_accounts (
  person_id  uuid primary key references public.people (id) on delete cascade,
  user_id    uuid unique references auth.users (id) on delete set null,
  invited_at timestamptz,
  reset_sent_at timestamptz,                    -- throttles "forgot password"
  created_at timestamptz not null default now()
);

create table public.network_invites (
  id         uuid primary key default gen_random_uuid(),
  person_id  uuid not null references public.people (id) on delete cascade,
  reason     text not null check (reason in ('accepted', 'team')),
  queued_by  text not null default 'System',
  created_at timestamptz not null default now(),
  sent_at    timestamptz,
  error      text
);
create unique index network_invites_open on public.network_invites (person_id) where sent_at is null;

alter table public.network_accounts enable row level security;
alter table public.network_invites enable row level security;
revoke all on table public.network_accounts, public.network_invites from anon;
create policy "team reads network accounts" on public.network_accounts
  for select to authenticated using ((select public.is_team()));
create policy "team full access" on public.network_invites
  for all to authenticated using ((select public.is_team())) with check ((select public.is_team()));
revoke insert, update, delete on table public.network_accounts from authenticated;

-- ── Membership ──────────────────────────────────────────────────────────────

create or replace function public.person_in_network(p_person uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
      select 1 from public.submissions s join public.applications a on a.id = s.application_id
      where s.person_id = p_person and s.status in ('accepted', 'confirmed') and a.pipeline <> 'instant')
    or exists (select 1 from public.team_members m where m.person_id = p_person);
$$;

create or replace function public.my_person_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select person_id from public.network_accounts where user_id = (select auth.uid())),
    (select person_id from public.team_members where user_id = (select auth.uid())));
$$;

create or replace function public.is_network_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.person_in_network(public.my_person_id()), false)
      or exists (select 1 from public.team_members where user_id = (select auth.uid()) and status = 'active');
$$;

-- ── Directory and profiles (only the fields a network profile may show) ─────

create or replace function public.network_profile_json(p_person uuid, p_member uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with p as (select * from public.people where id = p_person),
       m as (select * from public.team_members where id = coalesce(p_member, (select id from public.team_members where person_id = p_person)))
  select jsonb_build_object(
    'key', coalesce(p_person, p_member),
    'name', coalesce((select name from p), (select name from m)),
    'photo', coalesce((select photo_url from m), (select photo_url from p)),
    'email', (select email from p),
    'phone', (select phone from p),
    'linkedin', coalesce((select linkedin from p), (select linkedin from m)),
    'universities', coalesce((select universities from p), '{}'),
    'studyPrograms', coalesce((select study_programs from p), '{}'),
    'semester', (select semester from p),
    'degree', (select degree from p),
    'participations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'title', coalesce(a.title, pr.name || ' ' || l.name || ' – ' || se.label),
        'program', pr.name, 'city', l.name, 'semester', se.label, 'event', a.pipeline = 'instant') order by a.opens_at desc)
      from public.submissions s
      join public.applications a on a.id = s.application_id
      join public.programs pr on pr.id = a.program_id
      join public.locations l on l.id = a.location_id
      join public.semesters se on se.id = a.semester_id
      where s.person_id = p_person and s.status in ('accepted', 'confirmed')), '[]'),
    'team', (select jsonb_build_object(
        'status', m.status, 'city', l.name, 'role', m.role, 'position', m.position,
        'department', (select name from public.team_departments where id = m.department_id),
        'alumniSince', m.alumni_since,
        'history', coalesce((select jsonb_agg(jsonb_build_object(
            'id', r.id, 'city', rl.name, 'role', r.role, 'department', r.department, 'position', r.position,
            'from', r.started_on, 'to', r.ended_on) order by r.started_on)
          from public.team_member_roles r join public.locations rl on rl.id = r.location_id where r.member_id = m.id), '[]'))
      from m join public.locations l on l.id = m.location_id)
  );
$$;

create or replace function public.network_directory()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_network_member() then raise exception 'not_allowed'; end if;
  return coalesce((
    select jsonb_agg(x.j order by x.j ->> 'name')
    from (
      select public.network_profile_json(p.id, null) j from public.people p where public.person_in_network(p.id)
      union all
      select public.network_profile_json(null, m.id) from public.team_members m where m.person_id is null
    ) x), '[]');
end;
$$;

create or replace function public.network_me()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_person uuid := public.my_person_id();
begin
  if not public.is_network_member() or v_person is null then raise exception 'not_allowed'; end if;
  return public.network_profile_json(v_person, null)
    || jsonb_build_object('isTeam', exists (select 1 from public.team_members where user_id = (select auth.uid()) and status = 'active'));
end;
$$;

-- Members edit their own contact data, studies and photo (name and email stay)
create or replace function public.network_update_me(p jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_person uuid := public.my_person_id();
begin
  if not public.is_network_member() or v_person is null then raise exception 'not_allowed'; end if;
  if p ? 'photo' and nullif(p ->> 'photo', '') is not null and (p ->> 'photo') !~ '^https://' then raise exception 'invalid_option'; end if;
  update public.people set
    phone          = case when p ? 'phone' then nullif(btrim(p ->> 'phone'), '') else phone end,
    linkedin       = case when p ? 'linkedin' then nullif(btrim(p ->> 'linkedin'), '') else linkedin end,
    universities   = case when p ? 'universities' then array(select jsonb_array_elements_text(p -> 'universities')) else universities end,
    study_programs = case when p ? 'studyPrograms' then array(select jsonb_array_elements_text(p -> 'studyPrograms')) else study_programs end,
    semester       = case when p ? 'semester' then nullif(p ->> 'semester', '') else semester end,
    degree         = case when p ? 'degree' then nullif(p ->> 'degree', '') else degree end,
    photo_url      = case when p ? 'photo' then nullif(p ->> 'photo', '') else photo_url end
  where id = v_person;
  -- Team members: the photo is the team photo as well
  if p ? 'photo' then
    update public.team_members set photo_url = nullif(p ->> 'photo', '') where person_id = v_person;
  end if;
end;
$$;

revoke execute on function public.person_in_network(uuid), public.my_person_id(), public.is_network_member(),
  public.network_profile_json(uuid, uuid), public.network_directory(), public.network_me(), public.network_update_me(jsonb)
  from public, anon;
grant execute on function public.is_network_member(), public.network_directory(), public.network_me(), public.network_update_me(jsonb)
  to authenticated;
revoke execute on function public.person_in_network(uuid), public.my_person_id(), public.network_profile_json(uuid, uuid) from authenticated;
grant execute on function public.person_in_network(uuid) to service_role;   -- edge function team-accounts

-- Members upload their own photo into public-images/network/<user id>/…
create policy "network members upload own photo"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'public-images' and (storage.foldername(name))[1] = 'network'
              and (storage.foldername(name))[2] = (select auth.uid())::text and (select public.is_network_member()));

-- ── Welcome email when someone joins the network ────────────────────────────

create or replace function public.queue_network_welcome()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted'
     and (select pipeline from public.applications where id = new.application_id) <> 'instant'
     and not exists (select 1 from public.network_accounts where person_id = new.person_id)
     and not exists (select 1 from public.team_members where person_id = new.person_id and user_id is not null) then
    insert into public.network_invites (person_id, reason) values (new.person_id, 'accepted')
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger submissions_network_welcome after update of status on public.submissions
  for each row execute function public.queue_network_welcome();

revoke execute on function public.queue_network_welcome() from public, anon, authenticated;

-- Send queued welcome emails every 5 minutes (also triggered right after decisions)
select cron.schedule(
  'network-welcome',
  '*/5 * * * *',
  $$ select net.http_post(
       url     := 'https://wenkvkkfmclhycyxnxxu.supabase.co/functions/v1/team-accounts',
       headers := '{"Content-Type": "application/json"}'::jsonb,
       body    := '{"action": "network_queue"}'::jsonb
     ) $$
);
