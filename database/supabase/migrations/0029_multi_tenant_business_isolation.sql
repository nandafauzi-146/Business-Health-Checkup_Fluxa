-- 0029_multi_tenant_business_isolation.sql
-- Enforces strict multi-tenant business data isolation across all operational tables,
-- profiles, staff management, and subscription scoping.

-- ==============================================================================
-- 1. Create the Core businesses Table
-- ==============================================================================
create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.businesses is 'Multi-tenant business entity owned by a single business Owner.';

-- ==============================================================================
-- 2. Add business_id to profiles Table
-- ==============================================================================
alter table public.profiles
  add column if not exists business_id uuid references public.businesses(id) on delete set null;

create index if not exists idx_profiles_business_id on public.profiles(business_id);

-- ==============================================================================
-- 3. Backfill Businesses for Existing Owners and Link Profiles
-- ==============================================================================
insert into public.businesses (id, owner_id, name)
select
  gen_random_uuid(),
  p.id,
  coalesce(nullif(trim(p.full_name), '') || ' Store', 'Toko Fluxa')
from public.profiles p
where p.role = 'owner'
on conflict (owner_id) do nothing;

update public.profiles p
set business_id = b.id
from public.businesses b
where b.owner_id = p.id and p.role = 'owner' and p.business_id is null;

-- Link existing non-owner staff (admin, kasir) to the first owner's business
do $$
declare
  v_default_bid uuid;
begin
  select id into v_default_bid from public.businesses order by created_at asc limit 1;
  if v_default_bid is not null then
    update public.profiles
    set business_id = v_default_bid
    where role in ('admin', 'kasir') and business_id is null;
  end if;
end;
$$;

-- ==============================================================================
-- 4. Helper Function: current_business_id()
-- ==============================================================================
create or replace function public.current_business_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select p.business_id from public.profiles p where p.id = auth.uid() and p.approval_status = 'approved'),
    (select b.id from public.businesses b join public.profiles p on p.id = b.owner_id where b.owner_id = auth.uid() and p.approval_status = 'approved' order by b.created_at asc limit 1)
  );
$$;

revoke all on function public.current_business_id() from public, anon;
grant execute on function public.current_business_id() to authenticated;

-- ==============================================================================
-- 5. Add business_id to All Operational Tables & Backfill
-- ==============================================================================

-- 5.1 categories
alter table public.categories
  add column if not exists business_id uuid references public.businesses(id) on delete cascade;
create index if not exists idx_categories_business_id on public.categories(business_id);

update public.categories c
set business_id = (select id from public.businesses order by created_at asc limit 1)
where c.business_id is null;

alter table public.categories drop constraint if exists categories_name_key;
alter table public.categories drop constraint if exists categories_business_name_key;
alter table public.categories add constraint categories_business_name_key unique (business_id, name);

-- 5.2 products
alter table public.products
  add column if not exists business_id uuid references public.businesses(id) on delete cascade;
create index if not exists idx_products_business_id on public.products(business_id);

update public.products p
set business_id = coalesce(
  (select c.business_id from public.categories c where c.id = p.category_id),
  (select id from public.businesses order by created_at asc limit 1)
)
where p.business_id is null;

alter table public.products drop constraint if exists products_sku_key;
alter table public.products drop constraint if exists products_business_sku_key;
alter table public.products add constraint products_business_sku_key unique (business_id, sku);

-- 5.3 shifts
alter table public.shifts
  add column if not exists business_id uuid references public.businesses(id) on delete cascade;
create index if not exists idx_shifts_business_id on public.shifts(business_id);

update public.shifts s
set business_id = coalesce(
  (select p.business_id from public.profiles p where p.id = s.cashier_id),
  (select id from public.businesses order by created_at asc limit 1)
)
where s.business_id is null;

-- 5.4 sales
alter table public.sales
  add column if not exists business_id uuid references public.businesses(id) on delete cascade;
create index if not exists idx_sales_business_id on public.sales(business_id);

update public.sales s
set business_id = coalesce(
  (select sh.business_id from public.shifts sh where sh.id = s.shift_id),
  (select p.business_id from public.profiles p where p.id = s.cashier_id),
  (select id from public.businesses order by created_at asc limit 1)
)
where s.business_id is null;

-- 5.5 sale_items
alter table public.sale_items
  add column if not exists business_id uuid references public.businesses(id) on delete cascade;
create index if not exists idx_sale_items_business_id on public.sale_items(business_id);

update public.sale_items si
set business_id = coalesce(
  (select s.business_id from public.sales s where s.id = si.sale_id),
  (select p.business_id from public.products p where p.id = si.product_id),
  (select id from public.businesses order by created_at asc limit 1)
)
where si.business_id is null;

-- 5.6 stock_movements
alter table public.stock_movements
  add column if not exists business_id uuid references public.businesses(id) on delete cascade;
create index if not exists idx_stock_movements_business_id on public.stock_movements(business_id);

update public.stock_movements sm
set business_id = coalesce(
  (select p.business_id from public.products p where p.id = sm.product_id),
  (select id from public.businesses order by created_at asc limit 1)
)
where sm.business_id is null;

-- 5.7 expense_categories
alter table public.expense_categories
  add column if not exists business_id uuid references public.businesses(id) on delete cascade;
create index if not exists idx_expense_categories_business_id on public.expense_categories(business_id);

update public.expense_categories ec
set business_id = (select id from public.businesses order by created_at asc limit 1)
where ec.business_id is null;

alter table public.expense_categories drop constraint if exists expense_categories_name_key;
alter table public.expense_categories drop constraint if exists expense_categories_business_name_key;
alter table public.expense_categories add constraint expense_categories_business_name_key unique (business_id, name);

-- 5.8 expenses
alter table public.expenses
  add column if not exists business_id uuid references public.businesses(id) on delete cascade;
create index if not exists idx_expenses_business_id on public.expenses(business_id);

update public.expenses e
set business_id = coalesce(
  (select ec.business_id from public.expense_categories ec where ec.id = e.category_id),
  (select p.business_id from public.profiles p where p.id = e.created_by),
  (select id from public.businesses order by created_at asc limit 1)
)
where e.business_id is null;

-- 5.9 receivables
alter table public.receivables
  add column if not exists business_id uuid references public.businesses(id) on delete cascade;
create index if not exists idx_receivables_business_id on public.receivables(business_id);

update public.receivables r
set business_id = coalesce(
  (select s.business_id from public.sales s where s.id = r.sale_id),
  (select id from public.businesses order by created_at asc limit 1)
)
where r.business_id is null;

-- 5.10 receivable_payments
alter table public.receivable_payments
  add column if not exists business_id uuid references public.businesses(id) on delete cascade;
create index if not exists idx_receivable_payments_business_id on public.receivable_payments(business_id);

update public.receivable_payments rp
set business_id = coalesce(
  (select r.business_id from public.receivables r where r.id = rp.receivable_id),
  (select id from public.businesses order by created_at asc limit 1)
)
where rp.business_id is null;

-- 5.11 checkups
alter table public.checkups
  add column if not exists business_id uuid references public.businesses(id) on delete cascade;
create index if not exists idx_checkups_business_id on public.checkups(business_id);

update public.checkups c
set business_id = coalesce(
  (select p.business_id from public.profiles p where p.id = c.created_by),
  (select id from public.businesses order by created_at asc limit 1)
)
where c.business_id is null;

-- 5.12 audit_logs
alter table public.audit_logs
  add column if not exists business_id uuid references public.businesses(id) on delete cascade;
create index if not exists idx_audit_logs_business_id on public.audit_logs(business_id);

update public.audit_logs a
set business_id = coalesce(
  (select p.business_id from public.profiles p where p.id = a.user_id),
  (select id from public.businesses order by created_at asc limit 1)
)
where a.business_id is null;

-- 5.13 promotions (if table exists)
do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'promotions' and table_schema = 'public') then
    alter table public.promotions add column if not exists business_id uuid references public.businesses(id) on delete cascade;
    create index if not exists idx_promotions_business_id on public.promotions(business_id);
    update public.promotions set business_id = (select id from public.businesses order by created_at asc limit 1) where business_id is null;
  end if;
end;
$$;

-- 5.14 refund_requests (if table exists)
do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'refund_requests' and table_schema = 'public') then
    alter table public.refund_requests add column if not exists business_id uuid references public.businesses(id) on delete cascade;
    create index if not exists idx_refund_requests_business_id on public.refund_requests(business_id);
    update public.refund_requests rr set business_id = coalesce(
      (select s.business_id from public.sales s where s.id = rr.sale_id),
      (select id from public.businesses order by created_at asc limit 1)
    ) where rr.business_id is null;
  end if;
end;
$$;

-- 5.15 supplier_payables and supplier_payments (if tables exist)
do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'supplier_payables' and table_schema = 'public') then
    alter table public.supplier_payables add column if not exists business_id uuid references public.businesses(id) on delete cascade;
    create index if not exists idx_supplier_payables_business_id on public.supplier_payables(business_id);
    update public.supplier_payables set business_id = (select id from public.businesses order by created_at asc limit 1) where business_id is null;
  end if;
  if exists (select 1 from information_schema.tables where table_name = 'supplier_payments' and table_schema = 'public') then
    alter table public.supplier_payments add column if not exists business_id uuid references public.businesses(id) on delete cascade;
    create index if not exists idx_supplier_payments_business_id on public.supplier_payments(business_id);
    update public.supplier_payments sp set business_id = coalesce(
      (select p.business_id from public.supplier_payables p where p.id = sp.supplier_payable_id),
      (select id from public.businesses order by created_at asc limit 1)
    ) where sp.business_id is null;
  end if;
end;
$$;

-- 5.16 debt_categories (if table exists)
do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'debt_categories' and table_schema = 'public') then
    alter table public.debt_categories add column if not exists business_id uuid references public.businesses(id) on delete cascade;
    create index if not exists idx_debt_categories_business_id on public.debt_categories(business_id);
    update public.debt_categories set business_id = (select id from public.businesses order by created_at asc limit 1) where business_id is null;
    alter table public.debt_categories drop constraint if exists debt_categories_name_key;
    alter table public.debt_categories drop constraint if exists debt_categories_business_name_key;
    alter table public.debt_categories add constraint debt_categories_business_name_key unique (business_id, name);
  end if;
end;
$$;

-- 5.17 subscriptions and subscription_payments
alter table public.subscriptions
  add column if not exists business_id uuid references public.businesses(id) on delete cascade;
create index if not exists idx_subscriptions_business_id on public.subscriptions(business_id);

update public.subscriptions s
set business_id = coalesce(
  (select p.business_id from public.profiles p where p.id = s.owner_id),
  (select b.id from public.businesses b where b.owner_id = s.owner_id order by b.created_at asc limit 1)
)
where s.business_id is null;

alter table public.subscription_payments
  add column if not exists business_id uuid references public.businesses(id) on delete cascade;
create index if not exists idx_subscription_payments_business_id on public.subscription_payments(business_id);

update public.subscription_payments sp
set business_id = coalesce(
  (select p.business_id from public.profiles p where p.id = sp.owner_id),
  (select b.id from public.businesses b where b.owner_id = sp.owner_id order by b.created_at asc limit 1)
)
where sp.business_id is null;

-- ==============================================================================
-- 6. Trigger: Automatic Business Creation on Owner Profile Insert
-- ==============================================================================
create or replace function public.handle_owner_business_creation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bid uuid;
begin
  if new.role = 'owner' then
    if new.business_id is null then
      insert into public.businesses (owner_id, name)
      values (new.id, coalesce(nullif(trim(new.full_name), '') || ' Store', 'Toko Fluxa'))
      on conflict (owner_id) do update set name = excluded.name
      returning id into v_bid;

      new.business_id := v_bid;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_owner_business_creation on public.profiles;
create trigger trg_owner_business_creation
  before insert on public.profiles
  for each row execute function public.handle_owner_business_creation();

-- ==============================================================================
-- 7. Trigger: Enforce Strict Multi-Tenant Isolation on Data Mutations
-- ==============================================================================
create or replace function public.enforce_tenant_isolation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_bid uuid;
begin
  -- Bypass for service_role or DB administrative scripts
  if coalesce(auth.role(), '') = 'service_role'
     or session_user in ('postgres', 'supabase_admin') then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  v_current_bid := public.current_business_id();
  if v_current_bid is null and not public.is_super_admin() then
    raise exception 'Akses ditolak: Pengguna tidak terasosiasi dengan bisnis aktif.';
  end if;

  if tg_op = 'INSERT' then
    if new.business_id is null then
      new.business_id := v_current_bid;
    elsif new.business_id <> v_current_bid and not public.is_super_admin() then
      raise exception 'Akses ditolak: Tidak dapat membuat data untuk bisnis lain.';
    end if;
  elsif tg_op = 'UPDATE' then
    if old.business_id is distinct from new.business_id and not public.is_super_admin() then
      raise exception 'Akses ditolak: Pemindahan tenant tidak diizinkan.';
    end if;
    if old.business_id <> v_current_bid and not public.is_super_admin() then
      raise exception 'Akses ditolak: Tidak dapat memperbarui data milik bisnis lain.';
    end if;
  elsif tg_op = 'DELETE' then
    if old.business_id <> v_current_bid and not public.is_super_admin() then
      raise exception 'Akses ditolak: Tidak dapat menghapus data milik bisnis lain.';
    end if;
    return old;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_tenant_isolation() from public, anon, authenticated;

-- Attach tenant enforcement trigger to operational tables
do $$
declare
  t text;
begin
  foreach t in array array[
    'categories',
    'products',
    'shifts',
    'sales',
    'sale_items',
    'stock_movements',
    'expense_categories',
    'expenses',
    'receivables',
    'receivable_payments',
    'checkups',
    'audit_logs'
  ]
  loop
    execute format('drop trigger if exists trg_tenant_isolation on public.%I', t);
    execute format(
      'create trigger trg_tenant_isolation before insert or update or delete on public.%I for each row execute function public.enforce_tenant_isolation()',
      t
    );
  end loop;
end;
$$;

-- ==============================================================================
-- 8. Strengthen guard_profile_role_change to Prevent Tenant Spoofing
-- ==============================================================================
create or replace function public.guard_profile_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_role text;
  v_actor_bid uuid;
begin
  if coalesce(auth.role(), '') = 'service_role'
    or session_user in ('postgres', 'supabase_admin') then
    return new;
  end if;

  -- Prevent staff from changing their own business assignment
  if old.business_id is distinct from new.business_id and not public.is_super_admin() then
    raise exception 'Akses ditolak: Perubahan penugasan bisnis hanya diizinkan oleh sistem atau Super Admin.';
  end if;

  if old.role is not distinct from new.role then
    return new;
  end if;

  v_actor_role := public.current_role();
  v_actor_bid := public.current_business_id();

  if v_actor_role is null
    or v_actor_role not in ('admin', 'owner')
    or old.role = 'super_admin'
    or new.role = 'super_admin' then
    raise exception 'Akses ditolak: Perubahan role tidak diizinkan.';
  end if;

  -- Ensure actor can only manage staff of their own business
  if not public.is_super_admin() and (old.business_id is distinct from v_actor_bid) then
    raise exception 'Akses ditolak: Tidak dapat mengelola peran staf di luar bisnis Anda.';
  end if;

  if v_actor_role = 'admin'
    and (old.role <> 'kasir' or new.role <> 'kasir') then
    raise exception 'Admin hanya dapat mengelola role Kasir.';
  end if;

  if new.role not in ('kasir', 'admin', 'owner') then
    raise exception 'Role tujuan tidak valid.';
  end if;

  return new;
end;
$$;

-- ==============================================================================
-- 9. Re-define Transactional RPCs with Strict Tenant Verification
-- ==============================================================================

-- Drop existing functions first so PostgreSQL allows return type / signature adjustments
drop function if exists public.open_shift(integer, text);
drop function if exists public.close_shift(uuid, integer, text);
drop function if exists public.create_sale(uuid, text, integer, jsonb);
drop function if exists public.void_sale(uuid, text);
drop function if exists public.adjust_stock(uuid, text, integer, text);
drop function if exists public.record_business_debt_payment(uuid, integer, text, text);
drop function if exists public.record_business_debt_payment(uuid, integer, text);

-- 9.1 open_shift
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
  v_business_id uuid;
  v_existing_shift uuid;
  v_shift_id uuid;
begin
  v_cashier_id := auth.uid();
  if v_cashier_id is null then
    raise exception 'Harus login untuk membuka shift.';
  end if;

  v_business_id := public.current_business_id();
  if v_business_id is null then
    raise exception 'Akun belum terasosiasi dengan bisnis aktif.';
  end if;

  select id into v_existing_shift
  from public.shifts
  where cashier_id = v_cashier_id and business_id = v_business_id and status = 'open'
  limit 1;

  if v_existing_shift is not null then
    raise exception 'Anda masih memiliki shift yang aktif (ID: %). Tutup shift lama terlebih dahulu.', v_existing_shift;
  end if;

  insert into public.shifts (cashier_id, business_id, initial_cash, note, status)
  values (v_cashier_id, v_business_id, greatest(0, p_initial_cash), p_note, 'open')
  returning id into v_shift_id;

  return v_shift_id;
end;
$$;

-- 9.2 close_shift
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
  v_business_id uuid;
begin
  v_business_id := public.current_business_id();

  select * into v_shift from public.shifts where id = p_shift_id;
  if not found then
    raise exception 'Shift tidak ditemukan.';
  end if;

  if v_shift.business_id <> v_business_id and not public.is_super_admin() then
    raise exception 'Akses ditolak: Shift ini milik bisnis lain.';
  end if;

  if v_shift.status = 'closed' then
    raise exception 'Shift ini sudah ditutup sebelumnya.';
  end if;

  if v_shift.cashier_id != auth.uid() and not public.is_admin_or_owner() then
    raise exception 'Akses ditolak: Anda tidak memiliki akses untuk menutup shift ini.';
  end if;

  select coalesce(sum(final_amount), 0) into v_cash_sales
  from public.sales
  where shift_id = p_shift_id
    and business_id = v_shift.business_id
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

-- 9.3 create_sale
create or replace function public.create_sale(
  p_shift_id uuid,
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
  v_business_id uuid;
  v_sale_id uuid;
  v_invoice_number text;
  v_shift public.shifts%rowtype;
  v_total_amount integer := 0;
  v_final_amount integer := 0;
  v_discount integer := coalesce(p_discount, 0);
  v_item record;
  v_product public.products%rowtype;
  v_subtotal integer;
begin
  v_cashier_id := auth.uid();
  if v_cashier_id is null then
    raise exception 'Pengguna harus login untuk memproses transaksi.';
  end if;

  v_business_id := public.current_business_id();
  if v_business_id is null then
    raise exception 'Pengguna tidak terasosiasi dengan bisnis aktif.';
  end if;

  select * into v_shift from public.shifts where id = p_shift_id;
  if not found or v_shift.status != 'open' then
    raise exception 'Shift tidak valid atau sudah ditutup.';
  end if;

  if v_shift.business_id <> v_business_id and not public.is_super_admin() then
    raise exception 'Akses ditolak: Shift ini milik bisnis lain.';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'Keranjang belanja tidak boleh kosong.';
  end if;

  if p_payment_method not in ('cash', 'non_cash') then
    raise exception 'Metode pembayaran tidak valid.';
  end if;

  v_invoice_number := 'TRKFLX-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(md5(random()::text), 1, 6));

  insert into public.sales (
    invoice_number,
    shift_id,
    cashier_id,
    business_id,
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
    v_business_id,
    0,
    v_discount,
    0,
    p_payment_method,
    'paid',
    'completed'
  ) returning id into v_sale_id;

  for v_item in select * from jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer)
  loop
    if v_item.quantity <= 0 then
      raise exception 'Jumlah barang harus lebih besar dari 0.';
    end if;

    select * into v_product from public.products where id = v_item.product_id for update;
    if not found then
      raise exception 'Produk ID % tidak ditemukan.', v_item.product_id;
    end if;

    -- Strict check: product MUST belong to the same business!
    if v_product.business_id <> v_business_id and not public.is_super_admin() then
      raise exception 'Akses ditolak: Produk % bukan milik bisnis Anda.', v_product.name;
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

    insert into public.sale_items (
      sale_id,
      product_id,
      business_id,
      quantity,
      unit_price,
      buy_price,
      subtotal
    ) values (
      v_sale_id,
      v_product.id,
      v_business_id,
      v_item.quantity,
      v_product.sell_price,
      v_product.buy_price,
      v_subtotal
    );

    update public.products
    set stock = stock - v_item.quantity
    where id = v_product.id;

    insert into public.stock_movements (
      product_id,
      business_id,
      type,
      quantity,
      previous_stock,
      current_stock,
      reference_id,
      note,
      created_by
    ) values (
      v_product.id,
      v_business_id,
      'sale',
      -v_item.quantity,
      v_product.stock,
      v_product.stock - v_item.quantity,
      v_sale_id,
      'Penjualan invoice ' || v_invoice_number,
      v_cashier_id
    );
  end loop;

  v_final_amount := greatest(0, v_total_amount - v_discount);

  update public.sales
  set total_amount = v_total_amount,
      final_amount = v_final_amount
  where id = v_sale_id;

  return v_sale_id;
end;
$$;

-- 9.4 void_sale
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
  v_business_id uuid;
  v_user_id uuid;
begin
  v_user_id := auth.uid();
  v_business_id := public.current_business_id();

  select * into v_sale from public.sales where id = p_sale_id for update;
  if not found then
    raise exception 'Transaksi penjualan tidak ditemukan.';
  end if;

  if v_sale.business_id <> v_business_id and not public.is_super_admin() then
    raise exception 'Akses ditolak: Transaksi ini milik bisnis lain.';
  end if;

  if v_sale.status = 'voided' then
    raise exception 'Transaksi ini sudah divoid sebelumnya.';
  end if;

  if not public.is_admin_or_owner() then
    raise exception 'Akses ditolak: Hanya Admin atau Owner yang dapat melakukan void transaksi.';
  end if;

  if p_reason is null or trim(p_reason) = '' then
    raise exception 'Alasan pembatalan (void) wajib diisi.';
  end if;

  for v_item in
    select product_id, quantity from public.sale_items where sale_id = p_sale_id
  loop
    select * into v_product from public.products where id = v_item.product_id for update;

    update public.products
    set stock = stock + v_item.quantity
    where id = v_item.product_id;

    insert into public.stock_movements (
      product_id,
      business_id,
      type,
      quantity,
      previous_stock,
      current_stock,
      reference_id,
      note,
      created_by
    )
    values (
      v_item.product_id,
      v_sale.business_id,
      'void_return',
      v_item.quantity,
      v_product.stock,
      v_product.stock + v_item.quantity,
      p_sale_id,
      'Void invoice ' || v_sale.invoice_number || ': ' || coalesce(p_reason, 'Tanpa alasan'),
      v_user_id
    );
  end loop;

  -- Jika sebelumnya transaksi kredit, batalkan piutangnya
  delete from public.receivables where sale_id = p_sale_id;

  update public.sales
  set status = 'voided',
      void_reason = p_reason,
      voided_at = now(),
      voided_by = v_user_id
  where id = p_sale_id;

  -- Catat ke audit log
  insert into public.audit_logs (
    business_id,
    user_id,
    action,
    table_name,
    record_id,
    old_data,
    new_data
  ) values (
    v_sale.business_id,
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

-- 9.5 adjust_stock
create or replace function public.adjust_stock(
  p_product_id uuid,
  p_type text,
  p_quantity integer,
  p_note text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product public.products%rowtype;
  v_new_stock integer;
  v_business_id uuid;
  v_effective_quantity integer;
begin
  if not public.is_admin_or_owner() then
    raise exception 'Akses ditolak: Hanya Admin atau Owner yang dapat menyesuaikan stok.';
  end if;

  v_business_id := public.current_business_id();

  select * into v_product from public.products where id = p_product_id for update;
  if not found then
    raise exception 'Produk tidak ditemukan.';
  end if;

  if v_product.business_id <> v_business_id and not public.is_super_admin() then
    raise exception 'Akses ditolak: Produk ini milik bisnis lain.';
  end if;

  if p_type = 'in' then
    if p_quantity <= 0 then raise exception 'Jumlah stok masuk harus lebih dari 0.'; end if;
    v_new_stock := v_product.stock + p_quantity;
    v_effective_quantity := p_quantity;
  elsif p_type = 'out' then
    if p_quantity <= 0 then raise exception 'Jumlah stok keluar harus lebih dari 0.'; end if;
    if v_product.stock < p_quantity then raise exception 'Stok tidak mencukupi.'; end if;
    v_new_stock := v_product.stock - p_quantity;
    v_effective_quantity := -p_quantity;
  elsif p_type = 'adjustment' then
    if p_quantity < 0 then raise exception 'Nilai penyesuaian stok akhir tidak boleh negatif.'; end if;
    v_new_stock := p_quantity;
    v_effective_quantity := v_new_stock - v_product.stock;
  else
    raise exception 'Tipe pergerakan stok tidak valid.';
  end if;

  update public.products set stock = v_new_stock where id = p_product_id;

  insert into public.stock_movements (
    product_id,
    business_id,
    type,
    quantity,
    previous_stock,
    current_stock,
    note,
    created_by
  ) values (
    p_product_id,
    v_product.business_id,
    p_type,
    v_effective_quantity,
    v_product.stock,
    v_new_stock,
    p_note,
    auth.uid()
  );

  insert into public.audit_logs (
    business_id,
    user_id,
    action,
    table_name,
    record_id,
    old_data,
    new_data
  ) values (
    v_product.business_id,
    auth.uid(),
    'ADJUST_STOCK',
    'products',
    p_product_id,
    jsonb_build_object(
      'product_id', v_product.id,
      'previous_stock', v_product.stock,
      'type', p_type,
      'quantity', p_quantity,
      'note', p_note
    ),
    jsonb_build_object(
      'product_id', p_product_id,
      'new_stock', v_new_stock,
      'type', p_type,
      'quantity', v_effective_quantity,
      'note', coalesce(p_note, 'Perubahan stok via adjust_stock()')
    )
  );

  return v_new_stock;
end;
$$;

-- 9.6 record_business_debt_payment
create or replace function public.record_business_debt_payment(
  p_receivable_id uuid,
  p_amount integer,
  p_payment_method text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_receivable public.receivables%rowtype;
  v_new_paid integer;
  v_new_status text;
  v_business_id uuid;
begin
  if not public.is_admin_or_owner() then
    raise exception 'Akses ditolak: Hanya Admin atau Owner yang dapat mencatat pembayaran piutang.';
  end if;

  v_business_id := public.current_business_id();

  select * into v_receivable from public.receivables where id = p_receivable_id for update;
  if not found then
    raise exception 'Data piutang tidak ditemukan.';
  end if;

  if v_receivable.business_id <> v_business_id and not public.is_super_admin() then
    raise exception 'Akses ditolak: Piutang ini milik bisnis lain.';
  end if;

  if p_amount <= 0 then
    raise exception 'Nominal pembayaran harus lebih besar dari 0.';
  end if;

  v_new_paid := v_receivable.paid_amount + p_amount;
  if v_new_paid > v_receivable.total_amount then
    raise exception 'Nominal melebihi sisa tagihan piutang (Sisa: %).', (v_receivable.total_amount - v_receivable.paid_amount);
  end if;

  v_new_status := case
    when v_new_paid >= v_receivable.total_amount then 'paid'
    else 'partial'
  end;

  update public.receivables
  set paid_amount = v_new_paid,
      status = v_new_status,
      updated_at = now()
  where id = p_receivable_id;

  insert into public.receivable_payments (
    receivable_id,
    business_id,
    amount,
    payment_method,
    note,
    created_by
  ) values (
    p_receivable_id,
    v_receivable.business_id,
    p_amount,
    p_payment_method,
    p_note,
    auth.uid()
  );

  return jsonb_build_object(
    'receivable_id', p_receivable_id,
    'paid_amount', v_new_paid,
    'remaining_amount', (v_receivable.total_amount - v_new_paid),
    'status', v_new_status
  );
end;
$$;

-- Re-grant execute to authenticated on RPC functions
grant execute on function public.open_shift(integer, text) to authenticated;
grant execute on function public.close_shift(uuid, integer, text) to authenticated;
grant execute on function public.create_sale(uuid, text, integer, jsonb) to authenticated;
grant execute on function public.void_sale(uuid, text) to authenticated;
grant execute on function public.adjust_stock(uuid, text, integer, text) to authenticated;
grant execute on function public.record_business_debt_payment(uuid, integer, text, text) to authenticated;

-- ==============================================================================
-- 10. Strict Row Level Security Policies
-- ==============================================================================

-- Drop ALL existing legacy policies on tenant-isolated tables to guarantee clean slate
do $$
declare
  pol record;
begin
  for pol in (
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'businesses', 'profiles', 'categories', 'products', 'shifts',
        'sales', 'sale_items', 'stock_movements', 'expense_categories',
        'expenses', 'receivables', 'receivable_payments', 'checkups',
        'audit_logs', 'promotions', 'refund_requests', 'supplier_payables',
        'supplier_payments', 'debt_categories', 'subscriptions', 'subscription_payments'
      )
  ) loop
    execute format('drop policy if exists %I on %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  end loop;
end $$;

-- 10.1 businesses table
alter table public.businesses enable row level security;

create policy "Tenant dapat melihat bisnis sendiri"
  on public.businesses for select
  to authenticated
  using (
    id = public.current_business_id()
    or owner_id = auth.uid()
    or public.is_super_admin()
  );

create policy "Owner dapat mengedit bisnis sendiri"
  on public.businesses for update
  to authenticated
  using (owner_id = auth.uid() or public.is_super_admin())
  with check (owner_id = auth.uid() or public.is_super_admin());

-- 10.2 profiles table
alter table public.profiles enable row level security;

create policy "Profil dapat dilihat oleh pemilik atau rekan satu bisnis"
  on public.profiles for select
  to authenticated
  using (
    id = auth.uid()
    or (business_id is not null and business_id = public.current_business_id())
    or public.is_super_admin()
  );

create policy "Pengguna dapat mengupdate profil sendiri atau staf sendiri"
  on public.profiles for update
  to authenticated
  using (
    id = auth.uid()
    or (business_id is not null and business_id = public.current_business_id() and public.is_owner())
    or public.is_super_admin()
  )
  with check (
    id = auth.uid()
    or (business_id is not null and business_id = public.current_business_id() and public.is_owner())
    or public.is_super_admin()
  );

-- 10.3 categories
alter table public.categories enable row level security;

create policy "Kategori dapat dibaca oleh staf bisnis"
  on public.categories for select
  to authenticated
  using (business_id = public.current_business_id() or public.is_super_admin());

create policy "Kategori dapat dikelola oleh admin dan owner bisnis"
  on public.categories for all
  to authenticated
  using ((business_id = public.current_business_id() and public.is_admin_or_owner()) or public.is_super_admin())
  with check ((business_id = public.current_business_id() and public.is_admin_or_owner()) or public.is_super_admin());

-- 10.4 products
alter table public.products enable row level security;

create policy "Produk dapat dibaca oleh staf bisnis"
  on public.products for select
  to authenticated
  using (business_id = public.current_business_id() or public.is_super_admin());

create policy "Produk dapat dikelola oleh admin dan owner bisnis"
  on public.products for all
  to authenticated
  using ((business_id = public.current_business_id() and public.is_admin_or_owner()) or public.is_super_admin())
  with check ((business_id = public.current_business_id() and public.is_admin_or_owner()) or public.is_super_admin());

-- 10.5 shifts
alter table public.shifts enable row level security;

create policy "Shifts dapat dibaca oleh kasir pemilik atau staf berwenang bisnis"
  on public.shifts for select
  to authenticated
  using (
    (business_id = public.current_business_id() and (cashier_id = auth.uid() or public.is_admin_or_owner()))
    or public.is_super_admin()
  );

-- 10.6 sales
alter table public.sales enable row level security;

create policy "Sales dapat dibaca oleh kasir pembuat atau staf bisnis"
  on public.sales for select
  to authenticated
  using (
    (business_id = public.current_business_id() and (cashier_id = auth.uid() or public.is_admin_or_owner()))
    or public.is_super_admin()
  );

-- 10.7 sale_items
alter table public.sale_items enable row level security;

create policy "Sale items dapat dibaca oleh staf bisnis"
  on public.sale_items for select
  to authenticated
  using (business_id = public.current_business_id() or public.is_super_admin());

-- 10.8 stock_movements
alter table public.stock_movements enable row level security;

create policy "Pergerakan stok hanya untuk admin dan owner bisnis"
  on public.stock_movements for select
  to authenticated
  using (
    (business_id = public.current_business_id() and public.is_admin_or_owner())
    or public.is_super_admin()
  );

-- 10.9 expense_categories
alter table public.expense_categories enable row level security;

create policy "Kategori biaya hanya untuk admin dan owner bisnis"
  on public.expense_categories for all
  to authenticated
  using ((business_id = public.current_business_id() and public.is_admin_or_owner()) or public.is_super_admin())
  with check ((business_id = public.current_business_id() and public.is_admin_or_owner()) or public.is_super_admin());

-- 10.10 expenses
alter table public.expenses enable row level security;

create policy "Data biaya operasional hanya untuk admin dan owner bisnis"
  on public.expenses for all
  to authenticated
  using ((business_id = public.current_business_id() and public.is_admin_or_owner()) or public.is_super_admin())
  with check ((business_id = public.current_business_id() and public.is_admin_or_owner()) or public.is_super_admin());

-- 10.11 receivables
alter table public.receivables enable row level security;

create policy "Data piutang/kasbon hanya untuk admin dan owner bisnis"
  on public.receivables for all
  to authenticated
  using ((business_id = public.current_business_id() and public.is_admin_or_owner()) or public.is_super_admin())
  with check ((business_id = public.current_business_id() and public.is_admin_or_owner()) or public.is_super_admin());

-- 10.12 receivable_payments
alter table public.receivable_payments enable row level security;

create policy "Pembayaran piutang hanya untuk admin dan owner bisnis"
  on public.receivable_payments for all
  to authenticated
  using ((business_id = public.current_business_id() and public.is_admin_or_owner()) or public.is_super_admin())
  with check ((business_id = public.current_business_id() and public.is_admin_or_owner()) or public.is_super_admin());

-- 10.13 checkups
alter table public.checkups enable row level security;

create policy "Rapor kesehatan bisnis eksklusif untuk owner bisnis"
  on public.checkups for all
  to authenticated
  using ((business_id = public.current_business_id() and public.is_owner()) or public.is_super_admin())
  with check ((business_id = public.current_business_id() and public.is_owner()) or public.is_super_admin());

-- 10.14 audit_logs
alter table public.audit_logs enable row level security;

create policy "Audit log eksklusif untuk owner bisnis"
  on public.audit_logs for select
  to authenticated
  using ((business_id = public.current_business_id() and public.is_owner()) or public.is_super_admin());

-- 10.15 Extended Modules (Promotions, Refunds, Suppliers, Debt Categories)
do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'promotions' and table_schema = 'public') then
    alter table public.promotions enable row level security;
    create policy "Promosi dapat dibaca oleh staf bisnis"
      on public.promotions for select
      to authenticated
      using (business_id = public.current_business_id() or public.is_super_admin());
    create policy "Promosi dapat dikelola oleh admin dan owner bisnis"
      on public.promotions for all
      to authenticated
      using ((business_id = public.current_business_id() and public.is_admin_or_owner()) or public.is_super_admin())
      with check ((business_id = public.current_business_id() and public.is_admin_or_owner()) or public.is_super_admin());
  end if;

  if exists (select 1 from information_schema.tables where table_name = 'refund_requests' and table_schema = 'public') then
    alter table public.refund_requests enable row level security;
    create policy "Refund requests dapat dibaca oleh staf bisnis"
      on public.refund_requests for select
      to authenticated
      using ((business_id = public.current_business_id() and (requested_by = auth.uid() or public.is_admin_or_owner())) or public.is_super_admin());
    create policy "Kasir dapat membuat refund request bisnis"
      on public.refund_requests for insert
      to authenticated
      with check ((business_id = public.current_business_id() and requested_by = auth.uid()) or public.is_super_admin());
    create policy "Admin dan owner dapat mengelola refund request bisnis"
      on public.refund_requests for update
      to authenticated
      using ((business_id = public.current_business_id() and public.is_admin_or_owner()) or public.is_super_admin())
      with check ((business_id = public.current_business_id() and public.is_admin_or_owner()) or public.is_super_admin());
  end if;

  if exists (select 1 from information_schema.tables where table_name = 'supplier_payables' and table_schema = 'public') then
    alter table public.supplier_payables enable row level security;
    create policy "Hutang supplier hanya untuk admin dan owner bisnis"
      on public.supplier_payables for all
      to authenticated
      using ((business_id = public.current_business_id() and public.is_admin_or_owner()) or public.is_super_admin())
      with check ((business_id = public.current_business_id() and public.is_admin_or_owner()) or public.is_super_admin());
  end if;

  if exists (select 1 from information_schema.tables where table_name = 'supplier_payments' and table_schema = 'public') then
    alter table public.supplier_payments enable row level security;
    create policy "Pembayaran hutang supplier hanya untuk admin dan owner bisnis"
      on public.supplier_payments for all
      to authenticated
      using ((business_id = public.current_business_id() and public.is_admin_or_owner()) or public.is_super_admin())
      with check ((business_id = public.current_business_id() and public.is_admin_or_owner()) or public.is_super_admin());
  end if;

  if exists (select 1 from information_schema.tables where table_name = 'debt_categories' and table_schema = 'public') then
    alter table public.debt_categories enable row level security;
    create policy "Kategori hutang piutang dapat dibaca staf bisnis"
      on public.debt_categories for select
      to authenticated
      using (business_id = public.current_business_id() or public.is_super_admin());
    create policy "Kategori hutang piutang dapat dikelola admin dan owner bisnis"
      on public.debt_categories for all
      to authenticated
      using ((business_id = public.current_business_id() and public.is_admin_or_owner()) or public.is_super_admin())
      with check ((business_id = public.current_business_id() and public.is_admin_or_owner()) or public.is_super_admin());
  end if;
end $$;

-- 10.16 Subscriptions & Subscription Payments
alter table public.subscriptions enable row level security;
create policy "Subscriptions dapat diakses oleh owner terkait atau super admin"
  on public.subscriptions for select
  to authenticated
  using (owner_id = auth.uid() or public.is_super_admin());

alter table public.subscription_payments enable row level security;
create policy "Subscription payments dapat diakses oleh owner terkait atau super admin"
  on public.subscription_payments for select
  to authenticated
  using (owner_id = auth.uid() or public.is_super_admin());

notify pgrst, 'reload schema';

