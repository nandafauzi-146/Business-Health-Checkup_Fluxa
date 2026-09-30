-- 0003_indexes.sql
-- Indeks pada Foreign Key dan filter yang sering digunakan

create index if not exists idx_profiles_role on public.profiles(role);

create index if not exists idx_products_category on public.products(category_id);
create index if not exists idx_products_is_active on public.products(is_active);
create index if not exists idx_products_sku on public.products(sku);

create index if not exists idx_shifts_cashier on public.shifts(cashier_id);
create index if not exists idx_shifts_status on public.shifts(status);

create index if not exists idx_sales_cashier on public.sales(cashier_id);
create index if not exists idx_sales_shift on public.sales(shift_id);
create index if not exists idx_sales_customer on public.sales(customer_id);
create index if not exists idx_sales_status on public.sales(status);
create index if not exists idx_sales_created_at on public.sales(created_at desc);

create index if not exists idx_sale_items_sale on public.sale_items(sale_id);
create index if not exists idx_sale_items_product on public.sale_items(product_id);

create index if not exists idx_stock_movements_product on public.stock_movements(product_id);
create index if not exists idx_stock_movements_created_at on public.stock_movements(created_at desc);

create index if not exists idx_expenses_category on public.expenses(category_id);
create index if not exists idx_expenses_date on public.expenses(expense_date desc);

create index if not exists idx_receivables_customer on public.receivables(customer_id);
create index if not exists idx_receivables_status on public.receivables(status);

create index if not exists idx_receivable_payments_receivable on public.receivable_payments(receivable_id);

create index if not exists idx_checkups_period on public.checkups(period_start, period_end);
create index if not exists idx_audit_logs_user on public.audit_logs(user_id);
create index if not exists idx_audit_logs_created_at on public.audit_logs(created_at desc);
