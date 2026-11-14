-- ============================================================================
-- Reimbursement claims ("Get money back")
--   A team member uploads a receipt and asks for money back from a city's
--   account. The finance people of that city (presidents, co-presidents,
--   Finance & Legal lead: is_finance) approve, ask a question or reject,
--   and mark approved claims as paid after the bank transfer.
--   • Nobody decides on their own claim (four-eyes rule).
--   • The member can delete their claim until it is approved.
--   • No emails: the status shows in the member's "My claims".
-- Receipts: private bucket "finance-receipts", path claims/<member id>/<uuid>/<file>.
-- ============================================================================

create table public.claims (
  id            uuid primary key default gen_random_uuid(),
  member_id     uuid not null references public.team_members (id) on delete restrict,
  location_id   text not null references public.locations (id) on update cascade,
  amount        numeric(12, 2) not null check (amount > 0 and amount < 100000),
  paid_on       date not null,
  what          text not null check (length(btrim(what)) between 1 and 300),
  project       text not null default 'General',
  category      text not null,
  receipt_path  text not null,
  receipt_name  text not null,
  iban          text not null check (iban ~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$'),
  holder        text not null check (length(btrim(holder)) between 1 and 140),
  status        text not null default 'submitted' check (status in ('submitted', 'question', 'approved', 'paid', 'rejected')),
  note          text,                     -- question or reason for rejecting
  answer        text,                     -- member's answer to a question
  decided_by    text,
  decided_at    timestamptz,
  paid_by       text,
  paid_at       timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index claims_city_status_idx on public.claims (location_id, status);
create index claims_member_idx on public.claims (member_id, created_at desc);

create trigger claims_updated_at before update on public.claims
  for each row execute function public.set_updated_at();

alter table public.claims enable row level security;

/** team_members.id of the signed-in person (active only) */
create or replace function public.my_member_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.id from public.team_members m where m.user_id = auth.uid() and m.status = 'active';
$$;

revoke execute on function public.my_member_id() from public, anon;
grant execute on function public.my_member_id() to authenticated;

create policy "own claims and claims of my city (finance)" on public.claims
  for select to authenticated
  using (member_id = (select public.my_member_id()) or (select public.is_finance(location_id)));

create policy "submit own claim" on public.claims
  for insert to authenticated
  with check (
    member_id = (select public.my_member_id())
    and status = 'submitted' and note is null and answer is null
    and decided_by is null and decided_at is null and paid_by is null and paid_at is null
    and receipt_path like 'claims/' || member_id::text || '/%'
  );
-- Changes only through the functions below

alter publication supabase_realtime add table public.claims;

-- ── Member ──────────────────────────────────────────────────────────────────

-- Deletes an own claim that isn't approved yet; returns the receipt path (to remove the file)
create or replace function public.claim_delete(p_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_path text;
begin
  delete from public.claims
  where id = p_id and member_id = public.my_member_id() and status in ('submitted', 'question')
  returning receipt_path into v_path;
  if v_path is null then raise exception 'claim_not_deletable'; end if;
  return v_path;
end;
$$;

-- Answers a question of the finance team; the claim goes back to "submitted"
create or replace function public.claim_answer(p_id uuid, p_answer text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if length(btrim(coalesce(p_answer, ''))) = 0 then raise exception 'missing_field'; end if;
  update public.claims set status = 'submitted', answer = left(btrim(p_answer), 1000)
  where id = p_id and member_id = public.my_member_id() and status = 'question';
  if not found then raise exception 'claim_not_found'; end if;
end;
$$;

-- ── Finance of the claim's city ─────────────────────────────────────────────

-- approve | question | reject; question and reject need a note. Returns how many changed.
create or replace function public.claim_decide(p_ids uuid[], p_decision text, p_note text default null)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me    uuid := public.my_member_id();
  v_name  text;
  v_claim public.claims;
  v_count int := 0;
begin
  if p_decision not in ('approve', 'question', 'reject') then raise exception 'invalid_option'; end if;
  if p_decision <> 'approve' and length(btrim(coalesce(p_note, ''))) = 0 then raise exception 'missing_field'; end if;
  select m.name || ' (' || l.name || ')' into v_name
  from public.team_members m join public.locations l on l.id = m.location_id where m.id = v_me;

  for v_claim in select * from public.claims where id = any(p_ids) for update loop
    if not public.is_finance(v_claim.location_id) then raise exception 'not_allowed'; end if;
    if v_claim.member_id = v_me then raise exception 'claim_own'; end if;
    if v_claim.status <> 'submitted' then raise exception 'claim_already_decided'; end if;
    update public.claims set
      status = case p_decision when 'approve' then 'approved' when 'question' then 'question' else 'rejected' end,
      note = case when p_decision = 'approve' then null else left(btrim(p_note), 1000) end,
      decided_by = v_name, decided_at = now()
    where id = v_claim.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- After the bank transfer: approved → paid
create or replace function public.claim_mark_paid(p_ids uuid[])
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name  text;
  v_claim public.claims;
  v_count int := 0;
begin
  select m.name || ' (' || l.name || ')' into v_name
  from public.team_members m join public.locations l on l.id = m.location_id where m.id = public.my_member_id();
  for v_claim in select * from public.claims where id = any(p_ids) for update loop
    if not public.is_finance(v_claim.location_id) then raise exception 'not_allowed'; end if;
    if v_claim.status <> 'approved' then raise exception 'claim_not_approved'; end if;
    update public.claims set status = 'paid', paid_by = v_name, paid_at = now() where id = v_claim.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke execute on function public.claim_delete(uuid), public.claim_answer(uuid, text),
  public.claim_decide(uuid[], text, text), public.claim_mark_paid(uuid[]) from public, anon;
grant execute on function public.claim_delete(uuid), public.claim_answer(uuid, text),
  public.claim_decide(uuid[], text, text), public.claim_mark_paid(uuid[]) to authenticated;

-- ── Receipts ────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('finance-receipts', 'finance-receipts', false, 10485760,
        array['application/pdf', 'image/png', 'image/jpeg', 'image/heic', 'image/heif', 'image/webp'])
on conflict (id) do nothing;

-- Who may open a receipt: the member who uploaded it, or finance of the claim's city
create or replace function public.can_read_receipt(p_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select split_part(p_path, '/', 2) = coalesce(public.my_member_id()::text, '-')
      or exists (select 1 from public.claims c where c.receipt_path = p_path and public.is_finance(c.location_id));
$$;

revoke execute on function public.can_read_receipt(text) from public, anon;
grant execute on function public.can_read_receipt(text) to authenticated;

create policy "members upload own receipts"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'finance-receipts'
    and (storage.foldername(name))[1] = 'claims'
    and (storage.foldername(name))[2] = (select public.my_member_id())::text
  );

create policy "receipts for owner and finance"
  on storage.objects for select to authenticated
  using (bucket_id = 'finance-receipts' and (select public.can_read_receipt(name)));

-- The member removes the file of a claim they deleted (or an upload whose claim failed)
create policy "members delete own receipts without open claim"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'finance-receipts'
    and (storage.foldername(name))[2] = (select public.my_member_id())::text
    and not exists (select 1 from public.claims c where c.receipt_path = name)
  );
