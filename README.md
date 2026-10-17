# Fluxa — POS & Business Health Checkup for UMKM (GTNIC 2026)

Fluxa adalah platform sistem kasir pintar (Point of Sales) dan diagnosis kesehatan bisnis otomatis untuk UMKM, dirancang untuk kompetisi GTNIC 2026 kategori Web Developer.

---

## Arsitektur 3-Pilar Modular

Proyek ini disusun secara terorganisir ke dalam 3 pilar utama:

```
fluxa/
├── frontend/                     # Pilar 1: Aplikasi Web Next.js (App Router + Tailwind)
│   ├── app/                      # Route groups Next.js App Router & API handlers
│   │   ├── (admin)/admin/        # Modul operasional toko Admin (produk, stok, transaksi, biaya, dll.)
│   │   ├── (kasir)/kasir/        # Antarmuka kasir POS cepat & responsif
│   │   ├── (owner)/owner/        # Dashboard eksekutif Owner, cashflow, laporan, & rapor kesehatan AI
│   │   ├── (auth)/               # Halaman login & pendaftaran owner (trial 7 hari)
│   │   ├── (super-admin)/        # Panel super-admin untuk verifikasi & persetujuan registrasi
│   │   ├── api/                  # Route handlers: AI chat, business health, promotions, users, kasir
│   │   ├── landingpage/          # Landing page modern & interaktif
│   │   ├── layout.tsx            # Root layout dengan Inter font & ThemeProvider
│   │   └── page.tsx              # Root URL controller (landing page tamu / redirect dashboard)
│   ├── components/               # Komponen antarmuka modular
│   │   ├── admin/                # Komponen fitur Admin (Produk, Stok, Diskon, Kategori, Transaksi)
│   │   ├── auth/                 # Form login, registrasi, visual otentikasi, approval registrasi
│   │   ├── layout/               # Sidebar, Topbar, ThemeProvider, role-navigation
│   │   ├── owner/                # Dashboard finansial, grafik performa, AI chat, audit log
│   │   ├── pos/                  # Terminal POS, modal kas masuk, riwayat penjualan, shift
│   │   └── ui/                   # Komponen sistem desain (Cards, BrandLogo, StatusTag)
│   ├── data/                     # Fallback data lokal terstruktur (promotions.json)
│   ├── lib/                      # Helper & Supabase SSR Client (@supabase/ssr)
│   │   ├── supabase/             # client.ts, server.ts, middleware.ts, types.ts
│   │   └── utils.ts              # Format mata uang Rupiah & utilitas
│   ├── public/                   # Aset produksi statis (Fluxa-Logo.webp)
│   └── proxy.ts                  # Next.js 16 session proxy / refresh handler
│
├── backend/                      # Pilar 2: Database Supabase & Data Engine
│   ├── supabase/
│   │   ├── migrations/           # File migrasi terurut (0001_... s/d 0018_...)
│   │   ├── seed.sql              # Data dummy produk, kategori, pelanggan, transaksi
│   │   ├── combined_setup.sql    # Skrip inisialisasi menyeluruh
│   │   └── types.ts              # TypeScript Database Schema Types
│   └── scripts/
│       └── seed-demo-accounts.mjs# Script inisialisasi 3 akun demo (Owner, Admin, Kasir)
│
└── intelligence/                 # Pilar 3: Mesin Diagnosis Kesehatan Bisnis & AI Advisor
    ├── services/business-health/
    │   ├── types.ts              # Interface input finansial & metrik diagnosis
    │   ├── calculator.ts         # Kalkulator margin, current ratio, runway kas, dan skor kesehatan
    │   └── evaluator.ts          # Rules engine diagnosis & pembuatan rekomendasi aksi terarah
    ├── ai/
    │   ├── prompts.ts            # System prompt & template prompt UMKM advisor
    │   └── client.ts             # AI client wrapper dengan fallback analisis heuristik cerdas
    └── index.ts                  # Public API barrel export modul intelligence
```

---

## Menjalankan Proyek

### 1. Menjalankan Server Development
```bash
npm run dev
```
Aplikasi frontend akan aktif di [http://localhost:3000](http://localhost:3000).

### 2. Membangun Aplikasi untuk Produksi
```bash
npm run build
```

### 3. Inisialisasi Akun Demo
Membuat / memperbarui 3 akun demo (Owner, Admin, Kasir) ke database Supabase:
```bash
npm run seed:accounts
```

### Kredensial Akun Demo
| Role | Email | Password |
|---|---|---|
| **Owner** | `owner@demo.local` | `Owner123!` |
| **Admin** | `admin@demo.local` | `Admin123!` |
| **Kasir** | `kasir@demo.local` | `Kasir123!` |

### Registrasi, Persetujuan, dan Trial
Jalankan migrasi `backend/supabase/migrations/0013_registration_approval_trials.sql` pada proyek Supabase. Pendaftaran publik membuat akun Owner berstatus menunggu persetujuan; trial 7 hari mulai dihitung ketika Super Admin menyetujui akun di `/super-admin`.

Untuk bootstrap Super Admin pertama, buat atau gunakan akun operator di Supabase Auth, lalu jalankan sekali di SQL Editor dengan email akun tersebut:
```sql
update public.profiles
set role = 'super_admin', approval_status = 'approved'
where email = 'operator@example.com';
```
Simpan `SUPABASE_SERVICE_ROLE_KEY` hanya di environment server aplikasi. Jangan pernah mengeksposnya sebagai variabel `NEXT_PUBLIC_*`.

---

## Aturan Utama Pengembangan
- **Mata Uang:** Seluruh kolom uang di database dan kalkulator bisnis menggunakan tipe `integer` rupiah utuh (bukan desimal/float).
- **Integritas Transaksi:** Mutasi penjualan dan stok wajib melalui RPC Supabase (`create_sale`, `close_shift`, `void_sale`, `adjust_stock`).
- **Akses Role:** Dibagi secara ketat menggunakan Row Level Security (RLS) pada tingkat database Supabase.
- **Alur Aplikasi:** Pengguna diarahkan ke `/dashboard` setelah login; halaman operasional memakai `components/layout/app-shell.tsx` untuk navigasi bersama, dan akses transaksi dibatasi untuk Admin dan Owner.
- **Checkout Kasir:** Pembukaan shift dan checkout menggunakan RPC Supabase (`open_shift`, `create_sale`); jangan mengubah stok atau membuat transaksi langsung dari frontend.
