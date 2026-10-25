-- ============================================================================
-- Run the "send-emails" edge function automatically:
--   • right after new emails are queued (statement trigger on email_log)
--   • every 2 minutes (retries, emails held back by the daily limit)
-- The function only sends what is already queued, so it needs no secret
-- to be called (deployed with --no-verify-jwt).
-- ============================================================================

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

create or replace function public.kick_email_sender()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform net.http_post(
    url     := 'https://wenkvkkfmclhycyxnxxu.supabase.co/functions/v1/send-emails',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body    := '{}'::jsonb
  );
  return null;
end;
$$;

revoke execute on function public.kick_email_sender() from public, anon, authenticated;

create trigger email_log_kick_sender
  after insert on public.email_log
  for each statement execute function public.kick_email_sender();

select cron.schedule(
  'send-queued-emails',
  '*/2 * * * *',
  $$ select net.http_post(
       url     := 'https://wenkvkkfmclhycyxnxxu.supabase.co/functions/v1/send-emails',
       headers := '{"Content-Type": "application/json"}'::jsonb,
       body    := '{}'::jsonb
     ) $$
);
