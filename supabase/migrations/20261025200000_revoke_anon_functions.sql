-- Supabase grants EXECUTE on new functions to anon explicitly (default
-- privileges), so "revoke … from public" alone doesn't remove it.
-- Team-only and internal functions: no access for the public key.

revoke execute on function public.decide(uuid[], text, boolean) from anon;
revoke execute on function public.today_berlin() from anon;
