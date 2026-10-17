-- ==============================================================================
-- 0015_business_debt_and_receivables.sql
-- Modul Hutang & Piutang Operasional Bisnis (Bukan Kasbon Kasir)
-- Mencatat:
-- 1. Hutang Usaha: Hutang supplier bahan baku, sewa ruko operasional, listrik/utilitas, vendor
-- 2. Piutang Usaha: Konsinyasi toko mitra, pesanan B2B/grosir, deposit operasional
-- ==============================================================================

-- Tambahkan kolom type, category, party_name ke tabel supplier_payables jika belum ada
alter table if exists public.supplier_payables
  add column if not exists type text not null default 'payable' check (type in ('payable', 'receivable')),
  add column if not exists category text not null default 'Supplier / Bahan Baku',
  add column if not exists party_name text;

-- Isi default party_name dari supplier_name untuk data lama
update public.supplier_payables
set party_name = supplier_name
where party_name is null;

-- Indeks kolom type dan category
create index if not exists idx_supplier_payables_type on public.supplier_payables(type);
create index if not exists idx_supplier_payables_category on public.supplier_payables(category);

comment on table public.supplier_payables is 'Hutang & Piutang Usaha Bisnis (Supplier, Sewa, Operasional, Mitra Konsinyasi) — dikelola oleh Admin & Owner';
