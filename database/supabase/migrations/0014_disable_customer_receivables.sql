-- ==============================================================================
-- 0014_disable_customer_receivables.sql
-- Menghapus seluruh kasbon & piutang pelanggan.
-- Hutang/piutang dalam sistem ini khusus untuk supplier / bahan baku (0013_supplier_payables).
-- Transaksi kasir hanya menerima pembayaran langsung: cash atau non_cash.
-- ==============================================================================

-- 1. Bersihkan seluruh data piutang pelanggan
delete from public.receivables;

-- 2. Update fungsi create_sale: tolak metode 'credit' (kasbon pelanggan)
create or replace function public.create_sale(
  p_shift_id uuid,
  p_payment_method text,
  p_discount integer,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
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

  -- Kasbon pelanggan dinonaktifkan: hanya tunai atau non-tunai
  if p_payment_method not in ('cash', 'non_cash') then
    raise exception 'Kasbon pelanggan tidak diizinkan. Pembayaran kasir harus lunas via cash atau non_cash.';
  end if;

  -- Buat nomor transaksi: TRKFLX-YYYYMMDD-XXXXX
  v_invoice_number := 'TRKFLX-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(md5(random()::text), 1, 6));

  -- Buat header sales terlebih dahulu (total diupdate setelah hitung item)
  insert into public.sales (
    invoice_number,
    shift_id,
    cashier_id,
    total_amount,
    discount,
    final_amount,
    payment_method,
    status
  ) values (
    v_invoice_number,
    p_shift_id,
    v_cashier_id,
    0,
    v_discount,
    0,
    p_payment_method,
    'completed'
  )
  returning id into v_sale_id;

  -- Iterasi tiap item belanja
  for v_item in
    select
      (value->>'product_id')::uuid as product_id,
      (value->>'quantity')::integer as quantity
    from jsonb_array_elements(p_items)
  loop
    if v_item.quantity <= 0 then
      raise exception 'Jumlah produk harus lebih dari 0.';
    end if;

    -- Kunci baris produk untuk menghindari race condition stok
    select * into v_product
    from public.products
    where id = v_item.product_id and is_active = true
    for update;

    if not found then
      raise exception 'Produk dengan id % tidak ditemukan atau nonaktif.', v_item.product_id;
    end if;

    if v_product.stock < v_item.quantity then
      raise exception 'Stok produk "%" tidak mencukupi (sisa: %, diminta: %).',
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

  return v_sale_id;
end;
$$;
