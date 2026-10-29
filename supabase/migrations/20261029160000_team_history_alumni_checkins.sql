-- ============================================================================
-- Team history, alumni and the yearly "still active?" check
--
-- • team_member_roles: who had which position when. A new row starts
--   whenever city, role, department or position change; the team can
--   correct dates and add earlier positions.
-- • team_members.status: 'active' or 'alumni'. Alumni leave the organigram
--   and lose portal access; profile and history stay.
-- • One year after a member got their account (and every year after a
--   "yes"), the edge function team-accounts (action "checkins", daily by
--   pg_cron) emails a link to /team/checkin. "No" makes them alumni.
--   Without an answer they get one reminder after 14 days; after that the
--   open question shows on the Team page.
-- ============================================================================

alter table public.team_members
  add column status            text not null default 'active' check (status in ('active', 'alumni')),
  add column alumni_since      date,
  add column next_check_at     timestamptz,
  add column check_token       uuid unique,
  add column check_sent_at     timestamptz,
  add column check_reminded_at timestamptz,
  add column last_confirmed_at timestamptz;

grant update (status, alumni_since) on table public.team_members to authenticated;

-- Members who already have an email: first check one year after the invitation
update public.team_members
set next_check_at = coalesce(invited_at, created_at) + interval '1 year'
where email is not null;

-- ── Position history ────────────────────────────────────────────────────────

create table public.team_member_roles (
  id            uuid primary key default gen_random_uuid(),
  member_id     uuid not null references public.team_members (id) on delete cascade,
  location_id   text not null references public.locations (id) on update cascade,
  role          public.team_role not null,
  department_id uuid references public.team_departments (id) on delete set null,
  department    text,                          -- name at that time (kept if the department goes)
  position      text,
  started_on    date not null,
  ended_on      date check (ended_on is null or ended_on >= started_on),
  created_at    timestamptz not null default now()
);

create index team_member_roles_member on public.team_member_roles (member_id, started_on);

alter table public.team_member_roles enable row level security;
revoke all on table public.team_member_roles from anon;
create policy "team full access" on public.team_member_roles
  for all to authenticated using ((select public.is_team())) with check ((select public.is_team()));

-- Current position of everyone, starting with their invitation (or the import)
insert into public.team_member_roles (member_id, location_id, role, department_id, department, position, started_on)
select m.id, m.location_id, m.role, m.department_id, d.name, m.position, coalesce(m.invited_at, m.created_at)::date
from public.team_members m left join public.team_departments d on d.id = m.department_id;

create or replace function public.track_member_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := public.today_berlin();
  v_open  uuid;
  v_start date;
begin
  select id, started_on into v_open, v_start from public.team_member_roles
  where member_id = new.id and ended_on is null order by started_on desc limit 1;

  -- Leaving the team: close the current position
  if new.status = 'alumni' then
    if tg_op = 'UPDATE' and old.status = 'active' and v_open is not null then
      update public.team_member_roles set ended_on = greatest(v_start, coalesce(new.alumni_since, v_today)) where id = v_open;
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status = 'active'
     and new.location_id = old.location_id and new.role = old.role
     and new.department_id is not distinct from old.department_id and new.position is not distinct from old.position then
    return new;   -- nothing about the position changed
  end if;

  if v_open is not null and v_start >= v_today then
    -- Changed again on the same day: correct the current entry
    update public.team_member_roles set location_id = new.location_id, role = new.role, department_id = new.department_id,
      department = (select name from public.team_departments where id = new.department_id), position = new.position
    where id = v_open;
  else
    if v_open is not null then
      update public.team_member_roles set ended_on = v_today - 1 where id = v_open;
    end if;
    insert into public.team_member_roles (member_id, location_id, role, department_id, department, position, started_on)
    values (new.id, new.location_id, new.role, new.department_id,
            (select name from public.team_departments where id = new.department_id), new.position, v_today);
  end if;
  return new;
end;
$$;

create trigger team_members_history after insert or update of location_id, role, department_id, position, status
  on public.team_members for each row execute function public.track_member_role();

-- Renaming a department renames it in the current positions (history keeps the old name)
create or replace function public.rename_department_in_roles()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.team_member_roles set department = new.name where department_id = new.id and ended_on is null;
  return new;
end;
$$;

create trigger team_departments_rename after update of name on public.team_departments
  for each row execute function public.rename_department_in_roles();

-- Status bookkeeping: alumni get a date, returning members a fresh yearly check
create or replace function public.member_status_dates()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'alumni' and (tg_op = 'INSERT' or old.status <> 'alumni') then
    new.alumni_since := coalesce(new.alumni_since, public.today_berlin());
    new.check_token := null;
  elsif new.status = 'active' and tg_op = 'UPDATE' and old.status = 'alumni' then
    new.alumni_since := null;
    new.next_check_at := now() + interval '1 year';
    new.check_sent_at := null;
    new.check_reminded_at := null;
  end if;
  -- First yearly check one year after the email (= the account) was added
  if new.email is not null and new.next_check_at is null and new.status = 'active' then
    new.next_check_at := now() + interval '1 year';
  end if;
  return new;
end;
$$;

create trigger team_members_status before insert or update on public.team_members
  for each row execute function public.member_status_dates();

-- ── Access: only active members are on the team ─────────────────────────────

create or replace function public.is_team()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.team_members where user_id = (select auth.uid()) and status = 'active')
      or exists (select 1 from public.team_accounts
                 where user_id = (select auth.uid()) and (keep_active or not public.personal_accounts_active()));
$$;

-- ── Yearly check: answer page (public, by token from the email) ─────────────

create or replace function public.team_checkin_info(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('name', split_part(m.name, ' ', 1), 'city', l.name)
  from public.team_members m join public.locations l on l.id = m.location_id
  where m.check_token = p_token and m.status = 'active';
$$;

create or replace function public.team_checkin(p_token uuid, p_still_active boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select id into v_id from public.team_members where check_token = p_token and status = 'active';
  if v_id is null then raise exception 'invalid_token'; end if;
  if p_still_active then
    update public.team_members set last_confirmed_at = now(), next_check_at = now() + interval '1 year',
      check_token = null, check_sent_at = null, check_reminded_at = null
    where id = v_id;
    return 'active';
  end if;
  update public.team_members set status = 'alumni', alumni_since = public.today_berlin(), check_token = null where id = v_id;
  return 'alumni';
end;
$$;

revoke execute on function public.track_member_role(), public.rename_department_in_roles(), public.member_status_dates()
  from public, anon, authenticated;
revoke execute on function public.team_checkin_info(uuid), public.team_checkin(uuid, boolean) from public;
grant execute on function public.team_checkin_info(uuid), public.team_checkin(uuid, boolean) to anon, authenticated;

-- Daily at 09:00 UTC: send due check emails and reminders
select cron.schedule(
  'team-checkins',
  '0 9 * * *',
  $$ select net.http_post(
       url     := 'https://wenkvkkfmclhycyxnxxu.supabase.co/functions/v1/team-accounts',
       headers := '{"Content-Type": "application/json"}'::jsonb,
       body    := '{"action": "checkins"}'::jsonb
     ) $$
);
