-- Yearly check: no answer within one month of the email → alumni.
-- (The reminder still goes out after 14 days.) Runs daily after the emails.

create or replace function public.expire_team_checkins()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int;
begin
  update public.team_members
  set status = 'alumni', alumni_since = public.today_berlin()
  where status = 'active' and check_token is not null and check_sent_at <= now() - interval '1 month';
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function public.expire_team_checkins() from public, anon, authenticated;

select cron.schedule('team-checkins-expire', '30 9 * * *', $$ select public.expire_team_checkins() $$);
