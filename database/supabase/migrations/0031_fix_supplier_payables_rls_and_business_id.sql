-- ==============================================================================
-- 0031_fix_supplier_payables_rls_and_business_id.sql
-- Perbaikan RLS dan business_id untuk tabel supplier_payables & supplier_payments.
--
-- Root cause: Migration 0029 (multi_tenant_business_isolation) menambahkan kolom
-- business_id ke supplier_payables, namun TIDAK memperbarui RLS policy-nya.
-- Policy lama dari 0013 hanya memakai is_admin_or_owner() tanpa memeriksa
-- business_id, sehingga insert dari service layer (yang tidak bypass RLS) tetap
-- memerlukan business_id untuk melewati with check yang benar.
-- Selain itu, RPC record_business_debt_payment perlu diperbarui agar menyisipkan
-- business_id ke supplier_payments saat mencatat cicilan.
-- ==============================================================================

-- 1. Pastikan kolom business_id ada (idempotent — sudah ada di 0029 tapi
--    diulang untuk safety jika migration 0029 belum jalan di suatu environment)
alter table public.supplier_payables
  add column if not exists business_id uuid references public.businesses(id) on delete cascade;

alter table public.supplier_payments
  add column if not exists business_id uuid references public.businesses(id) on delete cascade;

-- 2. Backfill business_id untuk baris lama yang belum terisi
update public.supplier_payables
set business_id = (select id from public.businesses order by created_at asc limit 1)
where business_id is null;

update public.supplier_payments sp
set business_id = coalesce(
  (select p.business_id from public.supplier_payables p where p.id = sp.supplier_payable_id),
  (select id from public.businesses order by created_at asc limit 1)
)
where sp.business_id is null;

-- 3. Perbarui RLS policy supplier_payables agar menggunakan current_business_id()
--    konsisten dengan tabel operasional lain di migration 0029.
alter table public.supplier_payables enable row level security;

drop policy if exists "Hutang supplier hanya untuk admin dan owner" on public.supplier_payables;
drop policy if exists "Hutang & Piutang hanya untuk admin dan owner bisnis" on public.supplier_payables;

create policy "Hutang & Piutang hanya untuk admin dan owner bisnis"
  on public.supplier_payables for all
  to authenticated
  using (
    (business_id = public.current_business_id() and public.is_admin_or_owner())
    or public.is_super_admin()
  )
  with check (
    (business_id = public.current_business_id() and public.is_admin_or_owner())
    or public.is_super_admin()
  );

-- 4. Perbarui RLS policy supplier_payments
alter table public.supplier_payments enable row level security;

drop policy if exists "Pembayaran hutang supplier hanya untuk admin dan owner" on public.supplier_payments;
drop policy if exists "Pembayaran hutang hanya untuk admin dan owner bisnis" on public.supplier_payments;

create policy "Pembayaran hutang hanya untuk admin dan owner bisnis"
  on public.supplier_payments for all
  to authenticated
  using (
    (business_id = public.current_business_id() and public.is_admin_or_owner())
    or public.is_super_admin()
  )
  with check (
    (business_id = public.current_business_id() and public.is_admin_or_owner())
    or public.is_super_admin()
  );

-- 5. Perbarui indeks (idempotent)
create index if not exists idx_supplier_payables_business_id on public.supplier_payables(business_id);
create index if not exists idx_supplier_payments_business_id on public.supplier_payments(business_id);

-- 6. Perbarui fungsi record_business_debt_payment agar menyisipkan business_id
--    ke supplier_payments saat mencatat cicilan/pelunasan.
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
    raise exception 'Metode pembayaran tidak valid. Gunakan cash atau non_cash.';
  end if;

  -- Ambil data hutang/piutang — security definer bypass RLS,
  -- tapi kita tetap validasi kepemilikan bisnis secara eksplisit.
  select * into v_payable
  from public.supplier_payables
  where id = p_payable_id
  for update;

  if not found then
    raise exception 'Data hutang atau piutang tidak ditemukan.';
  end if;

  -- Validasi kepemilikan bisnis (super admin boleh semua)
  if v_payable.business_id is not null
     and v_payable.business_id <> public.current_business_id()
     and not public.is_super_admin() then
    raise exception 'Akses ditolak: data ini bukan milik bisnis Anda.';
  end if;

  if v_payable.status = 'paid' then
    raise exception 'Tagihan ini sudah lunas dan tidak dapat ditambah pembayaran.';
  end if;

  if p_amount > (v_payable.total_amount - v_payable.paid_amount) then
    raise exception 'Nominal melebihi sisa tagihan (sisa: %).', (v_payable.total_amount - v_payable.paid_amount);
  end if;

  v_new_paid := v_payable.paid_amount + p_amount;
  v_new_status := case when v_new_paid = v_payable.total_amount then 'paid' else 'partial' end;

  -- Sisipkan riwayat pembayaran beserta business_id
  insert into public.supplier_payments (
    supplier_payable_id, amount, payment_method, note, created_by, business_id
  ) values (
    p_payable_id, p_amount, p_payment_method, p_note, v_user_id, v_payable.business_id
  );

  -- Update status hutang/piutang
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

-- Hak eksekusi fungsi
revoke all on function public.record_business_debt_payment(uuid, integer, text, text) from public, anon;
grant execute on function public.record_business_debt_payment(uuid, integer, text, text) to authenticated;

-- Reload PostgREST schema cache
notify pgrst, 'reload schema';
