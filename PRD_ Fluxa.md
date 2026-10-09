# PRD: Fluxa — Sistem Kasir dengan Diagnosis Kesehatan Bisnis Berbasis AI untuk UMKM

**Kompetisi:** GTNIC 2026, Kategori Web Developer **Sub-tema:** Accelerating Digital Transformation for Business and SMEs **Status dokumen:** Draft v1 — menyusul screenshot & hasil pengujian setelah frontend selesai

---

## Ringkasan

Fluxa adalah sistem kasir (POS) untuk UMKM yang datanya langsung mengalir ke modul diagnosis kesehatan bisnis berbasis AI. Alih-alih owner harus input ulang data keuangan secara manual untuk tahu kondisi usahanya, setiap transaksi di kasir otomatis membentuk "rapor kesehatan bisnis" — skor di beberapa dimensi keuangan, lengkap dengan penyebab dan saran tindakan, bukan sekadar angka mentah.

---

## Problem Statement

Pemilik UMKM umumnya tahu angka omzetnya, tapi tidak tahu apakah bisnisnya benar-benar sehat: omzet naik belum tentu untung, untung di atas kertas belum tentu ada uang tunai. Masalah ini diperparah karena tiga hal biasanya terpisah — pencatatan transaksi (kasir), pencatatan biaya/utang (manual atau tidak sama sekali), dan interpretasi kondisi bisnis (butuh kemampuan analisis keuangan yang jarang dimiliki pemilik UMKM kecil). Akibatnya keputusan bisnis sering diambil terlambat (baru sadar bermasalah saat kas benar-benar habis) atau tidak diambil sama sekali. Ini juga mempersulit akses pembiayaan, karena UMKM jarang punya catatan keuangan yang rapi untuk diajukan ke bank/koperasi.

---

## Goals

1. **Satu sumber data** — transaksi kasir otomatis jadi dasar rapor kesehatan bisnis, tanpa input ulang manual oleh owner.
2. **Diagnosis dalam \<2 menit** — owner bisa paham kondisi bisnisnya dan tindakan yang perlu diambil tanpa harus menafsirkan laporan keuangan mentah sendiri.
3. **Transaksi kasir cepat & akurat** — checkout selesai dalam hitungan detik, stok dan kas terekonsiliasi otomatis tanpa selisih yang tidak terlacak.
4. **Sistem live dan berfungsi penuh** saat penjurian GTNIC 2026 (10 November 2026), bisa dicoba langsung oleh juri dengan 3 role berbeda.
5. **Keunikan yang jelas** dibanding submission POS UMKM lain — fitur diagnosis + AI yang menjawab "jadi saya harus ngapain?", bukan cuma dashboard angka.

---

## Non-Goals

| Tidak dikerjakan | Alasan |
| --- | --- |
| Payment gateway asli (QRIS/transfer sungguhan) | Butuh approval merchant & biaya integrasi, tidak sepadan untuk timeline 6 minggu — cukup disimulasikan |
| Integrasi printer thermal / barcode scanner fisik | Di luar scope software, tidak bisa didemo lewat web browser juri |
| Multi-cabang / multi-tenant | Menambah kompleksitas skema (butuh `tenant_id` di semua tabel) tanpa menambah nilai untuk satu instance demo |
| Mode offline | Arsitektur berbeda (perlu local-first sync), di luar scope realtime Supabase yang dipakai sekarang |
| Integrasi akuntansi pihak ketiga (Accurate, Jurnal, dst.) | Di luar scope MVP, kandidat pengembangan lanjutan |
| Rekonsiliasi pajak otomatis (PPh Final, dst.) | Pernah dipertimbangkan sebagai konsep alternatif, tidak dipilih — fokus sekarang ke kesehatan finansial internal, bukan kepatuhan pajak |

---

## Persona & User Stories

### Kasir

- Sebagai kasir, saya ingin mencari produk dan menyelesaikan transaksi secepat mungkin, supaya antrean pelanggan tidak menumpuk.
- Sebagai kasir, saya ingin membuka dan menutup shift dengan pencatatan kas otomatis, supaya saya tahu persis kalau ada selisih sebelum pulang.
- Sebagai kasir, saya ingin mencatat transaksi kasbon ke pelanggan tertentu, supaya tidak perlu diingat manual.

### Admin

- Sebagai admin, saya ingin mengelola produk, harga, dan stok, supaya katalog kasir selalu akurat.
- Sebagai admin, saya ingin melihat dan menindaklanjuti stok yang menipis, supaya tidak kehabisan barang populer.
- Sebagai admin, saya ingin mencatat biaya operasional bulanan, supaya data ini ikut masuk ke perhitungan kesehatan bisnis.
- Sebagai admin, saya ingin membatalkan (void) transaksi yang salah input, supaya stok dan kas kembali konsisten tanpa saya edit data secara manual.

### Owner

- Sebagai owner, saya ingin melihat rapor kesehatan bisnis bulanan dengan skor per dimensi, supaya saya tahu area mana yang perlu perhatian.
- Sebagai owner, saya ingin tahu **penyebab** skor saya rendah dan **saran tindakan**-nya, bukan cuma angka, supaya saya tahu harus ngapain.
- Sebagai owner, saya ingin melihat tren skor dari bulan ke bulan, supaya saya tahu apakah tindakan yang saya ambil sebelumnya berhasil.
- Sebagai owner, saya ingin sistem tetap memberi rekomendasi meskipun layanan AI sedang gagal/timeout, supaya rapor tidak kosong saat dibutuhkan.
- Sebagai owner, saya ingin melihat audit log siapa melakukan apa, supaya saya bisa mendeteksi kejanggalan operasional.

---

## Requirements

### P0 — Must-Have

| # | Requirement | Acceptance Criteria |
| --- | --- | --- |
| 1 | Autentikasi + 3 role (kasir/admin/owner) dengan hak akses dipaksa di level database | Given akun dengan role kasir, When mengakses data `expenses` lewat API, Then hasilnya kosong/ditolak (bukan cuma disembunyikan di UI) — **sudah diuji & lulus** |
| 2 | Transaksi penjualan atomik | Given stok produk tersedia, When kasir checkout, Then stok berkurang, item tersimpan dengan harga ter-snapshot, dan kas/piutang terbentuk sesuai metode bayar — dalam satu transaksi database (tidak ada state setengah jalan) — **sudah diuji & lulus** |
| 3 | Shift kasir dengan rekonsiliasi kas otomatis | Given shift dibuka dengan kas awal, When shift ditutup dengan input kas fisik, Then sistem menghitung selisih otomatis (kas fisik − kas sistem) — **sudah diuji & lulus** |
| 4 | Void transaksi (admin/owner) | Given transaksi valid, When admin/owner void dengan alasan, Then stok dikembalikan dan piutang terkait (jika ada) ditandai void — **sudah diuji & lulus** |
| 5 | Manajemen produk & stok | CRUD produk oleh admin/owner; stok masuk & koreksi opname lewat fungsi terpisah (`adjust_stock`), bukan update langsung — **sudah diuji & lulus** |
| 6 | Biaya operasional & kasbon/piutang | Admin/owner bisa mencatat biaya bulanan dan melihat piutang pelanggan dengan jatuh tempo |
| 7 | Engine skor kesehatan bisnis (6 dimensi) | Profitabilitas, cash flow, efisiensi biaya, utang, pertumbuhan, perputaran stok/piutang — dihitung dari data transaksi otomatis, bukan input manual |
| 8 | Rekomendasi rule-based | Tiap skor rendah disertai penyebab spesifik dan saran tindakan konkret, bukan generik |
| 9 | AI Business Advisor dengan fallback | Given layanan AI gagal/timeout, When owner membuka rapor, Then tetap tampil rekomendasi dari engine rule-based (bukan error atau halaman kosong) |
| 10 | Dashboard Owner | Radar chart skor per dimensi + tren bulanan |
| 11 | Deploy live & teruji lintas role | Juri bisa login sebagai kasir/admin/owner dan menyelesaikan alur masing-masing tanpa error |

### P1 — Nice-to-Have

| # | Requirement |
| --- | --- |
| 12 | Forecast omzet & kas 30 hari ke depan (moving average/regresi sederhana) |
| 13 | Deteksi anomali kasir (z-score dari selisih kas & frekuensi void) |
| 14 | Export rapor kesehatan ke PDF |
| 15 | Alert stok menipis otomatis di dashboard admin |

### P2 — Future Considerations

| # | Requirement | Catatan desain |
| --- | --- | --- |
| 16 | "Tanya Bisnis" — chat berbasis data (function calling ke query internal) | Paling tinggi kesan "wow" di demo, tapi dikerjakan paling akhir karena butuh P0 stabil dulu |
| 17 | Simulasi what-if ("kalau harga naik 10%?") | Engine hitung, LLM jelaskan dampaknya |
| 18 | Benchmark sektor (bandingkan skor dengan rata-rata jenis usaha sejenis) | Butuh data referensi yang kredibel, dicatat sumbernya |
| 19 | Multi-cabang | Perlu `tenant_id`/`branch_id` di skema — perubahan struktural, bukan tambahan fitur kecil |
| 20 | Payment gateway & printer sungguhan | Lihat Non-Goals |

---

## Success Metrics

**Untuk konteks kompetisi** (bukan produk live dengan pengguna nyata), metrik suksesnya direframe jadi dua lapis:

**Indikator kesiapan submission (sebelum 10 Nov 2026):**

- 14 tabel ter-deploy dengan RLS aktif di seluruhnya — ✅ sudah tercapai
- 3 akun demo bisa login dan menyelesaikan alur masing-masing tanpa error
- Seluruh requirement P0 selesai dan teruji di versi live, bukan cuma di lokal
- Proposal, video demo, dan surat keaslian terkumpul sesuai format panitia

**Indikator kualitas produk (bisa dicek owner tim sendiri sebelum submit):**

- Waktu checkout kasir (dari buka produk sampai transaksi selesai) terasa cepat secara subjektif saat didemo — tidak ada target angka presisi, cukup diuji langsung oleh tim
- Rekomendasi di rapor kesehatan terasa spesifik dan actionable saat dibaca orang yang bukan tim pengembang (test dengan menunjukkan ke teman/dosen)

**Kalau dilanjutkan pasca-kompetisi** (bukan scope kompetisi, dicatat untuk konteks jangka panjang): adopsi UMKM nyata, retensi pemakaian rapor bulanan, dan apakah rekomendasi yang diberikan benar-benar diikuti ownernya.

---

## Technical Architecture (Ringkas)

Detail lengkap ada di `db-schema/README.md`, `AGENTS.md`, dan `STRUKTUR_FOLDER.md` — bagian ini cuma peta tingkat tinggi.

- **Frontend:** Next.js (App Router) + Tailwind CSS, folder domain terpisah (`frontend/`, `backend/`, `intelligence/`) di root project
- **Backend:** Supabase (PostgreSQL + Auth + Row Level Security) — 14 tabel, 9 file migrasi, semua RLS dan fungsi transaksi (`create_sale`, `close_shift`, `void_sale`, `adjust_stock`) sudah ditulis dan **diuji end-to-end lokal** (bukan cuma ditulis lalu diasumsikan benar)
- **AI:** Dipanggil dari Route Handler server-side (key tidak pernah di browser), dengan fallback wajib ke rule-based kalau API gagal
- **Hosting:** Vercel (aplikasi) + Supabase (database), keduanya tier gratis

### Keputusan Arsitektur Penting

- Tabel transaksi (`sales`, `sale_items`, `stock_movements`) sengaja tidak punya akses tulis langsung dari client — satu-satunya jalur adalah RPC, supaya validasi stok dan kas selalu konsisten.
- Uang disimpan sebagai integer (rupiah utuh), bukan desimal.
- View laporan finansial pakai `security_invoker`, sehingga RLS otomatis berlaku saat role yang tidak berhak query — tidak perlu RLS terpisah di level view.

---

## Timeline & Phasing

| Minggu | Fokus | Status |
| --- | --- | --- |
| 1 (28 Sep–4 Okt) | Fondasi: skema database, auth 3 role, deploy kosong | ✅ Skema & auth selesai dan teruji |
| 2 (5–11 Okt) | Inti POS: produk, stok, transaksi | Fungsi backend selesai; UI kasir belum |
| 3 (12–18 Okt) | Operasional: shift, biaya, kasbon, audit log | Fungsi backend selesai |
| 4 (19–25 Okt) | Kecerdasan: AI Advisor, forecast, anomali | Belum dimulai |
| 5 (26 Okt–1 Nov) | Dashboard & polish, feature freeze | Belum dimulai |
| 6 (2–9 Nov) | Bug fixing, proposal, video, submit | Belum dimulai |

Rincian jobdesk per anggota tim (A/B/C) dan tracker tugas harian ada di file spreadsheet terpisah (`GTNIC2026_Timeline_Jobdesk_Tracker.xlsx`).

---

## Open Questions

| Pertanyaan | Siapa yang jawab | Blocking? |
| --- | --- | --- |
| Nama tim final untuk pendaftaran Google Form & nama file proposal | Tim | Ya, sebelum submit |
| Provider LLM yang dipakai (Gemini/Groq, dsb.) dan siapa yang pegang API key-nya | A | Ya, sebelum mulai Minggu 4 |
| Tempo kasbon default 14 hari — sudah sesuai kebiasaan UMKM yang jadi target demo? | Tim/Owner (pemilik produk) | Tidak, bisa disesuaikan kapan saja via parameter |
| Logo final Fluxa (dari 3 konsep yang sudah digambar) | Tim | Tidak, tapi perlu selesai sebelum cover proposal dibuat |
| Siapa personil asli di balik peran A/B/C untuk diisi di dokumen tim | Tim | Ya, sebelum proposal & Google Form disusun |

---

## Appendix: Status Implementasi Saat Ini

Snapshot jujur per dokumen ini dibuat, supaya tidak ada asumsi keliru soal apa yang sudah/belum jalan:

**Sudah selesai & teruji:**

- Skema database lengkap (14 tabel), RLS per role, 4 fungsi transaksi (`create_sale`, `close_shift`, `void_sale`, `adjust_stock`) — diuji lewat 8+ skenario end-to-end termasuk percobaan pelanggaran akses yang berhasil ditolak sistem
- Struktur folder project (`app/`, `frontend/`, `backend/`, `intelligence/`)
- Koneksi Supabase (client/server/middleware) dan proteksi route per role di layout — kode kerja, bukan placeholder
- Halaman login — form asli, bisa dites dengan akun demo

**Belum dikerjakan (masih placeholder berlabel "punya siapa"):**

- Seluruh komponen UI di `frontend/components/` (kasir, admin, owner)
- Seluruh isi `intelligence/` (scoring, forecast, anomaly, ai-advisor)
- Endpoint `app/api/ai/diagnosis/route.ts` (ada kerangka TODO, belum logic)
- `backend/actions/` dan `backend/queries/`

Dokumen ini akan diperbarui begitu bagian-bagian di atas selesai, termasuk menambahkan screenshot antarmuka untuk keperluan proposal GTNIC.