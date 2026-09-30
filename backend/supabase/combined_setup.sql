-- 0001_extensions.sql
-- Extension pgcrypto untuk gen_random_uuid() dan fungsi kriptografi
create extension if not exists "pgcrypto";
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
-- 0004_helper_functions.sql
-- Fungsi pembantu role untuk RLS dan validasi server-side
-- WAJIB SECURITY DEFINER untuk mencegah infinite recursion di RLS profiles

create or replace function public.current_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin_or_owner()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'owner')
  );
$$;

create or replace function public.is_owner()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'owner'
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('kasir', 'admin', 'owner')
  );
$$;
-- 0005_triggers.sql
-- Triggers: handle_new_user, updated_at, dan guard anti eskalasi role

-- 1. Fungsi & Trigger update updated_at otomatis
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at before update on public.profiles
  for each row execute function public.handle_updated_at();

create trigger trg_categories_updated_at before update on public.categories
  for each row execute function public.handle_updated_at();

create trigger trg_products_updated_at before update on public.products
  for each row execute function public.handle_updated_at();

create trigger trg_customers_updated_at before update on public.customers
  for each row execute function public.handle_updated_at();

create trigger trg_shifts_updated_at before update on public.shifts
  for each row execute function public.handle_updated_at();

create trigger trg_sales_updated_at before update on public.sales
  for each row execute function public.handle_updated_at();

create trigger trg_expenses_updated_at before update on public.expenses
  for each row execute function public.handle_updated_at();

create trigger trg_receivables_updated_at before update on public.receivables
  for each row execute function public.handle_updated_at();

-- 2. Fungsi & Trigger handle_new_user dari auth.users
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_name text;
begin
  v_role := coalesce(new.raw_user_meta_data->>'role', 'kasir');
  if v_role not in ('kasir', 'admin', 'owner') then
    v_role := 'kasir';
  end if;

  v_name := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));

  insert into public.profiles (id, full_name, role, phone)
  values (new.id, v_name, v_role, new.raw_user_meta_data->>'phone')
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Trigger pada auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3. Guard Anti-Eskalasi Role (trg_guard_profile_role_change)
-- Sesuai aturan: user biasa tidak boleh mengubah role-nya sendiri ke admin/owner
create or replace function public.guard_profile_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role is distinct from new.role then
    -- Hanya admin atau owner yang berhak mengubah role akun
    if not public.is_admin_or_owner() then
      raise exception 'Akses ditolak: Hanya Admin atau Owner yang dapat mengubah role pengguna.';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_guard_profile_role_change
  before update on public.profiles
  for each row execute function public.guard_profile_role_change();
-- 0006_business_functions.sql
-- Fungsi bisnis transaksional atomik (SECURITY DEFINER)
-- Sesuai aturan AGENTS.md: sales, sale_items, stock_movements HANYA boleh dimutasi lewat RPC di sini.

-- 1. RPC Buka Shift
create or replace function public.open_shift(
  p_initial_cash integer,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cashier_id uuid;
  v_existing_shift uuid;
  v_shift_id uuid;
begin
  v_cashier_id := auth.uid();
  if v_cashier_id is null then
    raise exception 'Harus login untuk membuka shift.';
  end if;

  -- Pastikan kasir tidak memiliki shift yang masih terbuka
  select id into v_existing_shift
  from public.shifts
  where cashier_id = v_cashier_id and status = 'open'
  limit 1;

  if v_existing_shift is not null then
    raise exception 'Anda masih memiliki shift yang aktif (ID: %). Tutup shift lama terlebih dahulu.', v_existing_shift;
  end if;

  insert into public.shifts (cashier_id, initial_cash, note, status)
  values (v_cashier_id, greatest(0, p_initial_cash), p_note, 'open')
  returning id into v_shift_id;

  return v_shift_id;
end;
$$;

-- 2. RPC Tutup Shift
create or replace function public.close_shift(
  p_shift_id uuid,
  p_final_cash integer,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shift public.shifts%rowtype;
  v_cash_sales integer := 0;
  v_expected_cash integer := 0;
  v_difference integer := 0;
begin
  select * into v_shift from public.shifts where id = p_shift_id;
  if not found then
    raise exception 'Shift tidak ditemukan.';
  end if;

  if v_shift.status = 'closed' then
    raise exception 'Shift ini sudah ditutup sebelumnya.';
  end if;

  -- Hanya kasir pemilik shift atau admin/owner yang dapat menutup shift
  if v_shift.cashier_id != auth.uid() and not public.is_admin_or_owner() then
    raise exception 'Akses ditolak: Anda tidak memiliki akses untuk menutup shift ini.';
  end if;

  -- Hitung total penjualan uang tunai selama shift ini
  select coalesce(sum(final_amount), 0) into v_cash_sales
  from public.sales
  where shift_id = p_shift_id
    and payment_method = 'cash'
    and status = 'completed';

  v_expected_cash := v_shift.initial_cash + v_cash_sales;
  v_difference := p_final_cash - v_expected_cash;

  update public.shifts
  set closed_at = now(),
      final_cash = p_final_cash,
      expected_cash = v_expected_cash,
      difference = v_difference,
      note = coalesce(p_note, note),
      status = 'closed'
  where id = p_shift_id;

  return jsonb_build_object(
    'shift_id', p_shift_id,
    'initial_cash', v_shift.initial_cash,
    'cash_sales', v_cash_sales,
    'expected_cash', v_expected_cash,
    'final_cash', p_final_cash,
    'difference', v_difference
  );
end;
$$;

-- 3. RPC Transaksi Penjualan (create_sale)
-- Parameter p_items berformat JSON array: [{"product_id": "...", "quantity": 2}, ...]
create or replace function public.create_sale(
  p_shift_id uuid,
  p_customer_id uuid,
  p_payment_method text,
  p_discount integer default 0,
  p_items jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cashier_id uuid;
  v_sale_id uuid;
  v_invoice_number text;
  v_shift public.shifts%rowtype;
  v_total_amount integer := 0;
  v_final_amount integer := 0;
  v_discount integer := coalesce(p_discount, 0);
  v_item record;
  v_product public.products%rowtype;
  v_subtotal integer;
  v_seq integer;
begin
  v_cashier_id := auth.uid();
  if v_cashier_id is null then
    raise exception 'Pengguna harus login untuk memproses transaksi.';
  end if;

  -- Validasi shift aktif
  select * into v_shift from public.shifts where id = p_shift_id;
  if not found or v_shift.status != 'open' then
    raise exception 'Shift tidak valid atau sudah ditutup.';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'Keranjang belanja tidak boleh kosong.';
  end if;

  if p_payment_method not in ('cash', 'qris', 'transfer', 'credit') then
    raise exception 'Metode pembayaran tidak valid.';
  end if;

  -- Buat invoice number: INV-YYYYMMDD-XXXXX
  v_invoice_number := 'INV-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(md5(random()::text), 1, 6));

  -- Buat header sales terlebih dahulu (total diupdate setelah hitung item)
  insert into public.sales (
    invoice_number,
    shift_id,
    cashier_id,
    customer_id,
    total_amount,
    discount,
    final_amount,
    payment_method,
    payment_status,
    status
  ) values (
    v_invoice_number,
    p_shift_id,
    v_cashier_id,
    p_customer_id,
    0,
    v_discount,
    0,
    p_payment_method,
    case when p_payment_method = 'credit' then 'unpaid' else 'paid' end,
    'completed'
  ) returning id into v_sale_id;

  -- Iterasi setiap item barang
  for v_item in select * from jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer)
  loop
    if v_item.quantity <= 0 then
      raise exception 'Jumlah barang harus lebih besar dari 0.';
    end if;

    select * into v_product from public.products where id = v_item.product_id for update;
    if not found then
      raise exception 'Produk ID % tidak ditemukan.', v_item.product_id;
    end if;

    if not v_product.is_active then
      raise exception 'Produk % sedang tidak aktif.', v_product.name;
    end if;

    if v_product.stock < v_item.quantity then
      raise exception 'Stok untuk produk "%" tidak mencukupi (sisa: %, diminta: %).',
        v_product.name, v_product.stock, v_item.quantity;
    end if;

    v_subtotal := v_product.sell_price * v_item.quantity;
    v_total_amount := v_total_amount + v_subtotal;

    -- Simpan sale_item (mencatat buy_price/HPP untuk laporan laba kotor)
    insert into public.sale_items (
      sale_id,
      product_id,
      quantity,
      unit_price,
      buy_price,
      subtotal
    ) values (
      v_sale_id,
      v_product.id,
      v_item.quantity,
      v_product.sell_price,
      v_product.buy_price,
      v_subtotal
    );

    -- Potong stok produk
    update public.products
    set stock = stock - v_item.quantity
    where id = v_product.id;

    -- Catat riwayat pergerakan stok
    insert into public.stock_movements (
      product_id,
      type,
      quantity,
      previous_stock,
      current_stock,
      reference_id,
      note,
      created_by
    ) values (
      v_product.id,
      'sale',
      -v_item.quantity,
      v_product.stock,
      v_product.stock - v_item.quantity,
      v_sale_id,
      'Penjualan invoice ' || v_invoice_number,
      v_cashier_id
    );
  end loop;

  -- Hitung final amount
  v_final_amount := greatest(0, v_total_amount - v_discount);

  -- Update header sales dengan total kalkulasi
  update public.sales
  set total_amount = v_total_amount,
      final_amount = v_final_amount
  where id = v_sale_id;

  -- Jika metode pembayaran adalah 'credit' (kasbon), otomatis masukkan ke receivables
  if p_payment_method = 'credit' then
    if p_customer_id is null then
      raise exception 'Pelanggan wajib dipilih untuk transaksi kasbon / kredit.';
    end if;

    insert into public.receivables (
      customer_id,
      sale_id,
      total_amount,
      paid_amount,
      status,
      note
    ) values (
      p_customer_id,
      v_sale_id,
      v_final_amount,
      0,
      'unpaid',
      'Kasbon dari transaksi ' || v_invoice_number
    );
  end if;

  return v_sale_id;
end;
$$;

-- 4. RPC Void Penjualan (void_sale)
-- Sesuai aturan: Kasir TIDAK BISA void, hanya Admin dan Owner
create or replace function public.void_sale(
  p_sale_id uuid,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale public.sales%rowtype;
  v_item record;
  v_product public.products%rowtype;
  v_user_id uuid;
begin
  v_user_id := auth.uid();
  if not public.is_admin_or_owner() then
    raise exception 'Akses ditolak: Hanya Admin atau Owner yang berhak melakukan pembatalan (void) transaksi.';
  end if;

  if p_reason is null or trim(p_reason) = '' then
    raise exception 'Alasan pembatalan (void) wajib diisi.';
  end if;

  select * into v_sale from public.sales where id = p_sale_id for update;
  if not found then
    raise exception 'Data penjualan tidak ditemukan.';
  end if;

  if v_sale.status = 'voided' then
    raise exception 'Transaksi ini sudah pernah dibatalkan (void).';
  end if;

  -- Kembalikan stok untuk setiap item penjualan
  for v_item in select * from public.sale_items where sale_id = p_sale_id
  loop
    select * into v_product from public.products where id = v_item.product_id for update;

    update public.products
    set stock = stock + v_item.quantity
    where id = v_item.product_id;

    insert into public.stock_movements (
      product_id,
      type,
      quantity,
      previous_stock,
      current_stock,
      reference_id,
      note,
      created_by
    ) values (
      v_item.product_id,
      'void_return',
      v_item.quantity,
      v_product.stock,
      v_product.stock + v_item.quantity,
      p_sale_id,
      'Pengembalian stok pembatalan ' || v_sale.invoice_number || ': ' || p_reason,
      v_user_id
    );
  end loop;

  -- Jika sebelumnya transaksi kredit, batalkan piutangnya
  delete from public.receivables where sale_id = p_sale_id;

  -- Tandai status void pada header penjualan
  update public.sales
  set status = 'voided',
      void_reason = p_reason,
      voided_at = now(),
      voided_by = v_user_id
  where id = p_sale_id;

  -- Catat ke audit log
  insert into public.audit_logs (
    user_id,
    action,
    table_name,
    record_id,
    old_data,
    new_data
  ) values (
    v_user_id,
    'VOID_SALE',
    'sales',
    p_sale_id,
    row_to_json(v_sale)::jsonb,
    jsonb_build_object('void_reason', p_reason, 'voided_at', now(), 'voided_by', v_user_id)
  );

  return true;
end;
$$;
-- 0007_rls_policies.sql
-- Row Level Security (RLS) policies per tabel
-- Mengikuti Matriks Hak Akses AGENTS.md (Kasir, Admin, Owner)
-- PENTING: sales, sale_items, stock_movements TIDAK memiliki policy INSERT/UPDATE untuk client.

-- 1. PROFILES
alter table public.profiles enable row level security;

create policy "Profiles dapat dilihat oleh pengguna terotentikasi"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Pengguna dapat mengupdate profil sendiri"
  on public.profiles for update
  to authenticated
  using (id = auth.uid() or public.is_admin_or_owner())
  with check (id = auth.uid() or public.is_admin_or_owner());

-- 2. CATEGORIES
alter table public.categories enable row level security;

create policy "Kategori dapat dibaca oleh staf"
  on public.categories for select
  to authenticated
  using (public.is_staff());

create policy "Kategori dapat dikelola oleh admin dan owner"
  on public.categories for all
  to authenticated
  using (public.is_admin_or_owner())
  with check (public.is_admin_or_owner());

-- 3. PRODUCTS
alter table public.products enable row level security;

create policy "Produk dapat dibaca oleh staf"
  on public.products for select
  to authenticated
  using (public.is_staff());

create policy "Produk dapat dikelola oleh admin dan owner"
  on public.products for all
  to authenticated
  using (public.is_admin_or_owner())
  with check (public.is_admin_or_owner());

-- 4. CUSTOMERS
alter table public.customers enable row level security;

create policy "Pelanggan dapat dibaca oleh staf"
  on public.customers for select
  to authenticated
  using (public.is_staff());

create policy "Pelanggan dapat ditambahkan atau diubah oleh staf"
  on public.customers for insert
  to authenticated
  with check (public.is_staff());

create policy "Pelanggan dapat diedit oleh staf"
  on public.customers for update
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy "Pelanggan hanya dapat dihapus oleh admin atau owner"
  on public.customers for delete
  to authenticated
  using (public.is_admin_or_owner());

-- 5. SHIFTS
alter table public.shifts enable row level security;

create policy "Shifts dapat dibaca oleh kasir pemilik atau admin/owner"
  on public.shifts for select
  to authenticated
  using (cashier_id = auth.uid() or public.is_admin_or_owner());

-- 6. SALES (Hanya SELECT - mutasi lewat RPC create_sale & void_sale)
alter table public.sales enable row level security;

create policy "Sales dapat dibaca oleh kasir pembuat atau admin/owner"
  on public.sales for select
  to authenticated
  using (cashier_id = auth.uid() or public.is_admin_or_owner());

-- 7. SALE_ITEMS (Hanya SELECT - mutasi lewat RPC create_sale)
alter table public.sale_items enable row level security;

create policy "Sale items dapat dibaca oleh staf pemilik transaksi atau admin/owner"
  on public.sale_items for select
  to authenticated
  using (
    exists (
      select 1 from public.sales s
      where s.id = sale_items.sale_id
        and (s.cashier_id = auth.uid() or public.is_admin_or_owner())
    )
  );

-- 8. STOCK_MOVEMENTS (Hanya SELECT - mutasi lewat RPC)
alter table public.stock_movements enable row level security;

create policy "Pergerakan stok hanya dapat dilihat oleh admin dan owner"
  on public.stock_movements for select
  to authenticated
  using (public.is_admin_or_owner());

-- 9. EXPENSE_CATEGORIES
alter table public.expense_categories enable row level security;

create policy "Kategori biaya hanya dapat diakses oleh admin dan owner"
  on public.expense_categories for all
  to authenticated
  using (public.is_admin_or_owner())
  with check (public.is_admin_or_owner());

-- 10. EXPENSES
alter table public.expenses enable row level security;

create policy "Data biaya operasional hanya untuk admin dan owner"
  on public.expenses for all
  to authenticated
  using (public.is_admin_or_owner())
  with check (public.is_admin_or_owner());

-- 11. RECEIVABLES (Kasbon)
alter table public.receivables enable row level security;

create policy "Data piutang/kasbon hanya untuk admin dan owner"
  on public.receivables for all
  to authenticated
  using (public.is_admin_or_owner())
  with check (public.is_admin_or_owner());

-- 12. RECEIVABLE_PAYMENTS
alter table public.receivable_payments enable row level security;

create policy "Pembayaran piutang hanya untuk admin dan owner"
  on public.receivable_payments for all
  to authenticated
  using (public.is_admin_or_owner())
  with check (public.is_admin_or_owner());

-- 13. CHECKUPS (Rapor Kesehatan Bisnis - HANYA OWNER)
alter table public.checkups enable row level security;

create policy "Rapor kesehatan bisnis eksklusif untuk owner"
  on public.checkups for all
  to authenticated
  using (public.is_owner())
  with check (public.is_owner());

-- 14. AUDIT_LOGS (HANYA OWNER)
alter table public.audit_logs enable row level security;

create policy "Audit log eksklusif untuk owner"
  on public.audit_logs for select
  to authenticated
  using (public.is_owner());
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
-- supabase/seed.sql
-- Data Dummy: Kategori, Produk, Pelanggan, Kategori Pengeluaran

-- 1. Kategori Produk
insert into public.categories (name, description) values
  ('Minuman', 'Aneka minuman kopi, teh, dan jus'),
  ('Makanan Ringan', 'Camilan, roti, dan snack'),
  ('Sembako', 'Bahan pokok kebutuhan harian'),
  ('Makanan Berat', 'Makanan siap santap')
on conflict (name) do nothing;

-- 2. Produk (Semua harga dalam rupiah integer utuh)
insert into public.products (category_id, name, sku, barcode, buy_price, sell_price, stock, min_stock, unit, is_active) values
  ((select id from public.categories where name = 'Minuman'), 'Kopi Susu Gula Aren', 'MNM-001', '8991001001', 8000, 15000, 50, 10, 'cup', true),
  ((select id from public.categories where name = 'Minuman'), 'Es Teh Melati Manis', 'MNM-002', '8991001002', 2000, 5000, 100, 20, 'cup', true),
  ((select id from public.categories where name = 'Makanan Ringan'), 'Keripik Singkong Balado', 'SNK-001', '8992002001', 6000, 10000, 30, 8, 'bungkus', true),
  ((select id from public.categories where name = 'Makanan Ringan'), 'Roti Cokelat Keju', 'SNK-002', '8992002002', 7000, 12000, 25, 5, 'pcs', true),
  ((select id from public.categories where name = 'Sembako'), 'Beras Ramos 5kg', 'SBK-001', '8993003001', 65000, 75000, 20, 5, 'karung', true),
  ((select id from public.categories where name = 'Sembako'), 'Minyak Goreng Sawit 1L', 'SBK-002', '8993003002', 15000, 18500, 40, 10, 'pouch', true),
  ((select id from public.categories where name = 'Makanan Berat'), 'Nasi Goreng Spesial', 'MKN-001', '8994004001', 12000, 22000, 40, 5, 'porsi', true)
on conflict (sku) do nothing;

-- 3. Pelanggan Tetap
insert into public.customers (name, phone, address) values
  ('Budi Santoso', '081234567890', 'Jl. Merdeka No. 12, Sleman'),
  ('Siti Rahmawati', '085712345678', 'Jl. Kaliurang KM 5, Sleman'),
  ('Warung Bu Joko', '081398765432', 'Jl. Palagan No. 45, Sleman');

-- 4. Kategori Biaya Operasional
insert into public.expense_categories (name, description) values
  ('Bahan Baku & Restok', 'Pembelian bahan dan kulakan produk'),
  ('Listrik & Utilitas', 'Tagihan PLN, PDAM, dan internet'),
  ('Gaji & Upah Kasir', 'Insentif dan upah staf'),
  ('Sewa Tempat & Kebersihan', 'Sewa kios dan iuran lingkungan')
on conflict (name) do nothing;
