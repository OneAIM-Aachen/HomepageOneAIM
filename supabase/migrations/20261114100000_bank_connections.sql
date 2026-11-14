-- ============================================================================
-- Bank connection per city (read-only, through Enable Banking / PSD2)
--   • bank_settings: the provider keys (application id + private key). Only
--     the edge function "bank" (service role) can read them; the portal can
--     only see whether they are set (bank_settings_status()).
--   • bank_connections: one per city: chosen bank, session, accounts,
--     balance, consent valid until, last sync.
--   • bank_transactions: booked transactions, synced several times a day.
--   Finance people of a city (presidents, co-presidents, lead of the
--   Finance & Legal department) see that city's connection and transactions.
-- ============================================================================

create table public.bank_settings (
  id          boolean primary key default true check (id),
  provider    text not null default 'enable_banking' check (provider in ('enable_banking')),
  app_id      text not null check (length(btrim(app_id)) > 0),
  private_key text not null,
  updated_at  timestamptz not null default now(),
  updated_by  text
);
alter table public.bank_settings enable row level security;   -- no policies: service role only

create table public.bank_connections (
  id            uuid primary key default gen_random_uuid(),
  location_id   text not null unique references public.locations (id) on update cascade on delete cascade,
  status        text not null default 'pending' check (status in ('pending', 'active', 'expired', 'error', 'disconnected')),
  aspsp_name    text not null,
  aspsp_country text not null default 'DE',
  -- OAuth-like state while the treasurer is at the bank (pending)
  auth_state    uuid,
  session_id    text,
  -- [{uid, iban, name, currency}]
  accounts      jsonb not null default '[]' check (jsonb_typeof(accounts) = 'array'),
  valid_until   timestamptz,
  balance       numeric(14, 2),
  currency      text,
  balance_at    timestamptz,
  last_sync_at  timestamptz,
  last_error    text,
  connected_by  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger bank_connections_updated_at before update on public.bank_connections
  for each row execute function public.set_updated_at();

create table public.bank_transactions (
  id            uuid primary key default gen_random_uuid(),
  location_id   text not null references public.locations (id) on update cascade on delete cascade,
  account_uid   text not null,
  external_id   text not null,               -- entry_reference, or a hash of the fields
  booking_date  date not null,
  value_date    date,
  amount        numeric(14, 2) not null,      -- negative = money out
  currency      text not null default 'EUR',
  counterparty  text not null default '',
  purpose       text not null default '',
  raw           jsonb not null default '{}',
  created_at    timestamptz not null default now(),
  unique (account_uid, external_id)
);

create index bank_transactions_city_idx on public.bank_transactions (location_id, booking_date desc);

-- Presidents, co-presidents and the lead of the Finance & Legal department
-- (of the given city, or of any city when p_location is null)
create or replace function public.is_finance(p_location text default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.team_members m
    left join public.team_departments d on d.id = m.department_id
    where m.user_id = auth.uid() and m.status = 'active'
      and (p_location is null or m.location_id = p_location)
      and (m.role in ('president', 'co_president') or (m.role = 'lead' and d.name ilike '%finance%'))
  );
$$;

revoke execute on function public.is_finance(text) from public, anon;
grant execute on function public.is_finance(text) to authenticated, service_role;

alter table public.bank_connections enable row level security;
alter table public.bank_transactions enable row level security;

create policy "finance of the city reads" on public.bank_connections
  for select to authenticated using ((select public.is_finance(location_id)));
create policy "finance of the city reads" on public.bank_transactions
  for select to authenticated using ((select public.is_finance(location_id)));
-- Writes only through the edge function "bank" (service role)

-- Whether provider keys are set (never the keys themselves)
create or replace function public.bank_settings_status()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when not public.is_team() then null else coalesce(
    (select jsonb_build_object('configured', true, 'provider', provider, 'app_id', app_id, 'updated_at', updated_at, 'updated_by', updated_by)
     from public.bank_settings),
    jsonb_build_object('configured', false)) end;
$$;

revoke execute on function public.bank_settings_status() from public, anon;
grant execute on function public.bank_settings_status() to authenticated;

alter publication supabase_realtime add table public.bank_connections, public.bank_transactions;

-- Automatic sync, 4 times a day (banks allow about 4 fetches a day without the user present)
select cron.schedule(
  'bank-sync',
  '15 1,7,13,19 * * *',
  $$ select net.http_post(
       url     := 'https://wenkvkkfmclhycyxnxxu.supabase.co/functions/v1/bank',
       headers := '{"Content-Type": "application/json"}'::jsonb,
       body    := '{"action": "sync_all"}'::jsonb
     ) $$
);
