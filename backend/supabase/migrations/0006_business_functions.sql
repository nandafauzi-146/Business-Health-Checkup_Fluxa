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
