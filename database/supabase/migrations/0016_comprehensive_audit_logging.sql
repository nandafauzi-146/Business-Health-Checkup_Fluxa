-- ==============================================================================
-- 0016_comprehensive_audit_logging.sql
-- Merekam seluruh aktivitas penting yang dilakukan oleh Kasir dan Admin secara otomatis.
-- Termasuk:
-- 1. KASIR: Transaksi Penjualan (CREATE_SALE), Buka Shift (OPEN_SHIFT), Tutup Shift (CLOSE_SHIFT)
-- 2. ADMIN: Void Transaksi (VOID_SALE), Koreksi Stok (ADJUST_STOCK), Catat Biaya (CREATE_EXPENSE),
--           Ubah Harga/Produk (UPDATE_PRODUCT), Hutang/Piutang (CREATE_DEBT, RECORD_PAYMENT)
-- ==============================================================================

-- 1. Trigger Audit untuk Penjualan Kasir (sales)
create or replace function public.log_sales_audit()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if (TG_OP = 'INSERT') and new.status = 'completed' then
    insert into public.audit_logs (
      user_id,
      action,
      table_name,
      record_id,
      new_data
    ) values (
      new.cashier_id,
      'CREATE_SALE',
      'sales',
      new.id,
      jsonb_build_object(
        'invoice_number', new.invoice_number,
        'final_amount', new.final_amount,
        'payment_method', new.payment_method,
        'discount', new.discount
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_audit_sales_created on public.sales;
create trigger trg_audit_sales_created
  after insert on public.sales
  for each row execute function public.log_sales_audit();

-- 2. Trigger Audit untuk Buka & Tutup Shift Kasir (shifts)
create or replace function public.log_shifts_audit()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if (TG_OP = 'INSERT') then
    insert into public.audit_logs (
      user_id,
      action,
      table_name,
      record_id,
      new_data
    ) values (
      new.cashier_id,
      'OPEN_SHIFT',
      'shifts',
      new.id,
      jsonb_build_object(
        'initial_cash', new.initial_cash,
        'status', new.status,
        'opened_at', new.opened_at
      )
    );
  elsif (TG_OP = 'UPDATE') and old.status != 'closed' and new.status = 'closed' then
    insert into public.audit_logs (
      user_id,
      action,
      table_name,
      record_id,
      old_data,
      new_data
    ) values (
      new.cashier_id,
      'CLOSE_SHIFT',
      'shifts',
      new.id,
      jsonb_build_object(
        'initial_cash', old.initial_cash
      ),
      jsonb_build_object(
        'initial_cash', new.initial_cash,
        'final_cash', new.final_cash,
        'expected_cash', new.expected_cash,
        'difference', new.difference,
        'note', new.note,
        'closed_at', new.closed_at
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_audit_shifts_change on public.shifts;
create trigger trg_audit_shifts_change
  after insert or update on public.shifts
  for each row execute function public.log_shifts_audit();

-- 3. Trigger Audit untuk Biaya Operasional Admin (expenses)
create or replace function public.log_expenses_audit()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.audit_logs (
    user_id,
    action,
    table_name,
    record_id,
    new_data
  ) values (
    new.created_by,
    'CREATE_EXPENSE',
    'expenses',
    new.id,
    jsonb_build_object(
      'amount', new.amount,
      'description', new.description,
      'expense_date', new.expense_date
    )
  );
  return new;
end;
$$;

drop trigger if exists trg_audit_expenses_created on public.expenses;
create trigger trg_audit_expenses_created
  after insert on public.expenses
  for each row execute function public.log_expenses_audit();

-- 4. Trigger Audit untuk Perubahan Harga / Status Produk oleh Admin (products)
create or replace function public.log_products_audit()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();
  if (TG_OP = 'UPDATE') and (
    old.sell_price is distinct from new.sell_price or
    old.buy_price is distinct from new.buy_price or
    old.is_active is distinct from new.is_active
  ) then
    insert into public.audit_logs (
      user_id,
      action,
      table_name,
      record_id,
      old_data,
      new_data
    ) values (
      v_user_id,
      'UPDATE_PRODUCT',
      'products',
      new.id,
      jsonb_build_object(
        'sell_price', old.sell_price,
        'buy_price', old.buy_price,
        'is_active', old.is_active
      ),
      jsonb_build_object(
        'name', new.name,
        'sell_price', new.sell_price,
        'buy_price', new.buy_price,
        'is_active', new.is_active
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_audit_products_change on public.products;
create trigger trg_audit_products_change
  after update on public.products
  for each row execute function public.log_products_audit();

-- 5. Trigger Audit untuk Hutang & Piutang Bisnis (supplier_payables & supplier_payments)
create or replace function public.log_debts_audit()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.audit_logs (
    user_id,
    action,
    table_name,
    record_id,
    new_data
  ) values (
    new.created_by,
    case when new.type = 'receivable' then 'CREATE_RECEIVABLE' else 'CREATE_DEBT' end,
    'supplier_payables',
    new.id,
    jsonb_build_object(
      'party_name', coalesce(new.party_name, new.supplier_name),
      'type', new.type,
      'category', new.category,
      'description', new.description,
      'total_amount', new.total_amount,
      'due_date', new.due_date
    )
  );
  return new;
end;
$$;

drop trigger if exists trg_audit_debts_created on public.supplier_payables;
create trigger trg_audit_debts_created
  after insert on public.supplier_payables
  for each row execute function public.log_debts_audit();

create or replace function public.log_debt_payments_audit()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.audit_logs (
    user_id,
    action,
    table_name,
    record_id,
    new_data
  ) values (
    new.created_by,
    'RECORD_DEBT_PAYMENT',
    'supplier_payments',
    new.id,
    jsonb_build_object(
      'supplier_payable_id', new.supplier_payable_id,
      'amount', new.amount,
      'payment_method', new.payment_method,
      'note', new.note
    )
  );
  return new;
end;
$$;

drop trigger if exists trg_audit_debt_payments_created on public.supplier_payments;
create trigger trg_audit_debt_payments_created
  after insert on public.supplier_payments
  for each row execute function public.log_debt_payments_audit();
