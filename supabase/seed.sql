-- supabase/seed.sql
-- Data Dummy: Kategori, Produk, Pelanggan, Kategori Pengeluaran

-- 1. Kategori Produk
insert into public.categories (name, description) values
  ('Minuman', 'Aneka minuman kopi, teh, dan jus'),
  ('Makanan Ringan', 'Camilan, roti, dan snack'),
  ('Sembako', 'Bahan pokok kebutuhan harian'),
  ('Makanan Berat', 'Makanan siap santap')
on conflict (name) do nothing;

-- 2. Produk (Semua harga dalam rupiah integer utuh)
insert into public.products (category_id, name, sku, barcode, buy_price, sell_price, stock, min_stock, unit, is_active) values
  ((select id from public.categories where name = 'Minuman'), 'Kopi Susu Gula Aren', 'MNM-001', '8991001001', 8000, 15000, 50, 10, 'cup', true),
  ((select id from public.categories where name = 'Minuman'), 'Es Teh Melati Manis', 'MNM-002', '8991001002', 2000, 5000, 100, 20, 'cup', true),
  ((select id from public.categories where name = 'Makanan Ringan'), 'Keripik Singkong Balado', 'SNK-001', '8992002001', 6000, 10000, 30, 8, 'bungkus', true),
  ((select id from public.categories where name = 'Makanan Ringan'), 'Roti Cokelat Keju', 'SNK-002', '8992002002', 7000, 12000, 25, 5, 'pcs', true),
  ((select id from public.categories where name = 'Sembako'), 'Beras Ramos 5kg', 'SBK-001', '8993003001', 65000, 75000, 20, 5, 'karung', true),
  ((select id from public.categories where name = 'Sembako'), 'Minyak Goreng Sawit 1L', 'SBK-002', '8993003002', 15000, 18500, 40, 10, 'pouch', true),
  ((select id from public.categories where name = 'Makanan Berat'), 'Nasi Goreng Spesial', 'MKN-001', '8994004001', 12000, 22000, 40, 5, 'porsi', true)
on conflict (sku) do nothing;

-- 3. Pelanggan Tetap
insert into public.customers (name, phone, address) values
  ('Budi Santoso', '081234567890', 'Jl. Merdeka No. 12, Sleman'),
  ('Siti Rahmawati', '085712345678', 'Jl. Kaliurang KM 5, Sleman'),
  ('Warung Bu Joko', '081398765432', 'Jl. Palagan No. 45, Sleman');

-- 4. Kategori Biaya Operasional
insert into public.expense_categories (name, description) values
  ('Bahan Baku & Restok', 'Pembelian bahan dan kulakan produk'),
  ('Listrik & Utilitas', 'Tagihan PLN, PDAM, dan internet'),
  ('Gaji & Upah Kasir', 'Insentif dan upah staf'),
  ('Sewa Tempat & Kebersihan', 'Sewa kios dan iuran lingkungan')
on conflict (name) do nothing;
