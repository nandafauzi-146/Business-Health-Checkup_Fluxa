# AGENTS.md — Panduan untuk AI Coding Agent

File ini untuk AI agent (Claude Code, Cursor, Copilot, dll.) yang membantu setup atau
mengembangkan backend Supabase di proyek ini. Baca file ini dulu sebelum menyentuh
apa pun di folder `supabase/`.

## Tentang Proyek Ini

Sistem kasir (POS) + diagnosis kesehatan bisnis untuk UMKM, dibuat untuk kompetisi
GTNIC 2026 kategori Web Developer. Tiga role pengguna: **kasir**, **admin**, **owner**.
Stack: Next.js (App Router) + Supabase (PostgreSQL, Auth, RLS) + Tailwind.

Deadline kompetisi ketat (~6 minggu), jadi prioritaskan solusi yang **benar dan
sederhana** di atas solusi yang elegan tapi rumit dieksplain ke juri.

## Struktur Folder

```
supabase/
  migrations/
    0001_extensions.sql          Extension pgcrypto
    0002_tables.sql              14 tabel inti
    0003_indexes.sql             Indeks kolom FK & filter umum
    0004_helper_functions.sql    current_role(), is_admin_or_owner(), is_owner()
    0005_triggers.sql            handle_new_user, updated_at, guard anti eskalasi role
    0006_business_functions.sql  create_sale(), close_shift(), void_sale()
    0007_rls_policies.sql        Row Level Security per tabel
    0008_views.sql                View reporting (v_monthly_revenue_cogs, dst.)
  seed.sql                       Data dummy: produk, pelanggan, biaya, utang
scripts/
  seed-demo-accounts.mjs         Buat 3 akun demo (owner/admin/kasir)
README.md                        Dokumentasi lengkap desain skema
.env.example                     Template environment variable
```

Migrasi ini **sudah ditulis dan diuji end-to-end** secara lokal (buka shift → transaksi
→ tutup shift → void → cek RLS per role). Kalau kamu diminta membuat skema dari nol,
CEK DULU apakah folder ini sudah ada isinya sebelum menulis ulang.

## ATURAN WAJIB — Jangan Dilanggar

1. **Semua kolom uang bertipe `integer` (rupiah utuh), bukan `float`/`numeric`
   desimal.** Rupiah tidak punya sen, dan integer menghindari masalah pembulatan.

2. **Tabel `sales`, `sale_items`, `stock_movements` TIDAK BOLEH punya RLS policy
   INSERT/UPDATE langsung untuk client.** Satu-satunya jalur resmi mengubah data
   ini adalah lewat RPC `create_sale()`, `close_shift()`, dan `void_sale()` di
   `0006_business_functions.sql`. Kalau ada kebutuhan baru yang sepertinya perlu
   INSERT langsung ke tabel ini, itu tanda kamu butuh fungsi baru, bukan policy baru.

3. **Jangan edit file migrasi yang sudah ada (0001-0008).** Kalau skema perlu
   berubah, buat file migrasi baru bernomor urut berikutnya (`0009_nama_perubahan.sql`).
   Ini supaya riwayat perubahan tetap bisa dilacak dan aman di-apply ulang di
   project Supabase manapun.

4. **`SUPABASE_SERVICE_ROLE_KEY` HANYA boleh dipakai di kode server-side**
   (Route Handler, Server Action, atau script Node lokal seperti
   `scripts/seed-demo-accounts.mjs`). Jangan pernah taruh di kode yang bisa
   jalan di browser (Client Component, file tanpa penanda server-only), dan
   jangan pernah commit nilainya ke repo.

5. **Fungsi bantu role (`is_admin_or_owner()`, `is_owner()`, `current_role()`)
   sengaja `SECURITY DEFINER`.** Jangan diubah jadi `SECURITY INVOKER`, karena
   akan memicu error *infinite recursion* saat RLS tabel `profiles` mengecek
   dirinya sendiri.

6. **Role akun (`profiles.role`) hanya boleh diisi lewat `user_metadata` saat
   `supabase.auth.admin.createUser()`, atau diubah oleh admin/owner via UPDATE.**
   Jangan buat cara lain untuk user mengubah role dirinya sendiri — sudah ada
   trigger (`trg_guard_profile_role_change`) yang secara sengaja menolak ini.

7. **View reporting di `0008_views.sql` pakai `with (security_invoker = true)`.**
   Ini yang membuat data finansial otomatis tersaring sesuai role tanpa perlu
   RLS terpisah di level view. Jangan hapus opsi ini.

8. **Next.js App Router butuh 3 jenis Supabase client** (browser, server,
   middleware) karena beda cara simpan sesi login. Jangan pakai browser client
   di Server Component/Route Handler — sesi login tidak akan terbaca.

## Ringkasan Matriks Hak Akses

| Data | Kasir | Admin | Owner |
|---|---|---|---|
| Transaksi POS (via RPC) | ✅ | ✅ | ✅ |
| Lihat produk & stok | ✅ (baca) | ✅ | ✅ |
| Kelola produk/stok/biaya/kasbon | ❌ | ✅ | ✅ |
| Void transaksi | ❌ | ✅ | ✅ |
| Data keuangan (expenses, receivables) | ❌ | ✅ | ✅ |
| Rapor kesehatan bisnis (checkups) | ❌ | ❌ | ✅ |
| Audit log | ❌ | ❌ | ✅ |

Detail lengkap tiap tabel & alasan desainnya ada di `README.md` — baca itu untuk
konteks, jangan menebak dari nama kolom saja.

## Cara Menerapkan Migrasi

```bash
# Opsi CLI (disarankan)
supabase link --project-ref <project-ref>
supabase db push

# Opsi manual: tempel isi tiap file di supabase/migrations/ ke SQL Editor
# Supabase Dashboard, BERURUTAN sesuai nomor file (0001 dulu, baru 0002, dst.)
```

Setelah migrasi jalan:
```bash
# Data dummy dasar
# (tempel isi supabase/seed.sql ke SQL Editor)

# 3 akun demo (owner/admin/kasir)
npm install @supabase/supabase-js dotenv
node scripts/seed-demo-accounts.mjs

# Generate TypeScript types dari skema, commit hasilnya
supabase gen types typescript --project-id <project-ref> --schema public \
  > src/lib/supabase/types.ts
```

## Environment Variables yang Dibutuhkan

Lihat `.env.example` untuk daftar lengkap. Ringkasnya:

| Variable | Dipakai di | Boleh di browser? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Semua client | Ya |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser & server client | Ya |
| `SUPABASE_SERVICE_ROLE_KEY` | Route Handler AI, seed script | **Tidak** |
| `SUPABASE_URL` | Script Node lokal | **Tidak** |

## Pola Kode Supabase Client (Next.js App Router)

Kalau diminta membuat/memperbaiki setup client, ikuti pola `@supabase/ssr`
(bukan `@supabase/auth-helpers-nextjs` yang sudah deprecated):

- `utils/supabase/client.ts` — `createBrowserClient(...)`, dipakai di Client Component
- `utils/supabase/server.ts` — `createServerClient(...)` pakai `cookies()` dari
  `next/headers`, dipakai di Server Component/Server Action/Route Handler
- `utils/supabase/middleware.ts` + `middleware.ts` di root — refresh token tiap
  request, sekaligus tempat cek `profiles.role` untuk proteksi route per role
- Saat validasi user di server, pakai `supabase.auth.getUser()`
  (memverifikasi JWT ke server Supabase), **jangan** `getSession()` di server
  karena tidak tervalidasi.

## Query Umum yang Sering Dibutuhkan

```typescript
// CRUD biasa (otomatis tunduk RLS)
const { data } = await supabase.from('products').select('*').eq('is_active', true)

// Transaksi penjualan -- HARUS lewat RPC, jangan insert manual
const { data: saleId } = await supabase.rpc('create_sale', {
  p_shift_id, p_customer_id, p_payment_method, p_discount, p_items,
})

// Data finansial untuk dashboard Owner (sudah tersaring RLS via security_invoker)
const { data } = await supabase.from('v_monthly_revenue_cogs').select('*')
```

## Kalau Diminta Menambah Tabel/Kolom/Fungsi Baru

1. Baca `README.md` dulu, pastikan belum ada yang serupa.
2. Buat file migrasi baru (`0009_...sql`), jangan edit file lama.
3. Kalau tabel baru menyimpan data sensitif (keuangan, milik user tertentu),
   WAJIB tulis RLS policy-nya di migrasi yang sama, jangan ditunda.
4. Kalau ada logika yang mengubah beberapa tabel sekaligus (misalnya seperti
   `create_sale` yang mengubah `sales`, `sale_items`, `products`, dan
   `stock_movements` sekaligus), tulis sebagai fungsi `SECURITY DEFINER`
   yang atomik, jangan sebagai beberapa query terpisah dari client.
5. Setelah migrasi baru diterapkan, generate ulang TypeScript types.

## Kredensial Demo (untuk testing, bukan data asli)

Dibuat lewat `scripts/seed-demo-accounts.mjs`:

| Role | Email | Password |
|---|---|---|
| Owner | owner@demo.local | Owner123! |
| Admin | admin@demo.local | Admin123! |
| Kasir | kasir@demo.local | Kasir123! |

## Rujukan

- `README.md` di folder ini — penjelasan lengkap tiap keputusan desain & alasannya
- Kalau ragu apakah suatu perubahan aman, cek dulu apakah melanggar salah satu
  "ATURAN WAJIB" di atas sebelum menulis kode
