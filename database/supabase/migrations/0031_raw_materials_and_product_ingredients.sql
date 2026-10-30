-- ==============================================================================
-- 0030_raw_materials_and_product_ingredients.sql
-- Manajemen Bahan Baku (Raw Materials) & Resep Produk (Bill of Materials)
-- Termasuk Bahan Olahan / Setengah Jadi (Semi-Finished Goods / Bumbu Basah)
-- Multi-tenant isolation & Otomasi Pemantauan Stok Bahan Baku serta Restock Alert
-- ==============================================================================

-- 1. Tabel Bahan Baku (raw_materials)
create table if not exists public.raw_materials (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  sku text,
  material_type text not null default 'raw' check (material_type in ('raw', 'semi_finished')),
  stock numeric(12,2) not null default 0 check (stock >= 0),
  min_stock numeric(12,2) not null default 10 check (min_stock >= 0),
  unit text not null default 'gram',
  cost_per_unit numeric(12,2) not null default 0 check (cost_per_unit >= 0),
  batch_yield numeric(12,2) default 1000 check (batch_yield is null or batch_yield > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint raw_materials_business_name_key unique (business_id, name)
);

create index if not exists idx_raw_materials_business_id on public.raw_materials(business_id);
create index if not exists idx_raw_materials_stock on public.raw_materials(stock, min_stock);
create index if not exists idx_raw_materials_type on public.raw_materials(material_type);

-- 2. Tabel Resep Produk Jadi (product_ingredients)
create table if not exists public.product_ingredients (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  raw_material_id uuid not null references public.raw_materials(id) on delete cascade,
  quantity numeric(12,2) not null check (quantity > 0),
  unit text not null default 'gram',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_ingredients_product_material_key unique (product_id, raw_material_id)
);

create index if not exists idx_product_ingredients_business_id on public.product_ingredients(business_id);
create index if not exists idx_product_ingredients_product_id on public.product_ingredients(product_id);
create index if not exists idx_product_ingredients_raw_material_id on public.product_ingredients(raw_material_id);

-- 3. Tabel Sub-Resep Bahan Olahan / Bumbu Basah (raw_material_sub_ingredients)
-- Misal: Bumbu Kuning (parent) memerlukan Kunyit, Bawang Merah, Bawang Putih, Kemiri (sub)
create table if not exists public.raw_material_sub_ingredients (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  parent_material_id uuid not null references public.raw_materials(id) on delete cascade,
  sub_material_id uuid not null references public.raw_materials(id) on delete cascade,
  quantity numeric(12,2) not null check (quantity > 0),
  unit text not null default 'gram',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint raw_material_sub_ingredients_parent_sub_key unique (parent_material_id, sub_material_id),
  constraint raw_material_no_self_reference check (parent_material_id <> sub_material_id)
);

create index if not exists idx_raw_material_sub_business_id on public.raw_material_sub_ingredients(business_id);
create index if not exists idx_raw_material_sub_parent on public.raw_material_sub_ingredients(parent_material_id);
create index if not exists idx_raw_material_sub_material on public.raw_material_sub_ingredients(sub_material_id);

-- 4. Tabel Riwayat Mutasi Bahan Baku (raw_material_movements)
create table if not exists public.raw_material_movements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  raw_material_id uuid not null references public.raw_materials(id) on delete cascade,
  type text not null check (type in ('in', 'out', 'adjustment', 'sale_usage', 'void_return', 'production')),
  quantity numeric(12,2) not null,
  previous_stock numeric(12,2) not null,
  current_stock numeric(12,2) not null,
  reference_id uuid,
  note text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_raw_material_movements_business_id on public.raw_material_movements(business_id);
create index if not exists idx_raw_material_movements_material on public.raw_material_movements(raw_material_id);
create index if not exists idx_raw_material_movements_created_at on public.raw_material_movements(created_at desc);

-- 5. Triggers (updated_at & Tenant Isolation)
drop trigger if exists update_raw_materials_updated_at on public.raw_materials;
create trigger update_raw_materials_updated_at
  before update on public.raw_materials
  for each row execute function public.update_updated_at_column();

drop trigger if exists update_product_ingredients_updated_at on public.product_ingredients;
create trigger update_product_ingredients_updated_at
  before update on public.product_ingredients
  for each row execute function public.update_updated_at_column();

drop trigger if exists update_raw_material_sub_ingredients_updated_at on public.raw_material_sub_ingredients;
create trigger update_raw_material_sub_ingredients_updated_at
  before update on public.raw_material_sub_ingredients
  for each row execute function public.update_updated_at_column();

-- Attach tenant isolation trigger
do $$
declare
  t text;
begin
  foreach t in array array['raw_materials', 'product_ingredients', 'raw_material_sub_ingredients', 'raw_material_movements']
  loop
    execute format('drop trigger if exists trg_tenant_isolation on public.%I', t);
    execute format(
      'create trigger trg_tenant_isolation before insert or update or delete on public.%I for each row execute function public.enforce_tenant_isolation()',
      t
    );
  end loop;
end;
$$;

-- 6. Row Level Security (RLS)
alter table public.raw_materials enable row level security;
alter table public.product_ingredients enable row level security;
alter table public.raw_material_sub_ingredients enable row level security;
alter table public.raw_material_movements enable row level security;

-- Policies for raw_materials
drop policy if exists "Bahan baku dapat dibaca oleh staf bisnis" on public.raw_materials;
create policy "Bahan baku dapat dibaca oleh staf bisnis"
  on public.raw_materials for select
  to authenticated
  using (business_id = public.current_business_id() or public.is_super_admin());

drop policy if exists "Bahan baku dapat dikelola oleh admin dan owner bisnis" on public.raw_materials;
create policy "Bahan baku dapat dikelola oleh admin dan owner bisnis"
  on public.raw_materials for all
  to authenticated
  using ((business_id = public.current_business_id() and public.is_admin_or_owner()) or public.is_super_admin())
  with check ((business_id = public.current_business_id() and public.is_admin_or_owner()) or public.is_super_admin());

-- Policies for product_ingredients
drop policy if exists "Resep produk dapat dibaca oleh staf bisnis" on public.product_ingredients;
create policy "Resep produk dapat dibaca oleh staf bisnis"
  on public.product_ingredients for select
  to authenticated
  using (business_id = public.current_business_id() or public.is_super_admin());

drop policy if exists "Resep produk dapat dikelola oleh admin dan owner bisnis" on public.product_ingredients;
create policy "Resep produk dapat dikelola oleh admin dan owner bisnis"
  on public.product_ingredients for all
  to authenticated
  using ((business_id = public.current_business_id() and public.is_admin_or_owner()) or public.is_super_admin())
  with check ((business_id = public.current_business_id() and public.is_admin_or_owner()) or public.is_super_admin());

-- Policies for raw_material_sub_ingredients
drop policy if exists "Sub-resep bahan dapat dibaca oleh staf bisnis" on public.raw_material_sub_ingredients;
create policy "Sub-resep bahan dapat dibaca oleh staf bisnis"
  on public.raw_material_sub_ingredients for select
  to authenticated
  using (business_id = public.current_business_id() or public.is_super_admin());

drop policy if exists "Sub-resep bahan dapat dikelola admin dan owner bisnis" on public.raw_material_sub_ingredients;
create policy "Sub-resep bahan dapat dikelola admin dan owner bisnis"
  on public.raw_material_sub_ingredients for all
  to authenticated
  using ((business_id = public.current_business_id() and public.is_admin_or_owner()) or public.is_super_admin())
  with check ((business_id = public.current_business_id() and public.is_admin_or_owner()) or public.is_super_admin());

-- Policies for raw_material_movements
drop policy if exists "Mutasi bahan baku hanya untuk admin dan owner bisnis" on public.raw_material_movements;
create policy "Mutasi bahan baku hanya untuk admin dan owner bisnis"
  on public.raw_material_movements for select
  to authenticated
  using (
    (business_id = public.current_business_id() and public.is_admin_or_owner())
    or public.is_super_admin()
  );

-- 7. RPC Function: adjust_raw_material_stock
create or replace function public.adjust_raw_material_stock(
  p_raw_material_id uuid,
  p_type text,
  p_quantity numeric,
  p_note text default null
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_material public.raw_materials%rowtype;
  v_new_stock numeric;
  v_user_id uuid;
  v_business_id uuid;
  v_delta numeric;
begin
  v_user_id := auth.uid();
  v_business_id := public.current_business_id();

  if v_user_id is null or v_business_id is null then
    raise exception 'Pengguna harus login dan terasosiasi dengan bisnis.';
  end if;

  if not public.is_admin_or_owner() then
    raise exception 'Akses ditolak: Hanya Admin atau Owner yang dapat menyesuaikan stok bahan baku.';
  end if;

  if p_quantity is null or p_quantity < 0 then
    raise exception 'Jumlah takaran stok harus angka positif.';
  end if;

  if p_type not in ('in', 'out', 'adjustment') then
    raise exception 'Tipe penyesuaian tidak valid. Gunakan: in, out, atau adjustment.';
  end if;

  select * into v_material
  from public.raw_materials
  where id = p_raw_material_id
  for update;

  if not found then
    raise exception 'Bahan baku tidak ditemukan.';
  end if;

  if v_material.business_id <> v_business_id and not public.is_super_admin() then
    raise exception 'Akses ditolak: Bahan baku bukan milik bisnis Anda.';
  end if;

  if p_type = 'in' then
    v_new_stock := v_material.stock + p_quantity;
    v_delta := p_quantity;
  elsif p_type = 'out' then
    if v_material.stock < p_quantity then
      raise exception 'Stok tidak mencukupi (sisa: % %, diminta keluar: % %).',
        v_material.stock, v_material.unit, p_quantity, v_material.unit;
    end if;
    v_new_stock := v_material.stock - p_quantity;
    v_delta := -p_quantity;
  elsif p_type = 'adjustment' then
    v_new_stock := p_quantity;
    v_delta := p_quantity - v_material.stock;
  end if;

  update public.raw_materials
  set stock = v_new_stock,
      updated_at = now()
  where id = p_raw_material_id;

  insert into public.raw_material_movements (
    raw_material_id,
    business_id,
    type,
    quantity,
    previous_stock,
    current_stock,
    note,
    created_by
  ) values (
    p_raw_material_id,
    v_business_id,
    p_type,
    v_delta,
    v_material.stock,
    v_new_stock,
    coalesce(p_note, case 
      when p_type = 'in' then 'Restock bahan baku masuk'
      when p_type = 'out' then 'Pengeluaran / penyusutan bahan baku'
      else 'Koreksi stok opname bahan baku'
    end),
    v_user_id
  );

  return v_new_stock;
end;
$$;

revoke all on function public.adjust_raw_material_stock(uuid, text, numeric, text) from public, anon;
grant execute on function public.adjust_raw_material_stock(uuid, text, numeric, text) to authenticated;

-- 8. RPC Function: produce_semi_finished_material
-- Digunakan untuk memproduksi Bumbu Olahan / Bahan Setengah Jadi (misal 1000g Bumbu Kuning)
-- Mengurangi stok rempah-rempah penyusunnya dan menambah stok Bumbu Kuning
create or replace function public.produce_semi_finished_material(
  p_material_id uuid,
  p_produced_quantity numeric,
  p_note text default null
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent public.raw_materials%rowtype;
  v_sub record;
  v_sub_mat public.raw_materials%rowtype;
  v_needed_qty numeric;
  v_batch_ratio numeric;
  v_total_batch_cost numeric := 0;
  v_unit_cost numeric;
  v_user_id uuid;
  v_business_id uuid;
  v_new_stock numeric;
begin
  v_user_id := auth.uid();
  v_business_id := public.current_business_id();

  if v_user_id is null or v_business_id is null then
    raise exception 'Pengguna harus login dan terasosiasi dengan bisnis.';
  end if;

  if not public.is_admin_or_owner() then
    raise exception 'Akses ditolak: Hanya Admin atau Owner yang dapat memproduksi bahan olahan.';
  end if;

  if p_produced_quantity is null or p_produced_quantity <= 0 then
    raise exception 'Jumlah produksi harus lebih besar dari 0.';
  end if;

  select * into v_parent
  from public.raw_materials
  where id = p_material_id for update;

  if not found then
    raise exception 'Bahan olahan tidak ditemukan.';
  end if;

  if v_parent.business_id <> v_business_id and not public.is_super_admin() then
    raise exception 'Akses ditolak: Bahan bukan milik bisnis Anda.';
  end if;

  if v_parent.material_type <> 'semi_finished' then
    raise exception 'Hanya bahan tipe olahan/setengah jadi yang dapat diproduksi melalui sub-resep.';
  end if;

  -- Hitung rasio terhadap 1 batch standar (default yield)
  v_batch_ratio := p_produced_quantity / coalesce(nullif(v_parent.batch_yield, 0), 1000);

  -- Periksa ketersediaan seluruh sub-bahan terlebih dahulu
  for v_sub in
    select sub_material_id, quantity
    from public.raw_material_sub_ingredients
    where parent_material_id = p_material_id
  loop
    v_needed_qty := v_sub.quantity * v_batch_ratio;

    select * into v_sub_mat
    from public.raw_materials
    where id = v_sub.sub_material_id for update;

    if not found then
      raise exception 'Bahan rempah penyusun tidak ditemukan.';
    end if;

    if v_sub_mat.stock < v_needed_qty then
      raise exception 'Stok bahan rempah "%" tidak mencukupi untuk membuat % % % (sisa: % %, butuh: % %).',
        v_sub_mat.name, p_produced_quantity, v_parent.unit, v_parent.name,
        v_sub_mat.stock, v_sub_mat.unit, v_needed_qty, v_sub_mat.unit;
    end if;
  end loop;

  -- Kurangi stok setiap rempah-rempah dan hitung biaya modal aktual
  for v_sub in
    select sub_material_id, quantity
    from public.raw_material_sub_ingredients
    where parent_material_id = p_material_id
  loop
    v_needed_qty := v_sub.quantity * v_batch_ratio;

    select * into v_sub_mat
    from public.raw_materials
    where id = v_sub.sub_material_id;

    v_total_batch_cost := v_total_batch_cost + (v_needed_qty * v_sub_mat.cost_per_unit);

    update public.raw_materials
    set stock = stock - v_needed_qty,
        updated_at = now()
    where id = v_sub_mat.id;

    insert into public.raw_material_movements (
      raw_material_id,
      business_id,
      type,
      quantity,
      previous_stock,
      current_stock,
      reference_id,
      note,
      created_by
    ) values (
      v_sub_mat.id,
      v_business_id,
      'production',
      -v_needed_qty,
      v_sub_mat.stock,
      v_sub_mat.stock - v_needed_qty,
      v_parent.id,
      'Pembuatan bumbu olahan: ' || v_parent.name || ' (' || p_produced_quantity || ' ' || v_parent.unit || ')',
      v_user_id
    );
  end loop;

  -- Hitung HPP per unit bumbu olahan hasil produksi
  if p_produced_quantity > 0 and v_total_batch_cost > 0 then
    v_unit_cost := round(v_total_batch_cost / p_produced_quantity, 2);
  else
    v_unit_cost := v_parent.cost_per_unit;
  end if;

  v_new_stock := v_parent.stock + p_produced_quantity;

  -- Tambah stok Bumbu Olahan & update HPP per unit
  update public.raw_materials
  set stock = v_new_stock,
      cost_per_unit = v_unit_cost,
      updated_at = now()
  where id = v_parent.id;

  insert into public.raw_material_movements (
    raw_material_id,
    business_id,
    type,
    quantity,
    previous_stock,
    current_stock,
    reference_id,
    note,
    created_by
  ) values (
    v_parent.id,
    v_business_id,
    'production',
    p_produced_quantity,
    v_parent.stock,
    v_new_stock,
    null,
    coalesce(p_note, 'Hasil olahan/produksi bumbu basah: +' || p_produced_quantity || ' ' || v_parent.unit),
    v_user_id
  );

  return v_new_stock;
end;
$$;

revoke all on function public.produce_semi_finished_material(uuid, numeric, text) from public, anon;
grant execute on function public.produce_semi_finished_material(uuid, numeric, text) to authenticated;

-- 9. Update create_sale untuk otomatis memotong stok bahan baku (termasuk bumbu olahan)
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
  v_ingredient record;
  v_raw_mat public.raw_materials%rowtype;
  v_qty_needed numeric;
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

    -- Kurangi stok produk jadi
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

    -- Kurangi stok bahan baku (ingredients) jika produk memiliki resep
    for v_ingredient in
      select raw_material_id, quantity as qty_per_unit
      from public.product_ingredients
      where product_id = v_product.id
    loop
      v_qty_needed := v_ingredient.qty_per_unit * v_item.quantity;

      select * into v_raw_mat
      from public.raw_materials
      where id = v_ingredient.raw_material_id
      for update;

      if found then
        update public.raw_materials
        set stock = greatest(0, stock - v_qty_needed),
            updated_at = now()
        where id = v_raw_mat.id;

        insert into public.raw_material_movements (
          raw_material_id,
          business_id,
          type,
          quantity,
          previous_stock,
          current_stock,
          reference_id,
          note,
          created_by
        ) values (
          v_raw_mat.id,
          v_business_id,
          'sale_usage',
          -v_qty_needed,
          v_raw_mat.stock,
          greatest(0, v_raw_mat.stock - v_qty_needed),
          v_sale_id,
          'Pemakaian bahan untuk invoice ' || v_invoice_number || ' (' || v_product.name || ' x' || v_item.quantity || ')',
          v_cashier_id
        );
      end if;
    end loop;

  end loop;

  v_final_amount := greatest(0, v_total_amount - v_discount);

  update public.sales
  set total_amount = v_total_amount,
      final_amount = v_final_amount
  where id = v_sale_id;

  return v_sale_id;
end;
$$;

-- 10. Update void_sale untuk mengembalikan stok bahan baku
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
  v_ingredient record;
  v_raw_mat public.raw_materials%rowtype;
  v_qty_return numeric;
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

    -- Kembalikan stok bahan baku
    for v_ingredient in
      select raw_material_id, quantity as qty_per_unit
      from public.product_ingredients
      where product_id = v_item.product_id
    loop
      v_qty_return := v_ingredient.qty_per_unit * v_item.quantity;

      select * into v_raw_mat
      from public.raw_materials
      where id = v_ingredient.raw_material_id
      for update;

      if found then
        update public.raw_materials
        set stock = stock + v_qty_return,
            updated_at = now()
        where id = v_raw_mat.id;

        insert into public.raw_material_movements (
          raw_material_id,
          business_id,
          type,
          quantity,
          previous_stock,
          current_stock,
          reference_id,
          note,
          created_by
        ) values (
          v_raw_mat.id,
          v_sale.business_id,
          'void_return',
          v_qty_return,
          v_raw_mat.stock,
          v_raw_mat.stock + v_qty_return,
          p_sale_id,
          'Void return bahan baku dari invoice ' || v_sale.invoice_number,
          v_user_id
        );
      end if;
    end loop;

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

-- 11. View Ringkasan Status Bahan Baku (v_raw_materials_summary)
create or replace view public.v_raw_materials_summary as
select
  rm.id,
  rm.business_id,
  rm.name,
  rm.sku,
  rm.material_type,
  rm.stock,
  rm.min_stock,
  rm.unit,
  rm.cost_per_unit,
  rm.batch_yield,
  case
    when rm.stock = 0 then 'out_of_stock'
    when rm.stock <= rm.min_stock then 'low_stock'
    else 'safe'
  end as stock_status,
  case
    when rm.stock <= rm.min_stock then true
    else false
  end as is_need_restock,
  count(distinct pi.id) as products_count,
  count(distinct rsi.id) as sub_ingredients_count,
  rm.updated_at
from public.raw_materials rm
left join public.product_ingredients pi on pi.raw_material_id = rm.id
left join public.raw_material_sub_ingredients rsi on rsi.parent_material_id = rm.id
group by rm.id, rm.business_id, rm.name, rm.sku, rm.material_type, rm.stock, rm.min_stock, rm.unit, rm.cost_per_unit, rm.batch_yield, rm.updated_at;
