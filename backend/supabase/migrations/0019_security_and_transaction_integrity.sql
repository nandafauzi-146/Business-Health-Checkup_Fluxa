
do $$
declare
  v_foreign_key record;
begin
  for v_foreign_key in
    select conrelid::regclass as table_name, conname
    from pg_constraint
    where contype = 'f'
      and confrelid = to_regclass('public.customers')
  loop
    execute format('alter table %s drop constraint %I', v_foreign_key.table_name, v_foreign_key.conname);
  end loop;
end
$$;

alter table if exists public.sales drop column if exists customer_id;
alter table if exists public.receivables drop column if exists customer_id;
drop table if exists public.customers;

drop function if exists public.create_sale(uuid, uuid, text, integer, jsonb);

alter table public.sales
  drop constraint if exists sales_payment_method_check;

update public.sales
set payment_method = 'non_cash'
where payment_method in ('qris', 'transfer');

alter table public.sales
  add constraint sales_payment_method_check
  check (payment_method in ('cash', 'non_cash')) not valid;

alter table if exists public.receivable_payments
  drop constraint if exists receivable_payments_payment_method_check;
update public.receivable_payments
set payment_method = 'non_cash'
where payment_method in ('qris', 'transfer');
alter table if exists public.receivable_payments
  add constraint receivable_payments_payment_method_check
  check (payment_method in ('cash', 'non_cash')) not valid;

alter table if exists public.supplier_payments
  drop constraint if exists supplier_payments_payment_method_check;
update public.supplier_payments
set payment_method = 'non_cash'
where payment_method in ('qris', 'transfer');
alter table if exists public.supplier_payments
  add constraint supplier_payments_payment_method_check
  check (payment_method in ('cash', 'non_cash')) not valid;

create or replace view public.v_daily_sales_summary
with (security_invoker = true)
as
select
  s.created_at::date as sale_date,
  count(s.id)::integer as transaction_count,
  coalesce(sum(s.final_amount), 0)::integer as total_revenue,
  coalesce(sum(case when s.payment_method = 'cash' then s.final_amount else 0 end), 0)::integer as cash_revenue,
  coalesce(sum(case when s.payment_method in ('non_cash', 'qris', 'transfer') then s.final_amount else 0 end), 0)::integer as non_cash_revenue,
  coalesce(sum(case when s.payment_method = 'credit' then s.final_amount else 0 end), 0)::integer as credit_revenue
from public.sales s
where s.status = 'completed'
group by s.created_at::date
order by sale_date desc;

create or replace function public.guard_profile_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_role text;
begin
  if old.role is not distinct from new.role then
    return new;
  end if;

  if coalesce(auth.role(), '') = 'service_role'
    or session_user in ('postgres', 'supabase_admin') then
    return new;
  end if;

  v_actor_role := public.current_role();
  if v_actor_role is null
    or v_actor_role not in ('admin', 'owner')
    or old.role = 'super_admin'
    or new.role = 'super_admin' then
    raise exception 'Akses ditolak: perubahan role ini tidak diizinkan.';
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
  if v_cashier_id is null or not public.is_staff() then
    raise exception 'Akun staf yang disetujui wajib login untuk memproses transaksi.';
  end if;

  if p_shift_id is null then
    raise exception 'Shift aktif wajib dipilih.';
  end if;
  select * into v_shift from public.shifts where id = p_shift_id for update;
  if not found or v_shift.status <> 'open' then
    raise exception 'Shift tidak valid atau sudah ditutup.';
  end if;
  if v_shift.cashier_id <> v_cashier_id and not public.is_admin_or_owner() then
    raise exception 'Akses ditolak: shift bukan milik Anda.';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Keranjang belanja tidak boleh kosong.';
  end if;
  if p_payment_method not in ('cash', 'non_cash') then
    raise exception 'Metode pembayaran tidak valid.';
  end if;
  if v_discount < 0 then
    raise exception 'Diskon tidak boleh bernilai negatif.';
  end if;
  v_invoice_number := 'TRKFLX-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(md5(random()::text), 1, 6));

  insert into public.sales (
    invoice_number, shift_id, cashier_id, total_amount,
    discount, final_amount, payment_method, payment_status, status
  ) values (
    v_invoice_number, p_shift_id, v_cashier_id, 0,
    v_discount, 0, p_payment_method,
    'paid',
    'completed'
  ) returning id into v_sale_id;

  for v_item in
    select * from jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer)
  loop
    if v_item.product_id is null or v_item.quantity is null or v_item.quantity <= 0 then
      raise exception 'Produk dan jumlah barang harus valid.';
    end if;

    select * into v_product
    from public.products
    where id = v_item.product_id
    for update;
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

    insert into public.sale_items (
      sale_id, product_id, quantity, unit_price, buy_price, subtotal
    ) values (
      v_sale_id, v_product.id, v_item.quantity, v_product.sell_price,
      v_product.buy_price, v_subtotal
    );

    update public.products
    set stock = stock - v_item.quantity
    where id = v_product.id;

    insert into public.stock_movements (
      product_id, type, quantity, previous_stock, current_stock,
      reference_id, note, created_by
    ) values (
      v_product.id, 'sale', -v_item.quantity, v_product.stock,
      v_product.stock - v_item.quantity, v_sale_id,
      'Penjualan invoice ' || v_invoice_number, v_cashier_id
    );
  end loop;

  if v_discount > v_total_amount then
    raise exception 'Diskon tidak boleh melebihi subtotal transaksi.';
  end if;

  v_final_amount := v_total_amount - v_discount;
  update public.sales
  set total_amount = v_total_amount,
      final_amount = v_final_amount
  where id = v_sale_id;

  return v_sale_id;
end;
$$;

grant execute on function public.create_sale(uuid, text, integer, jsonb) to authenticated;

create or replace function public.request_sale_refund(
  p_sale_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_sale public.sales%rowtype;
  v_request_id uuid;
begin
  if v_user_id is null or public.current_role() is distinct from 'kasir' then
    raise exception 'Hanya Kasir yang disetujui dapat mengajukan refund.';
  end if;
  if p_reason is null or char_length(trim(p_reason)) < 3 or char_length(trim(p_reason)) > 500 then
    raise exception 'Alasan refund harus berisi 3 sampai 500 karakter.';
  end if;

  select * into v_sale
  from public.sales
  where id = p_sale_id
    and cashier_id = v_user_id
  for update;
  if not found then
    raise exception 'Transaksi tidak ditemukan atau bukan milik Anda.';
  end if;
  if v_sale.status <> 'completed' then
    raise exception 'Hanya transaksi selesai yang dapat diajukan refund.';
  end if;
  if exists (
    select 1 from public.refund_requests
    where sale_id = p_sale_id and status = 'pending'
  ) then
    raise exception 'Sudah ada pengajuan refund yang menunggu persetujuan untuk transaksi ini.';
  end if;

  insert into public.refund_requests (sale_id, requested_by, reason, status)
  values (p_sale_id, v_user_id, trim(p_reason), 'pending')
  returning id into v_request_id;
  return v_request_id;
end;
$$;

create or replace function public.record_business_debt_payment(
  p_payable_id uuid,
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
  v_user_id uuid := auth.uid();
  v_payable public.supplier_payables%rowtype;
  v_new_paid integer;
  v_new_status text;
begin
  if v_user_id is null or not public.is_admin_or_owner() then
    raise exception 'Hanya Admin atau Owner yang disetujui dapat mencatat pembayaran.';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Nominal pembayaran harus lebih dari nol.';
  end if;
  if p_payment_method not in ('cash', 'non_cash') then
    raise exception 'Metode pembayaran tidak valid.';
  end if;

  select * into v_payable
  from public.supplier_payables
  where id = p_payable_id
  for update;
  if not found then
    raise exception 'Data hutang atau piutang tidak ditemukan.';
  end if;
  if v_payable.status = 'paid' or p_amount > (v_payable.total_amount - v_payable.paid_amount) then
    raise exception 'Nominal melebihi sisa tagihan atau tagihan sudah lunas.';
  end if;

  v_new_paid := v_payable.paid_amount + p_amount;
  v_new_status := case when v_new_paid = v_payable.total_amount then 'paid' else 'partial' end;

  insert into public.supplier_payments (
    supplier_payable_id, amount, payment_method, note, created_by
  ) values (
    p_payable_id, p_amount, p_payment_method, p_note, v_user_id
  );

  update public.supplier_payables
  set paid_amount = v_new_paid,
      status = v_new_status
  where id = p_payable_id;

  return jsonb_build_object(
    'paid_amount', v_new_paid,
    'remaining_amount', v_payable.total_amount - v_new_paid,
    'status', v_new_status
  );
end;
$$;

create or replace function public.approve_sale_refund_request(
  p_request_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_request public.refund_requests%rowtype;
begin
  if v_user_id is null or not public.is_admin_or_owner() then
    raise exception 'Hanya Admin atau Owner yang disetujui dapat menyetujui refund.';
  end if;

  select * into v_request
  from public.refund_requests
  where id = p_request_id
  for update;
  if not found or v_request.status <> 'pending' then
    raise exception 'Pengajuan tidak ditemukan atau sudah diproses.';
  end if;

  perform public.void_sale(v_request.sale_id, v_request.reason);

  update public.refund_requests
  set status = 'approved',
      reviewed_by = v_user_id,
      reviewed_at = now()
  where id = p_request_id;
  return true;
end;
$$;

revoke all on function public.request_sale_refund(uuid, text) from public, anon;
grant execute on function public.request_sale_refund(uuid, text) to authenticated;

revoke all on function public.approve_sale_refund_request(uuid) from public, anon;
grant execute on function public.approve_sale_refund_request(uuid) to authenticated;

notify pgrst, 'reload schema';
