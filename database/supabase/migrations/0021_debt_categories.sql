-- 0021_debt_categories.sql
-- Tabel kategori hutang & piutang yang dapat dikelola oleh admin/owner
-- Menggantikan daftar kategori hardcoded di frontend

create table if not exists public.debt_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Seed kategori default
insert into public.debt_categories (name) values
  ('Supplier / Bahan Baku'),
  ('Operasional & Sewa Ruko'),
  ('Utilitas & Listrik Toko'),
  ('Peralatan & Fasilitas'),
  ('Pinjaman Modal Usaha'),
  ('Konsinyasi & Kemitraan Toko'),
  ('Lain-lain')
on conflict (name) do nothing;

-- Trigger updated_at
create trigger trg_debt_categories_updated_at
  before update on public.debt_categories
  for each row execute function public.handle_updated_at();

-- RLS: semua user login bisa baca, hanya admin/owner bisa ubah
alter table public.debt_categories enable row level security;

create policy "Kategori hutang piutang bisa dibaca semua user login"
  on public.debt_categories for select
  to authenticated
  using (true);

create policy "Kategori hutang piutang hanya bisa diubah admin dan owner"
  on public.debt_categories for insert
  to authenticated
  with check (public.is_admin_or_owner());

create policy "Kategori hutang piutang update hanya admin dan owner"
  on public.debt_categories for update
  to authenticated
  using (public.is_admin_or_owner())
  with check (public.is_admin_or_owner());

create policy "Kategori hutang piutang delete hanya admin dan owner"
  on public.debt_categories for delete
  to authenticated
  using (public.is_admin_or_owner());

comment on table public.debt_categories is 'Kategori hutang & piutang usaha yang dapat dikelola admin/owner';
