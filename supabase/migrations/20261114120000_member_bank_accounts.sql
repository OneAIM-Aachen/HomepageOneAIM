-- ============================================================================
-- Saved bank accounts (IBANs) of team members, for reimbursements.
--   A member saves their account(s) once and picks one for each claim.
--   Visible to the member themselves and to the finance people of the
--   member's city (presidents, Finance & Legal lead) who pay the claims.
-- ============================================================================

create table public.member_bank_accounts (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid not null references public.team_members (id) on delete cascade,
  iban       text not null check (iban ~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$'),
  holder     text not null check (length(btrim(holder)) between 1 and 140),
  label      text check (label is null or length(label) <= 60),
  created_at timestamptz not null default now(),
  unique (member_id, iban)
);

alter table public.member_bank_accounts enable row level security;

create policy "own accounts" on public.member_bank_accounts
  for all to authenticated
  using (member_id in (select m.id from public.team_members m where m.user_id = (select auth.uid())))
  with check (member_id in (select m.id from public.team_members m where m.user_id = (select auth.uid()) and m.status = 'active'));

create policy "finance of the member's city reads" on public.member_bank_accounts
  for select to authenticated
  using ((select public.is_finance(m.location_id) from public.team_members m where m.id = member_id));
