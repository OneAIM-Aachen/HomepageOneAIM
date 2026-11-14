-- Fix: inside the subqueries, "name" was resolved to locations.name instead of
-- the storage object's path, so no upload passed. Qualify it as objects.name.

drop policy "members upload own receipts" on storage.objects;
create policy "members upload own receipts"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'finance-receipts'
    and exists (select 1 from public.locations l where l.id = (storage.foldername(objects.name))[1])
    and (storage.foldername(objects.name))[2] = (select public.my_member_id())::text
  );

drop policy "members delete own receipts without open claim" on storage.objects;
create policy "members delete own receipts without open claim"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'finance-receipts'
    and (storage.foldername(objects.name))[2] = (select public.my_member_id())::text
    and not exists (select 1 from public.claims c where c.receipt_path = objects.name)
  );
