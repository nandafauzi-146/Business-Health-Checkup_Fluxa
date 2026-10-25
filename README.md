# Fluxa — POS & Business Health Checkup for UMKM (GTNIC 2026)

Fluxa adalah platform sistem kasir pintar (Point of Sales) dan diagnosis kesehatan bisnis otomatis untuk UMKM, dirancang untuk kompetisi GTNIC 2026 kategori Web Developer.

---

## Arsitektur 4-Pilar Modular

```
fluxa/
├── frontend/                     # Pilar 1: Aplikasi Web Next.js (App Router)
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
├── backend/                      # Pilar 2: Service Layer & Supabase Adapters
│   ├── index.ts                  # Barrel export (@backend/*)
│   ├── supabase/
│   │   ├── admin.ts              # getSupabaseAdminClient — SATU-SATUNYA akses service role
│   │   └── types.ts              # Re-export backward-compat → database/types
│   ├── services/
│   │   └── financial-context.service.ts  # Agregasi data finansial bisnis dari Supabase
│   └── scripts/
│       └── seed-demo-accounts.mjs        # Inisialisasi 3 akun demo (Owner, Admin, Kasir)
│
├── intelligence/                 # Pilar 3: Mesin Diagnosis Kesehatan Bisnis & AI Advisor
│   ├── index.ts                  # Barrel export (@intelligence/*)
│   ├── ai/
│   │   ├── client.ts             # Google Gemini client wrapper
│   │   ├── prompts.ts            # System prompt & template diagnosis eksekutif
│   │   └── chat.ts               # FluxAI conversational assistant & context builder
│   └── services/business-health/
│       ├── types.ts              # Interface finansial & metrik 6 dimensi
│       ├── calculator.ts         # Kalkulasi margin, current ratio, runway, skor komposit
│       └── evaluator.ts          # Rules engine diagnosis & rekomendasi aksi taktis
│
└── database/                     # Pilar 4: Skema, Migrasi SQL & Tipe Database
    ├── types/
    │   └── index.ts              # Kanonik tipe Database & Json (@database/types)
    └── supabase/
        ├── migrations/           # 27 file migrasi SQL terurut (0001 s/d 0027)
        ├── seed.sql              # Data dummy untuk lingkungan pengembangan
        └── combined_setup.sql    # Skrip inisialisasi menyeluruh (dev only)
```

**Arah dependency yang benar:**
```
frontend  →  backend  →  intelligence
                      →  database
```
`intelligence/` dan `database/` tidak boleh mengimpor dari `backend/` atau `frontend/app`.

---

## Menjalankan Proyek

### 1. Server Development
```bash
npm run dev
```
Aplikasi frontend aktif di [http://localhost:3000](http://localhost:3000).

### 2. Build Produksi
```bash
npm run build
```

### 3. Inisialisasi Akun Demo
Membuat / memperbarui 3 akun demo ke database Supabase:
```bash
npm run seed:accounts
```

### Kredensial Akun Demo
| Role | Email | Password |
|---|---|---|
| **Owner** | `owner@demo.local` | `Owner123!` |
| **Admin** | `admin@demo.local` | `Admin123!` |
| **Kasir** | `kasir@demo.local` | `Kasir123!` |

---

## Panduan Pengembangan

### Migrasi Database

Migrasi SQL berada di `database/supabase/migrations/` dengan urutan `0001` s/d `0027`:

| File | Isi |
|---|---|
| `0001` | Extensions (UUID, pgcrypto) |
| `0002` | Tabel utama (profiles, products, shifts, sales, dll) |
| `0003` | Indexes performa query |
| `0004` | Helper functions |
| `0005` | Triggers audit & stok |
| `0006` | Business functions (RPC: create_sale, close_shift, void_sale) |
| `0007` | Row Level Security policies |
| `0008` | Views (v_monthly_revenue_cogs, dll) |
| `0009` | Adjust stock RPC |
| `0010` | Promotions |
| `0011` | Refund requests |
| `0012` | Product image_url |
| `0013` | Supplier payables |
| `0014` | Disable customer receivables |
| `0015` | Business debt & receivables |
| `0016` | Comprehensive audit logging |
| `0017` | Email field di profiles |
| `0018` | Registration approval & trials |
| `0019` | Security & transaction integrity (atomik checkout, void, refund) |
| `0020` | Refund approval workflow |
| `0021` | Debt categories |
| `0022` | Subscriptions & Midtrans payment |
| `0023` | Platform withdrawals |
| `0024` | Platform expenses & reporting |
| `0025` | Registration path & auto approve |
| `0026` | Landing CMS content |
| `0027` | Security hardening |

**Aturan migrasi:**
- Jangan ubah migrasi yang sudah diterapkan di database bersama (production/staging) — buat file baru.
- Nomor migrasi harus unik. Migrasi terakhir saat ini: `0027`.
- `combined_setup.sql` hanya untuk setup lokal — jangan jalankan di produksi.

### Registrasi, Persetujuan, dan Trial

Pendaftaran publik membuat akun Owner berstatus menunggu persetujuan; trial 7 hari mulai dihitung ketika Super Admin menyetujui akun di `/super-admin`.

Untuk bootstrap Super Admin pertama, jalankan sekali di SQL Editor Supabase:
```sql
update public.profiles
set role = 'super_admin', approval_status = 'approved'
where email = 'operator@example.com';
```

### Paket, Pembayaran, dan Subscription (Midtrans)

Buat paket berbayar melalui `/super-admin/paket`; Owner memilih paket di `/langganan`. Pembayaran diproses via Snap Midtrans dengan webhook tervalidasi. Tambahkan di environment server:
```env
MIDTRANS_SERVER_KEY=SB-Mid-server-...
MIDTRANS_IS_PRODUCTION=false
```
Laporan keuangan platform tersedia di `/super-admin/keuangan` dan dapat diekspor ke CSV.

### Super Admin Console

Tersedia di `/super-admin`: ringkasan platform, manajemen pengguna, persetujuan pendaftaran, pengelolaan trial, audit log, dan profil operator. Setiap perubahan role, status auth, dan persetujuan dicatat di tabel `audit_logs`.

---

## Aturan Utama

| Topik | Aturan |
|---|---|
| **Mata Uang** | Semua kolom uang di database & kalkulator menggunakan `integer` rupiah utuh (bukan float) |
| **Transaksi** | Mutasi penjualan & stok wajib via RPC Supabase (`create_sale`, `close_shift`, `void_sale`, `adjust_stock`) |
| **Akses Role** | Dibagi ketat via Row Level Security (RLS) pada tingkat database Supabase |
| **Service Role Key** | Hanya boleh diakses melalui `backend/supabase/admin.ts` — jangan pernah `NEXT_PUBLIC_*` |
| **Tipe Database** | Import dari `@database/types` (kanonik) atau `@backend/index` (backward compat) |
| **Modul Server** | `backend/` dan `intelligence/` hanya dijalankan di Node.js — tidak masuk bundle browser |
| **AI & Angka** | Kalkulator TypeScript selalu menjadi sumber angka; AI digunakan untuk narasi & rekomendasi, bukan kalkulasi |
