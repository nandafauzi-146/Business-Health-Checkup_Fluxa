# Fluxa — POS & Business Health Checkup for UMKM (GTNIC 2026)

Fluxa adalah platform sistem kasir pintar (Point of Sales) dan diagnosis kesehatan bisnis otomatis untuk UMKM, dirancang untuk kompetisi GTNIC 2026 kategori Web Developer.

---

## Arsitektur 3-Pilar Modular

Proyek ini disusun secara terorganisir ke dalam 3 pilar utama:

```
fluxa/
├── frontend/                     # Pilar 1: Aplikasi Web Next.js (App Router + Tailwind)
│   ├── app/                      # Halaman, layouts, dan API route handlers
│   │   ├── api/business-health/  # Endpoint evaluasi kesehatan bisnis via Intelligence
│   │   ├── dashboard/            # Dashboard operasional setelah login
│   │   ├── cashier/              # Halaman POS kasir
│   │   ├── admin/transactions/   # Riwayat transaksi Admin dan Owner
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── globals.css
│   ├── components/               # Komponen UI & Layout
│   │   ├── ui/                   # Button, Card, Dialog, Badge, Input, dll.
│   │   └── layout/               # AppShell untuk sidebar dan header bersama
│   ├── features/                 # Logika antarmuka per modul fungsional
│   │   ├── cashier/              # Terminal POS, keranjang, checkout melalui RPC
│   │   ├── products/             # Manajemen katalog produk & stok
│   │   ├── owner/                # Dashboard eksekutif & rapor finansial owner
│   │   ├── auth/                 # Form login & penanganan sesi
│   │   └── reports/              # Laporan penjualan, kasbon, dan laba kotor
│   ├── lib/                      # Helper library & Supabase SSR client
│   │   ├── supabase/             # client.ts, server.ts, middleware.ts, types.ts
│   │   └── utils.ts              # Format mata uang Rupiah, classnames merge
│   ├── public/                   # Static assets & icons
│   └── middleware.ts             # Middleware proteksi route & refresh sesi JWT Supabase
│
├── backend/                      # Pilar 2: Database Supabase & Data Engine
│   ├── supabase/
│   │   ├── migrations/           # File migrasi terurut (0001_... s/d 0009_...)
│   │   ├── seed.sql              # Data dummy produk, kategori, pelanggan
│   │   ├── combined_setup.sql    # Skrip inisialisasi menyeluruh
│   │   └── types.ts              # TypeScript Database Schema Types
│   └── scripts/
│       └── seed-demo-accounts.mjs# Script inisialisasi akun demo (Owner, Admin, Kasir)
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

---

## Aturan Utama Pengembangan
- **Mata Uang:** Seluruh kolom uang di database dan kalkulator bisnis menggunakan tipe `integer` rupiah utuh (bukan desimal/float).
- **Integritas Transaksi:** Mutasi penjualan dan stok wajib melalui RPC Supabase (`create_sale`, `close_shift`, `void_sale`, `adjust_stock`).
- **Akses Role:** Dibagi secara ketat menggunakan Row Level Security (RLS) pada tingkat database Supabase.
- **Alur Aplikasi:** Pengguna diarahkan ke `/dashboard` setelah login; halaman operasional memakai `components/layout/app-shell.tsx` untuk navigasi bersama, dan akses transaksi dibatasi untuk Admin dan Owner.
- **Checkout Kasir:** Pembukaan shift dan checkout menggunakan RPC Supabase (`open_shift`, `create_sale`); jangan mengubah stok atau membuat transaksi langsung dari frontend.
