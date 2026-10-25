
alter table public.products
  add column if not exists image_url text;

comment on column public.products.image_url is
  'URL atau Data URL foto produk untuk ditampilkan di kartu katalog POS kasir dan daftar kelola produk';

notify pgrst, 'reload schema';
