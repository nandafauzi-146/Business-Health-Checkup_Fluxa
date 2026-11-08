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

## Aturan Utama Pengembangan
- **Mata Uang:** Seluruh kolom uang di database dan kalkulator bisnis menggunakan tipe `integer` rupiah utuh (bukan desimal/float).
- **Integritas Transaksi:** Mutasi penjualan dan stok wajib melalui RPC Supabase (`create_sale`, `close_shift`, `void_sale`, `adjust_stock`).
- **Akses Role:** Dibagi secara ketat menggunakan Row Level Security (RLS) pada tingkat database Supabase.
- **Alur Aplikasi:** Pengguna diarahkan ke `/dashboard` setelah login; halaman operasional memakai `components/layout/app-shell.tsx` untuk navigasi bersama, dan akses transaksi dibatasi untuk Admin dan Owner.
- **Checkout Kasir:** Pembukaan shift dan checkout menggunakan RPC Supabase (`open_shift`, `create_sale`); jangan mengubah stok atau membuat transaksi langsung dari frontend.
