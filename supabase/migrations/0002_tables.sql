-- 0002_tables.sql
-- 14 Tabel Inti Sistem POS & Diagnosis Kesehatan Bisnis UMKM
-- Sesuai aturan AGENTS.md: Semua kolom uang bertipe integer (rupiah utuh).

-- 1. Profiles (berelasi 1-to-1 dengan auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('kasir', 'admin', 'owner')),
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Categories
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Products
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  sku text unique,
  barcode text,
  buy_price integer not null check (buy_price >= 0),
  sell_price integer not null check (sell_price >= 0),
  stock integer not null default 0,
  min_stock integer not null default 5,
  unit text not null default 'pcs',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. Customers
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5. Shifts
create table if not exists public.shifts (
  id uuid primary key default gen_random_uuid(),
  cashier_id uuid not null references public.profiles(id),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  initial_cash integer not null check (initial_cash >= 0),
  final_cash integer check (final_cash is null or final_cash >= 0),
  expected_cash integer check (expected_cash is null or expected_cash >= 0),
  difference integer,
  note text,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 6. Sales
create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  shift_id uuid references public.shifts(id) on delete set null,
  cashier_id uuid not null references public.profiles(id),
  customer_id uuid references public.customers(id) on delete set null,
  total_amount integer not null check (total_amount >= 0),
  discount integer not null default 0 check (discount >= 0),
  final_amount integer not null check (final_amount >= 0),
  payment_method text not null check (payment_method in ('cash', 'qris', 'transfer', 'credit')),
  payment_status text not null default 'paid' check (payment_status in ('paid', 'unpaid', 'partial')),
  status text not null default 'completed' check (status in ('completed', 'voided')),
  void_reason text,
  voided_at timestamptz,
  voided_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 7. Sale Items
create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity integer not null check (quantity > 0),
  unit_price integer not null check (unit_price >= 0),
  buy_price integer not null check (buy_price >= 0),
  subtotal integer not null check (subtotal >= 0),
  created_at timestamptz not null default now()
);

-- 8. Stock Movements
create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  type text not null check (type in ('in', 'out', 'adjustment', 'sale', 'void_return')),
  quantity integer not null,
  previous_stock integer not null,
  current_stock integer not null,
  reference_id uuid,
  note text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- 9. Expense Categories
create table if not exists public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamptz not null default now()
);

-- 10. Expenses
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.expense_categories(id) on delete set null,
  amount integer not null check (amount > 0),
  description text not null,
  expense_date date not null default current_date,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 11. Receivables (Kasbon / Piutang)
create table if not exists public.receivables (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  sale_id uuid references public.sales(id) on delete set null,
  total_amount integer not null check (total_amount > 0),
  paid_amount integer not null default 0 check (paid_amount >= 0),
  due_date date,
  status text not null default 'unpaid' check (status in ('unpaid', 'partial', 'paid')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 12. Receivable Payments
create table if not exists public.receivable_payments (
  id uuid primary key default gen_random_uuid(),
  receivable_id uuid not null references public.receivables(id) on delete cascade,
  amount integer not null check (amount > 0),
  payment_date timestamptz not null default now(),
  payment_method text not null check (payment_method in ('cash', 'qris', 'transfer')),
  note text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

-- 13. Checkups (Rapor Kesehatan Bisnis untuk Owner)
create table if not exists public.checkups (
  id uuid primary key default gen_random_uuid(),
  period_start date not null,
  period_end date not null,
  overall_score integer not null check (overall_score between 0 and 100),
  health_status text not null check (health_status in ('sehat', 'waspada', 'kritis')),
  revenue integer not null default 0,
  cogs integer not null default 0,
  gross_profit integer not null default 0,
  operating_expenses integer not null default 0,
  net_profit integer not null default 0,
  metrics jsonb not null default '{}'::jsonb,
  ai_recommendations text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

-- 14. Audit Logs
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  table_name text not null,
  record_id uuid,
  old_data jsonb,
  new_data jsonb,
  ip_address text,
  created_at timestamptz not null default now()
);
