-- 0012_add_image_url_to_products.sql
-- Menambahkan kolom image_url pada tabel products untuk menyimpan foto produk
-- yang diinput di halaman Kelola Produk dan ditampilkan di katalog kasir / POS.

alter table public.products
  add column if not exists image_url text;

comment on column public.products.image_url is 'URL atau Data URL foto produk untuk ditampilkan di kartu katalog POS kasir dan daftar kelola produk';
