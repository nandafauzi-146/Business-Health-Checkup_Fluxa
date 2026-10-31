-- ==============================================================================
-- 0033_recipe_ratio_unit_conversion_and_availability.sql
-- PRD: Recipe Ratio Calculation, Production Automation, Unit Conversion,
-- and Inventory Availability Integration – POS FLUXA
-- ==============================================================================

-- 1. Tambah kolom densitas (massa jenis g/ml) pada bahan baku untuk konversi silang berat <-> volume
alter table public.raw_materials
add column if not exists density numeric(8,4) default 1.0 check (density > 0);

-- 2. Fungsi Helper Konversi Satuan (Weight, Volume, Cross-Dimensional)
create or replace function public.convert_ingredient_unit(
  p_qty numeric,
  p_from_unit text,
  p_to_unit text,
  p_density numeric default 1.0
)
returns numeric
language plpgsql
immutable
as $$
declare
  v_from text := lower(trim(coalesce(p_from_unit, 'g')));
  v_to text := lower(trim(coalesce(p_to_unit, 'g')));
  v_density numeric := coalesce(nullif(p_density, 0), 1.0);
  v_from_dim text;
  v_to_dim text;
  v_from_mult numeric := 1.0;
  v_to_mult numeric := 1.0;
  v_in_base numeric;
  v_converted numeric;
begin
  if p_qty is null or p_qty = 0 or v_from = v_to then
    return coalesce(p_qty, 0);
  end if;

  -- Normalize from unit
  if v_from in ('g', 'gram', 'gr') then
    v_from_dim := 'weight'; v_from_mult := 1.0;
  elsif v_from in ('kg', 'kilogram') then
    v_from_dim := 'weight'; v_from_mult := 1000.0;
  elsif v_from in ('ml', 'mililiter', 'milliliter') then
    v_from_dim := 'volume'; v_from_mult := 1.0;
  elsif v_from in ('l', 'liter', 'ltr') then
    v_from_dim := 'volume'; v_from_mult := 1000.0;
  else
    v_from_dim := 'other'; v_from_mult := 1.0;
  end if;

  -- Normalize to unit
  if v_to in ('g', 'gram', 'gr') then
    v_to_dim := 'weight'; v_to_mult := 1.0;
  elsif v_to in ('kg', 'kilogram') then
    v_to_dim := 'weight'; v_to_mult := 1000.0;
  elsif v_to in ('ml', 'mililiter', 'milliliter') then
    v_to_dim := 'volume'; v_to_mult := 1.0;
  elsif v_to in ('l', 'liter', 'ltr') then
    v_to_dim := 'volume'; v_to_mult := 1000.0;
  else
    v_to_dim := 'other'; v_to_mult := 1.0;
  end if;

  -- Same dimension
  if v_from_dim = v_to_dim then
    v_in_base := p_qty * v_from_mult;
    return round((v_in_base / v_to_mult)::numeric, 4);
  end if;

  -- Weight to Volume (grams to ml -> ml = grams / density)
  if v_from_dim = 'weight' and v_to_dim = 'volume' then
    v_in_base := (p_qty * v_from_mult) / v_density; -- in ml
    return round((v_in_base / v_to_mult)::numeric, 4);
  end if;

  -- Volume to Weight (ml to grams -> grams = ml * density)
  if v_from_dim = 'volume' and v_to_dim = 'weight' then
    v_in_base := (p_qty * v_from_mult) * v_density; -- in grams
    return round((v_in_base / v_to_mult)::numeric, 4);
  end if;

  return p_qty;
end;
$$;

-- 3. Update produce_semi_finished_material dengan Perhitungan Rasio & Konversi Satuan
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
  v_converted_needed numeric;
  v_batch_ratio numeric;
  v_total_batch_cost numeric := 0;
  v_unit_cost numeric;
  v_user_id uuid;
  v_business_id uuid;
  v_new_stock numeric;
  v_total_recipe_qty numeric := 0;
begin
  v_user_id := auth.uid();
  v_business_id := public.current_business_id();

  if v_user_id is null or v_business_id is null then
    raise exception 'Pengguna harus login dan terasosiasi dengan bisnis.';
  end if;

  if public.current_role() <> 'admin' and not public.is_super_admin() then
    raise exception 'Akses ditolak: Pengelolaan dan produksi bahan olahan hanya dapat dilakukan oleh Admin.';
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

  -- Hitung total komposisi resep untuk dasar rasio (PRD Section 2)
  select coalesce(sum(quantity), 0) into v_total_recipe_qty
  from public.raw_material_sub_ingredients
  where parent_material_id = p_material_id;

  if v_total_recipe_qty <= 0 then
    raise exception 'Bumbu olahan belum memiliki komposisi bahan penyusun.';
  end if;

  -- Hitung rasio terhadap 1 batch standar atau total komposisi resep
  v_batch_ratio := p_produced_quantity / coalesce(nullif(v_parent.batch_yield, 0), v_total_recipe_qty);

  -- 1. Validasi ketersediaan stok seluruh bahan mentah penyusun dengan konversi satuan
  for v_sub in
    select sub_material_id, quantity, unit
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

    -- Konversi takaran resep ke satuan penyimpanan bahan mentah
    v_converted_needed := public.convert_ingredient_unit(
      v_needed_qty,
      v_sub.unit,
      v_sub_mat.unit,
      coalesce(v_sub_mat.density, 1.0)
    );

    if v_sub_mat.stock < v_converted_needed then
      raise exception 'Stok bahan mentah "%" tidak mencukupi untuk membuat % % % (sisa: % %, butuh: % %).',
        v_sub_mat.name, p_produced_quantity, v_parent.unit, v_parent.name,
        v_sub_mat.stock, v_sub_mat.unit, v_converted_needed, v_sub_mat.unit;
    end if;
  end loop;

  -- 2. Kurangi stok setiap rempah penyusun dan hitung HPP aktual
  for v_sub in
    select sub_material_id, quantity, unit
    from public.raw_material_sub_ingredients
    where parent_material_id = p_material_id
  loop
    v_needed_qty := v_sub.quantity * v_batch_ratio;

    select * into v_sub_mat
    from public.raw_materials
    where id = v_sub.sub_material_id;

    v_converted_needed := public.convert_ingredient_unit(
      v_needed_qty,
      v_sub.unit,
      v_sub_mat.unit,
      coalesce(v_sub_mat.density, 1.0)
    );

    v_total_batch_cost := v_total_batch_cost + (v_converted_needed * v_sub_mat.cost_per_unit);

    update public.raw_materials
    set stock = stock - v_converted_needed,
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
      -v_converted_needed,
      v_sub_mat.stock,
      v_sub_mat.stock - v_converted_needed,
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

-- 4. Update adjust_raw_material_stock dengan Perhitungan Rasio & Konversi Satuan
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
  v_added_qty numeric := 0;
  v_batch_ratio numeric;
  v_sub record;
  v_sub_mat public.raw_materials%rowtype;
  v_needed_qty numeric;
  v_converted_needed numeric;
  v_total_recipe_qty numeric := 0;
begin
  v_user_id := auth.uid();
  v_business_id := public.current_business_id();

  if v_user_id is null or v_business_id is null then
    raise exception 'Pengguna harus login dan terasosiasi dengan bisnis.';
  end if;

  if public.current_role() <> 'admin' and not public.is_super_admin() then
    raise exception 'Akses ditolak: Pengelolaan stok bahan baku hanya dapat dilakukan oleh Admin.';
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
    v_added_qty := p_quantity;
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
    if v_delta > 0 then
      v_added_qty := v_delta;
    end if;
  end if;

  -- Jika bahan ini adalah bumbu olahan (semi_finished) dan ada penambahan stok,
  -- kurangi stok bahan mentah/rempah penyusun menggunakan rasio resep dan konversi satuan
  if v_material.material_type = 'semi_finished' and v_added_qty > 0 then
    if exists (
      select 1 from public.raw_material_sub_ingredients
      where parent_material_id = p_raw_material_id
    ) then
      select coalesce(sum(quantity), 0) into v_total_recipe_qty
      from public.raw_material_sub_ingredients
      where parent_material_id = p_raw_material_id;

      v_batch_ratio := v_added_qty / coalesce(nullif(v_material.batch_yield, 0), nullif(v_total_recipe_qty, 0), 1000);

      -- Validasi ketersediaan stok
      for v_sub in
        select sub_material_id, quantity, unit
        from public.raw_material_sub_ingredients
        where parent_material_id = p_raw_material_id
      loop
        v_needed_qty := v_sub.quantity * v_batch_ratio;

        select * into v_sub_mat
        from public.raw_materials
        where id = v_sub.sub_material_id for update;

        if not found then
          raise exception 'Bahan rempah penyusun tidak ditemukan.';
        end if;

        v_converted_needed := public.convert_ingredient_unit(
          v_needed_qty,
          v_sub.unit,
          v_sub_mat.unit,
          coalesce(v_sub_mat.density, 1.0)
        );

        if v_sub_mat.stock < v_converted_needed then
          raise exception 'Stok bahan mentah "%" tidak mencukupi untuk restock bumbu % (sisa: % %, butuh: % %).',
            v_sub_mat.name, v_material.name,
            v_sub_mat.stock, v_sub_mat.unit, v_converted_needed, v_sub_mat.unit;
        end if;
      end loop;

      -- Kurangi stok setiap bahan mentah
      for v_sub in
        select sub_material_id, quantity, unit
        from public.raw_material_sub_ingredients
        where parent_material_id = p_raw_material_id
      loop
        v_needed_qty := v_sub.quantity * v_batch_ratio;

        select * into v_sub_mat
        from public.raw_materials
        where id = v_sub.sub_material_id;

        v_converted_needed := public.convert_ingredient_unit(
          v_needed_qty,
          v_sub.unit,
          v_sub_mat.unit,
          coalesce(v_sub_mat.density, 1.0)
        );

        update public.raw_materials
        set stock = stock - v_converted_needed,
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
          -v_converted_needed,
          v_sub_mat.stock,
          v_sub_mat.stock - v_converted_needed,
          p_raw_material_id,
          'Pemakaian bahan mentah untuk restock bumbu: ' || v_material.name || ' (+' || v_added_qty || ' ' || v_material.unit || ')',
          v_user_id
        );
      end loop;
    end if;
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
      when p_type = 'in' then 'Restock bumbu/bahan masuk'
      when p_type = 'out' then 'Pengeluaran / penyusutan bahan baku'
      else 'Koreksi stok opname bahan baku'
    end),
    v_user_id
  );

  return v_new_stock;
end;
$$;

-- 5. Update create_sale dengan Dukungan Konversi Satuan Bahan Baku
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
  v_converted_needed numeric;
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

    -- Kurangi stok bahan baku resep dengan konversi satuan (PRD Section 4 & 5)
    for v_ingredient in
      select raw_material_id, quantity as qty_per_unit, unit
      from public.product_ingredients
      where product_id = v_product.id
    loop
      v_qty_needed := v_ingredient.qty_per_unit * v_item.quantity;

      select * into v_raw_mat
      from public.raw_materials
      where id = v_ingredient.raw_material_id
      for update;

      if found then
        v_converted_needed := public.convert_ingredient_unit(
          v_qty_needed,
          v_ingredient.unit,
          v_raw_mat.unit,
          coalesce(v_raw_mat.density, 1.0)
        );

        update public.raw_materials
        set stock = greatest(0, stock - v_converted_needed),
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
          -v_converted_needed,
          v_raw_mat.stock,
          greatest(0, v_raw_mat.stock - v_converted_needed),
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

