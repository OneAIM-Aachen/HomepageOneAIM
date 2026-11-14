-- ============================================================================
-- Simpler receipt locations on R2: r2:receipts/<city>/<file name>
--   (was r2:receipts/<city>/<member id>/<random id>/<file name>). Who
--   uploaded a file is recorded in file_uploads instead of in the path; the
--   edge function "files" adds a number when a name exists (receipt-2.pdf).
-- ============================================================================

create table public.file_uploads (
  path        text primary key,              -- "r2:receipts/aachen/receipt.pdf"
  member_id   uuid references public.team_members (id) on delete set null,
  location_id text references public.locations (id) on update cascade,
  created_at  timestamptz not null default now()
);
alter table public.file_uploads enable row level security;   -- no policies: written by the edge function

-- Did this member upload this file?
create or replace function public.uploaded_by(p_path text, p_member uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.file_uploads f where f.path = p_path and f.member_id = p_member);
$$;
revoke execute on function public.uploaded_by(text, uuid) from public, anon;
grant execute on function public.uploaded_by(text, uuid) to authenticated;

create or replace function public.can_read_file(p_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_path like 'r2:uploads/%' or p_path like 'uploads/%' then public.is_team()
    when p_path like 'r2:receipts/%' then
      public.uploaded_by(p_path, public.my_member_id())
      or exists (select 1 from public.claims c where c.receipt_path = p_path
                 and (c.member_id = public.my_member_id() or public.is_finance(c.location_id)))
      -- older locations with the member id as third folder
      or split_part(p_path, '/', 3) = coalesce(public.my_member_id()::text, '-')
    else public.can_read_receipt(p_path)
  end;
$$;

create or replace function public.can_delete_file(p_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_path like 'r2:uploads/%' then public.is_team()
    when p_path like 'r2:receipts/%' then
      not exists (select 1 from public.claims c where c.receipt_path = p_path)
      and (public.uploaded_by(p_path, public.my_member_id())
           or split_part(p_path, '/', 3) = coalesce(public.my_member_id()::text, '-'))
    else false
  end;
$$;

drop policy "submit own claim" on public.claims;
create policy "submit own claim" on public.claims
  for insert to authenticated
  with check (
    member_id = (select public.my_member_id())
    and status = 'submitted' and note is null and answer is null
    and decided_by is null and decided_at is null and paid_by is null and paid_at is null
    and (receipt_path like location_id || '/' || member_id::text || '/%'
         or (receipt_path like 'r2:receipts/' || location_id || '/%' and (select public.uploaded_by(receipt_path, member_id))))
  );
