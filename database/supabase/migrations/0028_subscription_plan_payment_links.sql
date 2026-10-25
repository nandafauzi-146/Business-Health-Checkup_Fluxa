-- ==============================================================================
-- 0028_subscription_plan_payment_links.sql
-- Integrasi Midtrans Payment Link otomatis untuk tabel subscription_plans
-- ==============================================================================

alter table public.subscription_plans
  add column if not exists payment_link_url text,
  add column if not exists payment_link_id text,
  add column if not exists payment_link_order_id text,
  add column if not exists payment_link_status text default 'unlinked',
  add column if not exists payment_link_updated_at timestamptz;

comment on column public.subscription_plans.payment_link_url is 'URL Midtrans Payment Link yang dihasilkan otomatis';
comment on column public.subscription_plans.payment_link_id is 'Identifier order_id / payment_link_id di Midtrans';
comment on column public.subscription_plans.payment_link_status is 'Status sinkronisasi link: synced, failed, unlinked';
comment on column public.subscription_plans.payment_link_updated_at is 'Waktu terakhir link pembayaran dibuat/disinkronkan';
