-- Migration 0010: Promotions & Discounts
-- Tabel promosi dan diskon untuk Admin/Owner yang diteruskan ke Kasir di terminal POS

create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  type text not null check (type in ('percentage', 'fixed')),
  value integer not null check (value > 0),
  min_purchase integer not null default 0 check (min_purchase >= 0),
  max_discount integer default null,
  start_date date not null default current_date,
  end_date date,
  is_active boolean not null default true,
  description text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indeks kolom FK & filter umum
create index if not exists idx_promotions_code on public.promotions(code);
create index if not exists idx_promotions_is_active on public.promotions(is_active);
create index if not exists idx_promotions_dates on public.promotions(start_date, end_date);

-- Trigger updated_at otomatis
create trigger trg_promotions_updated_at
  before update on public.promotions
  for each row execute function public.handle_updated_at();

-- Row Level Security
alter table public.promotions enable row level security;

-- Staf (Kasir, Admin, Owner) dapat membaca promo aktif untuk transaksi POS
create policy "Promosi dapat dibaca oleh staf"
  on public.promotions for select
  to authenticated
  using (public.is_staff());

-- Hanya Admin dan Owner yang dapat membuat, mengubah, dan menghapus promo
create policy "Promosi dapat dikelola oleh admin dan owner"
  on public.promotions for all
  to authenticated
  using (public.is_admin_or_owner())
  with check (public.is_admin_or_owner());
