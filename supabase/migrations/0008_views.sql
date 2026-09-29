-- 0008_views.sql
-- View Reporting Finansial & Operasional
-- WAJIB: with (security_invoker = true) agar otomatis tersaring RLS sesuai role pemanggil.

-- 1. View Ringkasan Pendapatan dan HPP Bulanan (v_monthly_revenue_cogs)
create or replace view public.v_monthly_revenue_cogs
with (security_invoker = true)
as
select
  to_char(date_trunc('month', s.created_at), 'YYYY-MM') as month,
  count(distinct s.id)::integer as total_orders,
  coalesce(sum(s.final_amount), 0)::integer as gross_revenue,
  coalesce(sum(si.buy_price * si.quantity), 0)::integer as cogs,
  coalesce(sum(s.final_amount) - sum(si.buy_price * si.quantity), 0)::integer as gross_profit
from public.sales s
left join public.sale_items si on si.sale_id = s.id
where s.status = 'completed'
group by date_trunc('month', s.created_at)
order by month desc;

-- 2. View Ringkasan Penjualan Harian (v_daily_sales_summary)
create or replace view public.v_daily_sales_summary
with (security_invoker = true)
as
select
  s.created_at::date as sale_date,
  count(s.id)::integer as transaction_count,
  coalesce(sum(s.final_amount), 0)::integer as total_revenue,
  coalesce(sum(case when s.payment_method = 'cash' then s.final_amount else 0 end), 0)::integer as cash_revenue,
  coalesce(sum(case when s.payment_method in ('qris', 'transfer') then s.final_amount else 0 end), 0)::integer as non_cash_revenue,
  coalesce(sum(case when s.payment_method = 'credit' then s.final_amount else 0 end), 0)::integer as credit_revenue
from public.sales s
where s.status = 'completed'
group by s.created_at::date
order by sale_date desc;

-- 3. View Peringatan Stok Menipis (v_low_stock_products)
create or replace view public.v_low_stock_products
with (security_invoker = true)
as
select
  p.id,
  p.name,
  c.name as category_name,
  p.stock,
  p.min_stock,
  p.unit,
  p.sell_price,
  (p.stock <= p.min_stock) as is_low_stock
from public.products p
left join public.categories c on c.id = p.category_id
where p.is_active = true
order by p.stock asc;
