-- 0027_security_hardening.sql
-- Memperbaiki peringatan keamanan dari Supabase Database Linter:
--   1. function_search_path_mutable  → handle_updated_at perlu SET search_path
--   2. anon_security_definer_function_executable  → fungsi SECURITY DEFINER tidak boleh bisa dipanggil anon
--   3. authenticated_security_definer_function_executable → sebagian fungsi sensitif hanya boleh service_role
--
-- Strategi:
--   a) Tambah SECURITY DEFINER + search_path pada handle_updated_at
--   b) REVOKE semua grant dari anon & public pada semua fungsi SECURITY DEFINER
--   c) Re-grant hanya ke role yang tepat: authenticated (untuk fungsi user-facing), service_role (untuk fungsi internal)

-- ============================================================
-- 1. Perbaiki handle_updated_at (function_search_path_mutable)
--    Tambahkan SECURITY DEFINER dan set search_path = public
-- ============================================================
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Trigger functions tidak boleh dipanggil langsung oleh siapapun
revoke all on function public.handle_updated_at() from public, anon, authenticated;


-- ============================================================
-- 2. Cabut semua akses anon / public dari SELURUH fungsi SECURITY DEFINER
-- ============================================================

-- Helper RLS functions
revoke all on function public.current_role() from public, anon;
revoke all on function public.is_admin_or_owner() from public, anon;
revoke all on function public.is_owner() from public, anon;
revoke all on function public.is_staff() from public, anon;
revoke all on function public.is_super_admin() from public, anon;
revoke all on function public.owner_has_active_access(uuid) from public, anon;

-- Fungsi trigger (tidak boleh dipanggil langsung oleh siapapun)
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.guard_profile_role_change() from public, anon, authenticated;
revoke all on function public.guard_profile_approval_change() from public, anon, authenticated;
revoke all on function public.guard_approved_business_actor() from public, anon, authenticated;
revoke all on function public.sync_profile_email_from_auth() from public, anon, authenticated;
revoke all on function public.prevent_platform_ledger_mutation() from public, anon, authenticated;

-- Fungsi bisnis sensitif — cabut dari anon
revoke all on function public.open_shift(integer, text) from public, anon;
revoke all on function public.close_shift(uuid, integer, text) from public, anon;
revoke all on function public.create_sale(uuid, text, integer, jsonb) from public, anon;
revoke all on function public.void_sale(uuid, text) from public, anon;
revoke all on function public.adjust_stock(uuid, text, integer, text) from public, anon;
revoke all on function public.request_sale_refund(uuid, text) from public, anon;
revoke all on function public.approve_sale_refund_request(uuid) from public, anon;
revoke all on function public.record_business_debt_payment(uuid, integer, text, text) from public, anon;

-- Fungsi super admin / payment gateway — cabut dari semua, re-grant ke service_role
revoke all on function public.super_admin_subscription_finance(uuid, timestamptz, timestamptz, text) from public, anon, authenticated;
revoke all on function public.apply_midtrans_subscription_payment(text, text, text, timestamptz) from public, anon, authenticated;


-- ============================================================
-- 3. Re-grant hak eksekusi ke role yang tepat
-- ============================================================

-- Helper RLS: authenticated perlu memanggil ini melalui RLS policies
grant execute on function public.current_role() to authenticated;
grant execute on function public.is_admin_or_owner() to authenticated;
grant execute on function public.is_owner() to authenticated;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_super_admin() to authenticated;

-- Fungsi bisnis: hanya authenticated
grant execute on function public.open_shift(integer, text) to authenticated;
grant execute on function public.close_shift(uuid, integer, text) to authenticated;
grant execute on function public.create_sale(uuid, text, integer, jsonb) to authenticated;
grant execute on function public.void_sale(uuid, text) to authenticated;
grant execute on function public.adjust_stock(uuid, text, integer, text) to authenticated;
grant execute on function public.request_sale_refund(uuid, text) to authenticated;
grant execute on function public.approve_sale_refund_request(uuid) to authenticated;
grant execute on function public.record_business_debt_payment(uuid, integer, text, text) to authenticated;

-- Fungsi internal Midtrans & super admin finance: hanya service_role
grant execute on function public.apply_midtrans_subscription_payment(text, text, text, timestamptz) to service_role;
grant execute on function public.super_admin_subscription_finance(uuid, timestamptz, timestamptz, text) to service_role;


-- ============================================================
-- 4. NOTE: auth_leaked_password_protection
--    Tidak dapat diatur via SQL migration.
--    Aktifkan di: Supabase Dashboard → Authentication → Password Protection
--    Aktifkan toggle "Enable leaked password protection (HaveIBeenPwned)"
-- ============================================================

notify pgrst, 'reload schema';
