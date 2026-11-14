-- Enable Banking and Cloudflare R2 keys are Supabase secrets now (set in the
-- dashboard, read by the edge functions "bank" and "files"), not table rows
-- entered in the portal. Both tables were never filled.

do $$
begin
  if exists (select 1 from public.bank_settings) or exists (select 1 from public.storage_settings) then
    raise exception 'keys are stored in the tables: move them to Supabase secrets first';
  end if;
end;
$$;

drop function public.bank_settings_status();
drop function public.storage_settings_status();
drop table public.bank_settings;
drop table public.storage_settings;
