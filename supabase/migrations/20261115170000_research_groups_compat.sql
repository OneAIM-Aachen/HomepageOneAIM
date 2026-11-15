-- Temporary: an empty research_groups table, so team portal builds from before
-- 20261115160000 (which still load the old list) keep working until the new
-- code is deployed. Nothing reads or writes it any more; drop it after the deploy.
create table if not exists public.research_groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  institution text not null,
  aliases     text[] not null default '{}',
  created_at  timestamptz not null default now()
);
alter table public.research_groups enable row level security;
revoke all on table public.research_groups from anon;
drop policy if exists "team full access" on public.research_groups;
create policy "team full access" on public.research_groups
  for select to authenticated using ((select public.is_team()));
