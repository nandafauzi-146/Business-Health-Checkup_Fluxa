-- ==============================================================================
-- 0021_platform_expenses_and_reporting.sql
-- Menambahkan category dan transaction_date ke platform_withdrawals untuk
-- pencatatan pengeluaran (expenses) dan penarikan (withdrawals) eksternal platform.
-- ==============================================================================

alter table public.platform_withdrawals
  add column if not exists category text not null default 'withdraw',
  add column if not exists transaction_date date not null default current_date;

create index if not exists idx_platform_withdrawals_date
  on public.platform_withdrawals (transaction_date desc);

create index if not exists idx_platform_withdrawals_category
  on public.platform_withdrawals (category);
