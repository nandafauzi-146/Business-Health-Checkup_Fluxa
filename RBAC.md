# Pembagian Hak Akses (Role-Based Access Control — RBAC)

Dokumen ini mendefinisikan arsitektur dan matriks hak akses pengguna di sistem **Fluxa (POS & AI Business Health Checkup)**. Hak akses ditegakkan menggunakan prinsip *Defense in Depth* (keamanan berlapis), mulai dari antarmuka pengguna, proteksi server Next.js, API Route Guards, hingga *Row Level Security (RLS)* dan fungsi *Stored Procedure (RPC)* di PostgreSQL.

---

## 1. Matriks Hak Akses Fitur

| Fitur / Modul | Kasir | Admin | Owner | Mekanisme & Penegakan Keamanan |
| :--- | :---: | :---: | :---: | :--- |
| **Transaksi Kasir (POS) & Cetak Struk** | ✅ | ✅ | ✅ | RPC atomik `create_sale()` (`SECURITY DEFINER`) |
| **Buka & Tutup Shift Kasir** | ✅ | ✅ | ✅ | RPC `close_shift()`, tabel `shifts` |
| **Lihat Riwayat Transaksi Kasir** | ✅ *(Shift Sendiri)* | ✅ *(Semua)* | ✅ *(Semua)* | RLS tabel `sales` & filter shift aktif |
| **Lihat Katalog Produk & Stok** | ✅ *(Hanya Baca)* | ✅ | ✅ | RLS `products` (SELECT untuk authenticated) |
| **Kelola Produk & Harga (Tambah/Edit/Nonaktif)** | ❌ | ✅ | ✅ | RLS `products` (INSERT/UPDATE/DELETE `is_admin_or_owner()`) |
| **Kelola Kategori Produk** | ❌ | ✅ | ✅ | RLS `categories` (`is_admin_or_owner()`) |
| **Penyesuaian Stok (Restock / Rusak / Opname)** | ❌ | ✅ | ✅ | RPC atomik `adjust_stock()` + catat mutasi stok |
| **Pencatatan Biaya Operasional (Expenses)** | ❌ | ✅ | ✅ | RLS `expenses` (`is_admin_or_owner()`) |
| **Kelola Kasbon & Piutang Pelanggan** | ❌ | ✅ | ✅ | RLS `receivables` & `receivable_payments` |
| **Pembatalan / Void Transaksi** | ❌ | ✅ | ✅ | RPC atomik `void_sale()` + pengembalian stok + audit log |
| **Laporan Penjualan Harian** | ❌ | ✅ | ✅ | View `v_daily_sales_summary` (`security_invoker = true`) |
| **Kelola Akun Kasir (Tambah, Edit, Hapus)** | ❌ | ✅ | ✅ | API `/api/admin/users` + Supabase Auth Admin |
| **Kelola Akun Admin & Owner** | ❌ | ❌ | ✅ | Dibatasi khusus Owner (`is_owner()`) |
| **Rapor Kesehatan Bisnis AI (Checkups)** | ❌ | ❌ | ✅ | RLS `business_checkups` (`is_owner()`) |
| **Laporan Finansial Sensitif (Cashflow, P&L, Valuasi)** | ❌ | ❌ | ✅ | RLS views finansial & laporan bulanan |
| **Audit Log (Jejak Aktivitas Sistem)** | ❌ | ❌ | ✅ | RLS `audit_logs` (`is_owner()`), append-only |

---

## 2. Deskripsi Wewenang Tiap Role

### 2.1. Kasir (`kasir`)
* **Fokus Utama:** Pelayanan penjualan langsung di meja kasir (Front-line POS).
* **Wewenang:**
  * Membuka dan menutup shift kerja kasir beserta verifikasi kas awal/akhir.
  * Mencari produk, menambahkan pesanan ke keranjang belanja, dan menerapkan diskon nota.
  * Memproses transaksi multi-metode (Tunai, QRIS, Transfer, Kasbon).
  * Mencetak nota/struk belanja pelanggan dan melihat riwayat transaksi shift berjalan.
* **Batasan:**
  * Tidak dapat mengubah harga, menambah produk, atau mengubah stok langsung.
  * Tidak dapat membatalkan transaksi yang sudah selesai (*Void* membutuhkan wewenang Admin/Owner).
  * Tidak dapat melihat data laporan laba, biaya operasional, kasbon toko, maupun akun pengguna lain.

### 2.2. Admin (`admin`)
* **Fokus Utama:** Pengawasan operasional toko, persediaan gudang, dan tim kasir.
* **Wewenang:**
  * Mengelola katalog barang (tambah, edit, atur harga beli/jual, satuan, dan nonaktifkan produk).
  * Mengatur kategori produk untuk pengelompokan POS.
  * Melakukan penyesuaian stok masuk (restock), stok keluar (rusak/kadaluarsa), dan opname fisik via RPC `adjust_stock()`.
  * Mencatat dan memantau biaya operasional harian toko (listrik, sewa, perlengkapan).
  * Memantau kasbon/piutang pelanggan dan mencatat cicilan/pelunasannya.
  * Melakukan pembatalan transaksi (*Void*) jika terjadi komplain/kesalahan input kasir.
  * **Hanya berwenang melihat, menambahkan, mengedit profil, dan menghapus akun Kasir**.
* **Batasan:**
  * **Dilarang melihat atau mengelola akun sesama Admin maupun akun Owner**.
  * Dilarang mengakses laporan diagnosis AI *Business Health Checkup*.
  * Dilarang mengakses laporan laba rugi bersih, neraca, arus kas tingkat tinggi, dan audit log keamanan.

### 2.3. Owner (`owner`)
* **Fokus Utama:** Pemilik usaha, pengambil keputusan strategis, dan tata kelola bisnis.
* **Wewenang Mutlak (Superuser Bisnis):**
  * Mengakses Rapor Kesehatan Bisnis AI (*Business Health Checkup*) lengkap dengan rekomendasi AI Advisor.
  * Mengakses laporan keuangan eksekutif (Laba-Rugi/P&L, Valuasi Stok, Tren Margin, dan Cashflow).
  * Mengelola seluruh akun staf (Kasir, Admin, dan Owner lain).
  * Mengaudit rekam jejak sistem (*Audit Log*) untuk melacak aktivitas penting (siapa melakukan apa dan kapan).
  * Memiliki semua hak akses operasional yang dimiliki oleh Admin dan Kasir.

---

## 3. Arsitektur Penegakan Keamanan (Security Enforcement Layers)

Fluxa tidak hanya menyembunyikan menu di tampilan antarmuka (UI), tetapi menerapkan 4 lapis perlindungan:

```
┌───────────────────────────────────────────────────────────┐
│ Layer 1: Next.js Layout Server Guard (Route Groups)      │
│          (/kasir/*, /admin/*, /owner/*)                   │
├───────────────────────────────────────────────────────────┤
│ Layer 2: Next.js Server API Route Guard                  │
│          (/api/admin/users, /api/business-health)         │
├───────────────────────────────────────────────────────────┤
│ Layer 3: Database PostgreSQL Row Level Security (RLS)    │
│          (is_admin_or_owner(), is_owner(), current_role())│
├───────────────────────────────────────────────────────────┤
│ Layer 4: Anti-Escalation Triggers & Atomic RPC Functions  │
│          (trg_guard_profile_role_change, adjust_stock)    │
└───────────────────────────────────────────────────────────┘
```

### Layer 1: Proteksi Routing Next.js App Router
Setiap kelompok route diproteksi secara server-side di level `layout.tsx` menggunakan `supabase.auth.getUser()`:
* **`(kasir)/layout.tsx`**: Dapat diakses oleh pengguna dengan role `kasir`, `admin`, atau `owner`.
* **`(admin)/layout.tsx`**: Hanya dapat diakses oleh `admin` dan `owner`. Pengguna dengan role `kasir` otomatis dialihkan (*redirect*) ke `/login` atau `/kasir`.
* **`(owner)/layout.tsx`**: Khusus pengguna dengan role `owner`. Pengguna `admin` dan `kasir` ditolak dan dialihkan.

### Layer 2: Proteksi API Route Pengguna (`/api/admin/users`)
* Endpoint server-side ini memvalidasi JWT caller sebelum mengeksekusi operasi `auth.admin`:
  * Jika caller ber-role **Admin**, sistem secara ketat membatasi:
    * **POST (Tambah):** Role target dipaksa menjadi `kasir`. Permintaan penambahan admin/owner otomatis ditolak (`403 Forbidden`).
    * **PUT (Edit):** Memvalidasi bahwa akun target ber-role `kasir`.
    * **DELETE (Hapus):** Memvalidasi bahwa akun target ber-role `kasir`. Admin dilarang menghapus akun admin lain atau owner.
  * Jika caller ber-role **Owner**, memiliki izin penuh untuk mengelola semua peran staf.

### Layer 3: Row Level Security (RLS) PostgreSQL
Setiap tabel di Supabase dilindungi RLS berbasis fungsi pembantu berstatus `SECURITY DEFINER`:
* `current_role()`: Mengambil role aktif dari tabel `profiles`.
* `is_admin_or_owner()`: Mengembalikan `true` jika role adalah `admin` atau `owner`.
* `is_owner()`: Mengembalikan `true` hanya jika role adalah `owner`.
* Tabel transaksi inti (`sales`, `sale_items`, `stock_movements`) tidak memiliki kebijakan INSERT/UPDATE langsung untuk client guna mencegah manipulasi angka keuangan dari browser.

### Layer 4: Trigger Anti-Eskalasi Role
* Trigger `trg_guard_profile_role_change` berjalan sebelum UPDATE pada tabel `public.profiles`.
* Mencegah percobaan manipulasi kolom `role` oleh pengguna biasa, terlepas dari manipulasi request di sisi client.

---

## 4. Kredensial Akun Uji Coba (Demo Environment)

Akun demo dibuat secara otomatis melalui script `backend/scripts/seed-demo-accounts.mjs`:

| Role | Alamat Email | Kata Sandi | Lingkup Wewenang Utama |
| :--- | :--- | :--- | :--- |
| **Owner** | `owner@demo.local` | `Owner123!` | Akses penuh: Rapor Kesehatan Bisnis, Audit Log, Kelola Semua Staf |
| **Admin** | `admin@demo.local` | `Admin123!` | Operasional: Kelola Produk, Stok, Biaya, Kasbon, **Hanya Kelola Kasir** |
| **Kasir** | `kasir@demo.local` | `Kasir123!` | Front-line: Kasir / POS, Buka/Tutup Shift, Cetak Nota |