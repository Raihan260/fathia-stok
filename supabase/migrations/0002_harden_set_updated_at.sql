-- Fungsi trigger tidak perlu SECURITY DEFINER, dan tidak perlu bisa dipanggil
-- sebagai RPC lewat REST API (/rest/v1/rpc/set_updated_at).
-- Ditemukan oleh Supabase security advisor setelah migrasi 0001.
alter function public.set_updated_at() security invoker;

revoke all on function public.set_updated_at() from public;
revoke all on function public.set_updated_at() from anon;
revoke all on function public.set_updated_at() from authenticated;
