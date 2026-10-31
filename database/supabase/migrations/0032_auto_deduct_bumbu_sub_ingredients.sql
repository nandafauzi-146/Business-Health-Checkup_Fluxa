-- ==============================================================================
-- 0032_auto_deduct_bumbu_sub_ingredients.sql
-- Otomatisasi pengurangan stok bahan mentah/rempah penyusun saat Bumbu Olahan
-- direstock atau ditambah stoknya melalui penyesuaian stok.
-- ==============================================================================

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

  -- Jika bahan ini adalah bumbu olahan (semi_finished) dan ada penambahan stok (restock in atau opname naik),
  -- otomatis periksa dan kurangi stok bahan mentah/rempah penyusunnya
  if v_material.material_type = 'semi_finished' and v_added_qty > 0 then
    if exists (
      select 1 from public.raw_material_sub_ingredients
      where parent_material_id = p_raw_material_id
    ) then
      v_batch_ratio := v_added_qty / coalesce(nullif(v_material.batch_yield, 0), 1000);

      -- 1. Validasi ketersediaan stok seluruh bahan mentah penyusun
      for v_sub in
        select sub_material_id, quantity
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

        if v_sub_mat.stock < v_needed_qty then
          raise exception 'Stok bahan mentah "%" tidak mencukupi untuk restock bumbu % (sisa: % %, butuh: % %).',
            v_sub_mat.name, v_material.name,
            v_sub_mat.stock, v_sub_mat.unit, v_needed_qty, v_sub_mat.unit;
        end if;
      end loop;

      -- 2. Kurangi stok setiap bahan mentah dan catat riwayat mutasi
      for v_sub in
        select sub_material_id, quantity
        from public.raw_material_sub_ingredients
        where parent_material_id = p_raw_material_id
      loop
        v_needed_qty := v_sub.quantity * v_batch_ratio;

        select * into v_sub_mat
        from public.raw_materials
        where id = v_sub.sub_material_id;

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

revoke all on function public.adjust_raw_material_stock(uuid, text, numeric, text) from public, anon;
grant execute on function public.adjust_raw_material_stock(uuid, text, numeric, text) to authenticated;

