-- ============================================================================
-- Email sending settings (one row), editable in the team area
-- (Settings → Email). The edge function "send-emails" reads them.
--
-- Test mode: while on, every email goes to test_recipient instead of the
-- applicant (the real recipient is shown in the subject). Without a
-- test_recipient nothing is sent at all.
-- ============================================================================

create table public.email_settings (
  id             boolean primary key default true check (id),   -- exactly one row
  sender_name    text not null default 'OneAIM {location}',     -- {location} = city of the application
  sender_email   text not null default 'aachen@one-aim.org'
                 check (sender_email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  reply_to       text check (reply_to is null or reply_to ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),  -- empty = sender_email
  test_mode      boolean not null default true,
  test_recipient text check (test_recipient is null or test_recipient ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  -- Base URL for links in emails (interview booking)
  apply_base_url text not null default 'http://localhost:4400' check (apply_base_url ~ '^https?://'),
  -- Brevo free plan: 300 emails/day. Above this, emails wait for the next day.
  daily_limit    int not null default 290 check (daily_limit > 0),
  updated_at     timestamptz not null default now()
);

insert into public.email_settings (id) values (true) on conflict do nothing;

create trigger email_settings_updated_at before update on public.email_settings
  for each row execute function public.set_updated_at();

alter table public.email_settings enable row level security;
revoke all on table public.email_settings from anon;

create policy "team reads and edits email settings" on public.email_settings
  for all to authenticated
  using ((select public.is_team()))
  with check ((select public.is_team()));

-- Retry bookkeeping for the sender function
alter table public.email_log
  add column attempts int not null default 0,
  add column last_attempt_at timestamptz;
