-- Receipts sorted by city: finance-receipts/<city>/<member id>/<uuid>/<file>
-- (was claims/<member id>/…; no claims existed yet). The member id stays the
-- second folder, so "own receipt" checks are unchanged.

drop policy "members upload own receipts" on storage.objects;
create policy "members upload own receipts"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'finance-receipts'
    and exists (select 1 from public.locations l where l.id = (storage.foldername(name))[1])
    and (storage.foldername(name))[2] = (select public.my_member_id())::text
  );

drop policy "submit own claim" on public.claims;
create policy "submit own claim" on public.claims
  for insert to authenticated
  with check (
    member_id = (select public.my_member_id())
    and status = 'submitted' and note is null and answer is null
    and decided_by is null and decided_at is null and paid_by is null and paid_at is null
    and receipt_path like location_id || '/' || member_id::text || '/%'
  );
