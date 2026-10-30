-- 0030_cash_reconciliation_and_shift_expenses.sql
-- Integrasi Rekonsiliasi Kas Laci & Alur Pengajuan Pengeluaran Operasional Toko oleh Kasir
-- Berdasarkan panduan AUDIT-REKONSILIASI-KASIR.md:
-- 1. Pengeluaran kas laci toko wajib terhubung ke shift (shift_id).
-- 2. Pengeluaran fisik yang sah mengurangi kas yang diharapkan (expected_cash).
-- 3. Alur verifikasi pengeluaran oleh Admin (pending, approved, rejected, clarification).
-- 4. Pemisahan persetujuan manajerial dari pergerakan uang fisik (cash_impact).

-- A. Perkaya Skema Tabel Expenses
alter table if exists public.expenses
  add column if not exists shift_id uuid references public.shifts(id) on delete set null,
  add column if not exists status text not null default 'approved' check (status in ('pending', 'approved', 'rejected', 'clarification')),
  add column if not exists cash_impact boolean not null default true,
  add column if not exists reviewed_by uuid references public.profiles(id),
  add column if not exists reviewed_at timestamptz,
  add column if not exists rejection_reason text,
  add column if not exists receipt_url text;

-- Indeks performa query rekonsiliasi
create index if not exists idx_expenses_shift_id on public.expenses(shift_id);
create index if not exists idx_expenses_status on public.expenses(status);
create index if not exists idx_expenses_created_by on public.expenses(created_by);
create index if not exists idx_expenses_expense_date on public.expenses(expense_date);

-- B. RPC: Pengajuan Pengeluaran Operasional Kasir (submit_cashier_expense)
create or replace function public.submit_cashier_expense(
  p_amount integer,
  p_description text,
  p_category_id uuid default null,
  p_shift_id uuid default null,
  p_cash_impact boolean default true,
  p_receipt_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_shift_id uuid;
  v_shift public.shifts%rowtype;
  v_expense_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Pengguna harus login untuk mencatat pengeluaran.';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Nominal pengeluaran harus lebih besar dari 0.';
  end if;

  if p_description is null or trim(p_description) = '' then
    raise exception 'Alasan / keterangan pengeluaran wajib diisi.';
  end if;

  -- Tentukan shift aktif
  v_shift_id := p_shift_id;
  if v_shift_id is null then
    select * into v_shift
    from public.shifts
    where cashier_id = v_user_id and status = 'open'
    order by opened_at desc
    limit 1;

    if found then
      v_shift_id := v_shift.id;
    end if;
  else
    select * into v_shift from public.shifts where id = v_shift_id;
    if not found or v_shift.status <> 'open' then
      raise exception 'Shift tidak valid atau sudah ditutup.';
    end if;
  end if;

  -- Buat record pengeluaran dengan status approved langsung (tidak perlu verifikasi admin)
  insert into public.expenses (
    shift_id,
    category_id,
    amount,
    description,
    expense_date,
    status,
    cash_impact,
    receipt_url,
    created_by
  ) values (
    v_shift_id,
    p_category_id,
    p_amount,
    trim(p_description),
    current_date,
    'approved',
    coalesce(p_cash_impact, true),
    p_receipt_url,
    v_user_id
  ) returning id into v_expense_id;

  -- Audit log pencatatan pengeluaran
  insert into public.audit_logs (
    user_id,
    action,
    table_name,
    record_id,
    new_data
  ) values (
    v_user_id,
    'SUBMIT_EXPENSE',
    'expenses',
    v_expense_id,
    jsonb_build_object(
      'amount', p_amount,
      'description', p_description,
      'shift_id', v_shift_id,
      'cash_impact', p_cash_impact,
      'status', case when public.is_admin_or_owner() then 'approved' else 'pending' end
    )
  );

  return v_expense_id;
end;
$$;

-- C. RPC: Verifikasi Pengeluaran Kasir oleh Admin / Owner (verify_cashier_expense)
create or replace function public.verify_cashier_expense(
  p_expense_id uuid,
  p_action text, -- 'approve', 'reject', 'clarification'
  p_reason text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_expense public.expenses%rowtype;
  v_new_status text;
begin
  v_user_id := auth.uid();
  if not public.is_admin_or_owner() then
    raise exception 'Akses ditolak: Hanya Admin atau Owner yang berwenang memverifikasi pengeluaran.';
  end if;

  if p_action not in ('approve', 'reject', 'clarification') then
    raise exception 'Aksi verifikasi tidak valid. Gunakan approve, reject, atau clarification.';
  end if;

  if p_action in ('reject', 'clarification') and (p_reason is null or trim(p_reason) = '') then
    raise exception 'Alasan wajib diisi saat menolak atau meminta klarifikasi pengeluaran.';
  end if;

  select * into v_expense from public.expenses where id = p_expense_id for update;
  if not found then
    raise exception 'Data pengeluaran tidak ditemukan.';
  end if;

  if p_action = 'approve' then
    v_new_status := 'approved';
  elsif p_action = 'reject' then
    v_new_status := 'rejected';
  else
    v_new_status := 'clarification';
  end if;

  update public.expenses
  set status = v_new_status,
      reviewed_by = v_user_id,
      reviewed_at = now(),
      rejection_reason = case when p_action = 'approve' then null else trim(p_reason) end,
      updated_at = now()
  where id = p_expense_id;

  -- Audit log verifikasi
  insert into public.audit_logs (
    user_id,
    action,
    table_name,
    record_id,
    old_data,
    new_data
  ) values (
    v_user_id,
    'VERIFY_EXPENSE',
    'expenses',
    p_expense_id,
    jsonb_build_object('old_status', v_expense.status),
    jsonb_build_object('new_status', v_new_status, 'reason', p_reason, 'action', p_action)
  );

  return true;
end;
$$;

-- D. Perbarui RPC close_shift dengan Perhitungan Pengeluaran Kas Fisik yang Akurat
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
  v_shift_expenses integer := 0;
  v_expected_cash integer := 0;
  v_difference integer := 0;
begin
  select * into v_shift from public.shifts where id = p_shift_id for update;
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

  if p_final_cash is null or p_final_cash < 0 then
    raise exception 'Nominal kas akhir fisik tidak valid.';
  end if;

  -- 1. Hitung total penjualan uang tunai bersih selama shift ini
  select coalesce(sum(final_amount), 0) into v_cash_sales
  from public.sales
  where shift_id = p_shift_id
    and payment_method = 'cash'
    and status = 'completed';

  -- 2. Hitung total pengeluaran operasional toko dari laci kasir selama shift
  -- Pengeluaran fisik yang belum ditolak diperhitungkan dalam rekonsiliasi kas laci
  select coalesce(sum(amount), 0) into v_shift_expenses
  from public.expenses
  where shift_id = p_shift_id
    and cash_impact = true
    and status <> 'rejected';

  -- 3. Rumus Standar: Kas Diharapkan = Saldo Awal + Penjualan Tunai - Pengeluaran Kas
  v_expected_cash := v_shift.initial_cash + v_cash_sales - v_shift_expenses;
  v_difference := p_final_cash - v_expected_cash;

  update public.shifts
  set closed_at = now(),
      final_cash = p_final_cash,
      expected_cash = v_expected_cash,
      difference = v_difference,
      note = coalesce(p_note, note),
      status = 'closed',
      updated_at = now()
  where id = p_shift_id;

  -- Audit log tutup shift
  insert into public.audit_logs (
    user_id,
    action,
    table_name,
    record_id,
    new_data
  ) values (
    auth.uid(),
    'CLOSE_SHIFT',
    'shifts',
    p_shift_id,
    jsonb_build_object(
      'initial_cash', v_shift.initial_cash,
      'cash_sales', v_cash_sales,
      'cash_expenses', v_shift_expenses,
      'expected_cash', v_expected_cash,
      'final_cash', p_final_cash,
      'difference', v_difference
    )
  );

  return jsonb_build_object(
    'shift_id', p_shift_id,
    'initial_cash', v_shift.initial_cash,
    'cash_sales', v_cash_sales,
    'cash_expenses', v_shift_expenses,
    'expected_cash', v_expected_cash,
    'final_cash', p_final_cash,
    'difference', v_difference
  );
end;
$$;

-- E. Izin Eksekusi & RLS
revoke all on function public.submit_cashier_expense(integer, text, uuid, uuid, boolean, text) from public, anon;
grant execute on function public.submit_cashier_expense(integer, text, uuid, uuid, boolean, text) to authenticated;

revoke all on function public.verify_cashier_expense(uuid, text, text) from public, anon;
grant execute on function public.verify_cashier_expense(uuid, text, text) to authenticated;

revoke all on function public.close_shift(uuid, integer, text) from public, anon;
grant execute on function public.close_shift(uuid, integer, text) to authenticated;

-- RLS Expenses Policies
alter table public.expenses enable row level security;

drop policy if exists "kasir_insert_shift_expense" on public.expenses;
create policy "kasir_insert_shift_expense"
  on public.expenses for insert
  to authenticated
  with check (
    created_by = auth.uid()
  );

drop policy if exists "kasir_select_own_shift_expenses" on public.expenses;
create policy "kasir_select_own_shift_expenses"
  on public.expenses for select
  to authenticated
  using (
    created_by = auth.uid() or public.is_admin_or_owner()
  );

drop policy if exists "admin_owner_manage_expenses" on public.expenses;
create policy "admin_owner_manage_expenses"
  on public.expenses for all
  to authenticated
  using (public.is_admin_or_owner())
  with check (public.is_admin_or_owner());

-- RLS Expense Categories: Izinkan kasir membaca kategori pengeluaran operasional toko
alter table public.expense_categories enable row level security;

drop policy if exists "allow_select_expense_categories_authenticated" on public.expense_categories;
create policy "allow_select_expense_categories_authenticated"
  on public.expense_categories for select
  to authenticated
  using (true);

drop policy if exists "admin_owner_manage_expense_categories" on public.expense_categories;
create policy "admin_owner_manage_expense_categories"
  on public.expense_categories for all
  to authenticated
  using (public.is_admin_or_owner())
  with check (public.is_admin_or_owner());

notify pgrst, 'reload schema';
