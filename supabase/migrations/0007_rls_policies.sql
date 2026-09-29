-- 0007_rls_policies.sql
-- Row Level Security (RLS) policies per tabel
-- Mengikuti Matriks Hak Akses AGENTS.md (Kasir, Admin, Owner)
-- PENTING: sales, sale_items, stock_movements TIDAK memiliki policy INSERT/UPDATE untuk client.

-- 1. PROFILES
alter table public.profiles enable row level security;

create policy "Profiles dapat dilihat oleh pengguna terotentikasi"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Pengguna dapat mengupdate profil sendiri"
  on public.profiles for update
  to authenticated
  using (id = auth.uid() or public.is_admin_or_owner())
  with check (id = auth.uid() or public.is_admin_or_owner());

-- 2. CATEGORIES
alter table public.categories enable row level security;

create policy "Kategori dapat dibaca oleh staf"
  on public.categories for select
  to authenticated
  using (public.is_staff());

create policy "Kategori dapat dikelola oleh admin dan owner"
  on public.categories for all
  to authenticated
  using (public.is_admin_or_owner())
  with check (public.is_admin_or_owner());

-- 3. PRODUCTS
alter table public.products enable row level security;

create policy "Produk dapat dibaca oleh staf"
  on public.products for select
  to authenticated
  using (public.is_staff());

create policy "Produk dapat dikelola oleh admin dan owner"
  on public.products for all
  to authenticated
  using (public.is_admin_or_owner())
  with check (public.is_admin_or_owner());

-- 4. CUSTOMERS
alter table public.customers enable row level security;

create policy "Pelanggan dapat dibaca oleh staf"
  on public.customers for select
  to authenticated
  using (public.is_staff());

create policy "Pelanggan dapat ditambahkan atau diubah oleh staf"
  on public.customers for insert
  to authenticated
  with check (public.is_staff());

create policy "Pelanggan dapat diedit oleh staf"
  on public.customers for update
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy "Pelanggan hanya dapat dihapus oleh admin atau owner"
  on public.customers for delete
  to authenticated
  using (public.is_admin_or_owner());

-- 5. SHIFTS
alter table public.shifts enable row level security;

create policy "Shifts dapat dibaca oleh kasir pemilik atau admin/owner"
  on public.shifts for select
  to authenticated
  using (cashier_id = auth.uid() or public.is_admin_or_owner());

-- 6. SALES (Hanya SELECT - mutasi lewat RPC create_sale & void_sale)
alter table public.sales enable row level security;

create policy "Sales dapat dibaca oleh kasir pembuat atau admin/owner"
  on public.sales for select
  to authenticated
  using (cashier_id = auth.uid() or public.is_admin_or_owner());

-- 7. SALE_ITEMS (Hanya SELECT - mutasi lewat RPC create_sale)
alter table public.sale_items enable row level security;

create policy "Sale items dapat dibaca oleh staf pemilik transaksi atau admin/owner"
  on public.sale_items for select
  to authenticated
  using (
    exists (
      select 1 from public.sales s
      where s.id = sale_items.sale_id
        and (s.cashier_id = auth.uid() or public.is_admin_or_owner())
    )
  );

-- 8. STOCK_MOVEMENTS (Hanya SELECT - mutasi lewat RPC)
alter table public.stock_movements enable row level security;

create policy "Pergerakan stok hanya dapat dilihat oleh admin dan owner"
  on public.stock_movements for select
  to authenticated
  using (public.is_admin_or_owner());

-- 9. EXPENSE_CATEGORIES
alter table public.expense_categories enable row level security;

create policy "Kategori biaya hanya dapat diakses oleh admin dan owner"
  on public.expense_categories for all
  to authenticated
  using (public.is_admin_or_owner())
  with check (public.is_admin_or_owner());

-- 10. EXPENSES
alter table public.expenses enable row level security;

create policy "Data biaya operasional hanya untuk admin dan owner"
  on public.expenses for all
  to authenticated
  using (public.is_admin_or_owner())
  with check (public.is_admin_or_owner());

-- 11. RECEIVABLES (Kasbon)
alter table public.receivables enable row level security;

create policy "Data piutang/kasbon hanya untuk admin dan owner"
  on public.receivables for all
  to authenticated
  using (public.is_admin_or_owner())
  with check (public.is_admin_or_owner());

-- 12. RECEIVABLE_PAYMENTS
alter table public.receivable_payments enable row level security;

create policy "Pembayaran piutang hanya untuk admin dan owner"
  on public.receivable_payments for all
  to authenticated
  using (public.is_admin_or_owner())
  with check (public.is_admin_or_owner());

-- 13. CHECKUPS (Rapor Kesehatan Bisnis - HANYA OWNER)
alter table public.checkups enable row level security;

create policy "Rapor kesehatan bisnis eksklusif untuk owner"
  on public.checkups for all
  to authenticated
  using (public.is_owner())
  with check (public.is_owner());

-- 14. AUDIT_LOGS (HANYA OWNER)
alter table public.audit_logs enable row level security;

create policy "Audit log eksklusif untuk owner"
  on public.audit_logs for select
  to authenticated
  using (public.is_owner());
