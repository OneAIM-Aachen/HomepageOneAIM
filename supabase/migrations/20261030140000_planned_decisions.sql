-- ============================================================================
-- Batch decisions: the team first plans decisions per applicant (invite /
-- accept / reject) without changing the status or sending anything; then
-- all planned decisions are applied at once (decide()), which sends the
-- emails in one go. Applying a decision clears the plan.
-- ============================================================================

alter table public.submissions
  add column planned_decision text check (planned_decision in ('invite', 'accept', 'reject')),
  add column planned_by text,
  add column planned_at timestamptz;

create or replace function public.track_planned_decision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    -- the decision was made: the plan is done
    new.planned_decision := null;
    new.planned_by := null;
    new.planned_at := null;
  elsif new.planned_decision is distinct from old.planned_decision then
    new.planned_by := case when new.planned_decision is null then null else coalesce(public.team_city(), 'Team') end;
    new.planned_at := case when new.planned_decision is null then null else now() end;
  end if;
  return new;
end;
$$;

create trigger submissions_planned_decision before update on public.submissions
  for each row execute function public.track_planned_decision();

revoke execute on function public.track_planned_decision() from public, anon, authenticated;
