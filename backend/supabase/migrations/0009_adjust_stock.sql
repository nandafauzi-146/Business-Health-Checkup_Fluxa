-- 0009_adjust_stock.sql
-- Fungsi stok masuk / opname / koreksi stok yang aman dan atomik
-- Sesuai aturan AGENTS.md: mutasi stok harus lewat RPC, bukan UPDATE langsung ke products.

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
  v_user_id uuid;
  v_product public.products%rowtype;
  v_new_stock integer;
  v_effective_quantity integer;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Pengguna harus login untuk mengubah stok.';
  end if;

  if not public.is_admin_or_owner() then
    raise exception 'Akses ditolak: hanya Admin atau Owner yang dapat mengubah stok.';
  end if;

  if p_product_id is null then
    raise exception 'Produk wajib dipilih.';
  end if;

  if p_type not in ('in', 'out', 'adjustment') then
    raise exception 'Tipe perubahan stok tidak valid. Gunakan: in, out, atau adjustment.';
  end if;

  if p_quantity is null or p_quantity = 0 then
    raise exception 'Jumlah perubahan stok wajib diisi dan tidak boleh 0.';
  end if;

  select * into v_product
  from public.products
  where id = p_product_id
  for update;

  if not found then
    raise exception 'Produk tidak ditemukan.';
  end if;

  if p_type = 'in' then
    v_effective_quantity := abs(p_quantity);
    v_new_stock := v_product.stock + v_effective_quantity;

  elsif p_type = 'out' then
    v_effective_quantity := -abs(p_quantity);
    if v_product.stock - abs(p_quantity) < 0 then
      raise exception 'Stok tidak cukup. Stok saat ini %; jumlah yang diminta %.', v_product.stock, abs(p_quantity);
    end if;
    v_new_stock := v_product.stock - abs(p_quantity);

  else
    -- adjustment = perubahan aritmatik langsung
    -- contoh: +12 = penambahan, -3 = pengurangan
    v_effective_quantity := p_quantity;
    if v_product.stock + p_quantity < 0 then
      raise exception 'Koreksi stok menghasilkan nilai negatif. Stok saat ini %, koreksi %.', v_product.stock, p_quantity;
    end if;
    v_new_stock := v_product.stock + p_quantity;
  end if;

  update public.products
  set stock = v_new_stock,
      updated_at = now()
  where id = p_product_id;

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
    p_product_id,
    p_type,
    v_effective_quantity,
    v_product.stock,
    v_new_stock,
    null,
    coalesce(p_note, 'Perubahan stok via adjust_stock()'),
    v_user_id
  );

  insert into public.audit_logs (
    user_id,
    action,
    table_name,
    record_id,
    old_data,
    new_data
  ) values (
    v_user_id,
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
