-- 0013_supplier_payables.sql
-- Tabel hutang bisnis ke supplier/pemasok
-- Berbeda dari receivables (piutang pelanggan ke bisnis),
-- ini mencatat saat bisnis beli bahan baku / barang ke supplier dengan bayar belakangan.

create table if not exists public.supplier_payables (
  id           uuid primary key default gen_random_uuid(),
  supplier_name text not null,                         -- nama supplier / pemasok
  description  text not null,                          -- keterangan (beli apa)
  total_amount integer not null check (total_amount > 0),
  paid_amount  integer not null default 0 check (paid_amount >= 0),
  due_date     date,
  status       text not null default 'unpaid'
               check (status in ('unpaid', 'partial', 'paid')),
  note         text,
  created_by   uuid not null references public.profiles(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Tabel riwayat pembayaran hutang ke supplier
create table if not exists public.supplier_payments (
  id                  uuid primary key default gen_random_uuid(),
  supplier_payable_id uuid not null references public.supplier_payables(id) on delete cascade,
  amount              integer not null check (amount > 0),
  payment_date        timestamptz not null default now(),
  payment_method      text not null check (payment_method in ('cash', 'non_cash')),
  note                text,
  created_by          uuid not null references public.profiles(id),
  created_at          timestamptz not null default now()
);

-- Indeks
create index if not exists idx_supplier_payables_status on public.supplier_payables(status);
create index if not exists idx_supplier_payments_payable_id on public.supplier_payments(supplier_payable_id);

-- RLS: hanya admin dan owner yang bisa mengakses data hutang supplier
alter table public.supplier_payables enable row level security;
alter table public.supplier_payments enable row level security;

create policy "Hutang supplier hanya untuk admin dan owner"
  on public.supplier_payables for all
  to authenticated
  using (public.is_admin_or_owner())
  with check (public.is_admin_or_owner());

create policy "Pembayaran hutang supplier hanya untuk admin dan owner"
  on public.supplier_payments for all
  to authenticated
  using (public.is_admin_or_owner())
  with check (public.is_admin_or_owner());

-- Trigger updated_at
create trigger trg_supplier_payables_updated_at
  before update on public.supplier_payables
  for each row execute function public.handle_updated_at();

comment on table public.supplier_payables is 'Hutang bisnis ke supplier/pemasok — dicatat oleh admin/owner';
comment on table public.supplier_payments is 'Riwayat cicilan/pelunasan hutang ke supplier';
