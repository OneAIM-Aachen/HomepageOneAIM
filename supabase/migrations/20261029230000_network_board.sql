-- ============================================================================
-- Network board: job postings, events and other news on the network site
--
-- • Everyone in the network can read published posts.
-- • Team members post directly (published right away).
-- • Other members submit posts; they wait for a team member to approve
--   ('pending' → 'published' or 'rejected'). Members see their own
--   submissions with the status.
-- • Members only use the functions below; the team works on the table
--   (team portal → Board).
-- ============================================================================

create table public.network_posts (
  id               uuid primary key default gen_random_uuid(),
  kind             text not null check (kind in ('job', 'event', 'other')),
  title            text not null check (length(btrim(title)) between 3 and 140),
  organization     text check (organization is null or length(organization) <= 120),
  location         text check (location is null or length(location) <= 120),
  date_on          date,                       -- event date / application deadline
  link             text check (link is null or link ~ '^https?://'),
  body             text not null check (length(btrim(body)) between 1 and 5000),
  status           text not null default 'pending' check (status in ('pending', 'published', 'rejected')),
  author_person_id uuid references public.people (id) on delete set null,
  author_name      text not null,
  author_is_team   boolean not null default false,
  review_note      text,
  reviewed_by      text,
  reviewed_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index network_posts_status on public.network_posts (status, created_at desc);

create trigger network_posts_updated_at before update on public.network_posts
  for each row execute function public.set_updated_at();

alter table public.network_posts enable row level security;
revoke all on table public.network_posts from anon;
create policy "team full access" on public.network_posts
  for all to authenticated using ((select public.is_team())) with check ((select public.is_team()));

-- ── Members (network site) ─────────────────────────────────────────────────

create or replace function public.post_json(p public.network_posts)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id, 'kind', p.kind, 'title', p.title, 'organization', p.organization, 'location', p.location,
    'date', p.date_on, 'link', p.link, 'body', p.body, 'status', p.status, 'authorName', p.author_name,
    'authorIsTeam', p.author_is_team, 'reviewNote', p.review_note, 'createdAt', p.created_at,
    'mine', p.author_person_id is not distinct from public.my_person_id() and p.author_person_id is not null);
$$;

-- Published posts plus your own submissions (with their status)
create or replace function public.network_board()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me uuid := public.my_person_id();
begin
  if not public.is_network_member() then raise exception 'not_allowed'; end if;
  return coalesce((
    select jsonb_agg(public.post_json(p) order by p.created_at desc)
    from public.network_posts p
    where p.status = 'published' or (v_me is not null and p.author_person_id = v_me)), '[]');
end;
$$;

-- Write a post: team members publish directly, everyone else waits for approval
create or replace function public.network_submit_post(p jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me     uuid := public.my_person_id();
  v_team   boolean := public.is_team();
  v_name   text;
  v_status text;
begin
  if not public.is_network_member() then raise exception 'not_allowed'; end if;
  if coalesce(p ->> 'kind', '') not in ('job', 'event', 'other') then raise exception 'invalid_option'; end if;
  if coalesce(btrim(p ->> 'title'), '') = '' or coalesce(btrim(p ->> 'body'), '') = '' then raise exception 'missing_field'; end if;
  -- At most 5 posts waiting per member (keeps the review queue sane)
  if not v_team and (select count(*) from public.network_posts where author_person_id = v_me and status = 'pending') >= 5 then
    raise exception 'too_many_pending';
  end if;
  select coalesce((select name from public.team_members where user_id = (select auth.uid())),
                  (select name from public.people where id = v_me), 'OneAIM') into v_name;
  v_status := case when v_team then 'published' else 'pending' end;
  insert into public.network_posts (kind, title, organization, location, date_on, link, body, status,
                                    author_person_id, author_name, author_is_team, reviewed_by, reviewed_at)
  values (p ->> 'kind', btrim(p ->> 'title'), nullif(btrim(p ->> 'organization'), ''), nullif(btrim(p ->> 'location'), ''),
          nullif(p ->> 'date', '')::date, nullif(btrim(p ->> 'link'), ''), btrim(p ->> 'body'), v_status,
          v_me, v_name, v_team, case when v_team then v_name end, case when v_team then now() end);
  return v_status;
end;
$$;

-- Members can withdraw their own submission while it waits
create or replace function public.network_withdraw_post(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_network_member() then raise exception 'not_allowed'; end if;
  delete from public.network_posts where id = p_id and status <> 'published' and author_person_id = public.my_person_id();
end;
$$;

revoke execute on function public.post_json(public.network_posts), public.network_board(), public.network_submit_post(jsonb),
  public.network_withdraw_post(uuid) from public, anon;
grant execute on function public.network_board(), public.network_submit_post(jsonb), public.network_withdraw_post(uuid) to authenticated;
revoke execute on function public.post_json(public.network_posts) from authenticated;
