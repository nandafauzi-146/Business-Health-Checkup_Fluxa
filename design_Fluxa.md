# DESIGN.md — Business Health Checkup

Panduan desain UI untuk semua peran (Admin, Kasir, Owner), diturunkan dari referensi dashboard "Shopeers". Nilai warna dan ukuran adalah estimasi dari gambar referensi, lalu disesuaikan agar konsisten dengan prototipe panel Admin.

## 1. Prinsip

1. **Bersih dan terang.** Latar abu sangat muda, kartu putih, tanpa dekorasi yang tidak membawa informasi.
2. **Satu aksen.** Biru dipakai untuk aksi utama, item aktif, dan data utama. Hijau dan merah hanya untuk arti (naik/turun, aman/bahaya).
3. **Angka dulu.** Setiap kartu punya satu angka besar, satu label, dan satu pembanding.
4. **Data bisa ditelusuri.** Setiap angka atau rekomendasi menampilkan dasar perhitungannya (sumber operasional) dan mengarah ke halaman asalnya.
5. **Peran menentukan isi, bukan gaya.** Admin, Kasir, dan Owner memakai komponen yang sama, hanya isi dan menunya berbeda.

## 2. Token warna

| Token | Light | Dark | Dipakai untuk |
|---|---|---|---|
| `--bg` | `#F1F3F7` | `#0F1218` | Latar halaman |
| `--panel` | `#FFFFFF` | `#171B24` | Kartu, sidebar, dialog |
| `--ink` | `#12141C` | `#E8EBF2` | Teks utama |
| `--mute` | `#7B8194` | `#8A92A6` | Label, keterangan, header tabel |
| `--line` | `#ECEEF4` | `#262C39` | Garis pemisah, border kartu |
| `--acc` | `#2F6BFF` | `#5B8CFF` | Tombol utama, item aktif, grafik utama |
| `--accs` | `#E8EFFF` | `#1B2848` | Latar item aktif, catatan info |
| `--ok` / `--oks` | `#1F9D63` / `#DFF5E9` | `#5FD39B` / `#143024` | Naik, aman, selesai |
| `--warn` / `--warns` | `#B26A00` / `#FDF0D5` | `#F0B04A` / `#3A2B0E` | Stok menipis, menunggu, diedit |
| `--bad` / `--bads` | `#E5484D` / `#FDE8E8` | `#FF7B80` / `#3D1C1E` | Turun, kritis, ditolak |

Warna pendukung untuk segmen data (bar bawah kartu): biru `#2F6BFF`, hijau `#2FBF85`, oranye `#F08A2B`.

Gradien hanya dipakai di dua tempat: kartu promo sidebar (`#2451D6` → `#0B1330`, 160°) dan area di bawah grafik garis (aksen dengan opasitas 30% → 0%).

## 3. Tipografi

- **Font:** Inter (fallback `system-ui, sans-serif`).
- **Skala:**

| Peran | Ukuran | Bobot |
|---|---|---|
| Judul halaman | 24 px | 700 |
| Angka KPI | 26 px | 700 |
| Angka utama kartu besar | 32 px | 700 |
| Judul kartu | 14 px | 600 |
| Teks isi | 13.5 px | 400 |
| Label, header tabel, keterangan | 11–12 px | 400–500 |

- Sentence case di semua label. Tidak memakai huruf kapital penuh.
- Angka rupiah ditulis `Rp1.250.000` (titik sebagai pemisah ribuan), tanpa desimal.

## 4. Bentuk, jarak, elevasi

- **Radius:** kartu 16 px, tombol dan input 10 px, pill/tag 7–8 px, avatar dan ikon bulat 50%, kolom pencarian 20 px.
- **Jarak:** kelipatan 4 px. Padding kartu 16–18 px, jarak antar kartu 14–16 px, padding halaman 16–24 px.
- **Elevasi:** hampir datar. Kartu memakai border 1 px `--line`, tanpa bayangan. Bayangan hanya untuk orb AI (`0 10px 24px` aksen 33%) dan toast.

## 5. Layout

```
┌───────────┬──────────────────────────────────────────┐
│ Sidebar   │ Top bar: pencarian ⌘K · tema · notif · avatar │
│ 236 px    ├──────────────────────────────────────────┤
│ sticky    │ Judul halaman        [chip tanggal] [Ekspor] │
│           │ ┌─KPI─┐┌─KPI─┐┌─KPI─┐┌─KPI─┐                │
│ promo di  │ ┌── kolom utama 1.9fr ──┐ ┌─ kolom 1fr ─┐ │
│ bawah     │ │ Kartu grafik + segmen │ │ Batang harian│ │
│           │ │ Tabel                 │ │ Gauge        │ │
│           │ │                       │ │ Asisten      │ │
└───────────┴──────────────────────────────────────────┘
```

- Lebar maksimum konten 1360 px, dipusatkan.
- Baris KPI: 4 kartu, grid otomatis (`minmax(190px, 1fr)`).
- Di bawah 860 px: sidebar menjadi bar menu horizontal yang bisa digeser, kolom menjadi satu, sembunyikan kartu promo.
- Tabel lebar dibungkus kontainer `overflow-x:auto`, halaman tidak boleh bergeser ke samping.

## 6. Komponen

### Sidebar
- Logo (kotak biru 24 px berisi ikon + nama produk) di atas.
- Menu dikelompokkan dengan judul grup kecil abu-abu. Item: ikon 16 px + label, tinggi sekitar 36 px, radius 10 px.
- **Aktif:** latar `--accs`, teks `--acc` bobot 600, garis biru 3 px di tepi kiri.
- **Badge jumlah** (mis. stok menipis): pil merah, teks putih 11 px, rata kanan.
- Kartu promo di bawah: gradien biru gelap, judul putih 14 px, satu tombol biru penuh.

### Top bar
- Kolom pencarian berbentuk pil (maks. 340 px) dengan pintasan `⌘K` di kanan.
- Kanan: tombol ikon bulat 34 px (tema, notifikasi) dan avatar (inisial atau foto).

### Header halaman
- Judul kiri. Kanan: chip rentang tanggal (border tipis, radius 10 px) dan tombol utama biru "Ekspor".

### Kartu KPI
- Baris atas: label (500) di kiri, ikon aksen di kanan.
- Angka besar 26 px, di sampingnya pill perubahan: hijau `▲ 15,5%` atau merah `▼ 10,5%`.
- Baris bawah: pembanding, mis. "vs kemarin Rp1.100.000" (11 px, `--mute`).

### Kartu grafik garis (area)
- Angka utama di kiri, grafik di kanan.
- Garis utama 2.5 px `--acc` dengan area gradien di bawahnya. Garis pembanding putus-putus abu-abu, tipis.
- Di bawahnya, kotak segmen 3 kolom: angka, label, dan bar tipis 6 px berwarna di dasar (radius atas saja).

### Grafik batang harian
- Batang bulat (radius 8 px), warna default `--bg`. Batang tertinggi biru penuh dengan label nilai di atasnya. Label hari di bawah, hari tertinggi bercetak tebal.

### Gauge setengah lingkaran
- 32 garis pendek melingkar (tebal 4 px, ujung bulat). Bagian terisi hijau, sisanya `--line`.
- Persentase besar (26 px, 700) di tengah, keterangan target di bawah.

### Tabel
- Header: 12 px, `--mute`. Baris: padding 10 px, hanya garis bawah 1 px `--line`, baris terakhir tanpa garis.
- Kolom uang rata kiri dengan format rupiah. Status memakai tag berwarna, bukan teks polos.
- Kolom produk menampilkan foto/thumbnail kecil di depan nama.

### Tag dan pill
- Ukuran 12 px, bobot 600, padding `1px 8–9px`.
- Varian: `ok` (hijau), `wr` (kuning), `bd` (merah), `nt` (biru netral).

### Tombol
- **Utama:** latar `--acc`, teks putih, radius 10 px, bobot 600.
- **Sekunder:** latar `--panel`, border `--line`, teks `--ink`.
- **Bahaya:** border dan teks `--bad`, tanpa latar.
- Ukuran kecil untuk aksi di dalam tabel: padding `3px 10px`, teks 12 px.

### Asisten AI
- Kartu dengan orb biru (radial gradient `#8FB2FF` → `#2F6BFF` → `#1636A8`, 70 px) di tengah, teks singkat, satu tombol aksi.
- Admin: hanya saran operasional dari data stok dan supplier. Owner: rekomendasi AI penuh, dasar data, dan chatbot.

### Dialog dan toast
- Dialog radius 16 px, lebar maks. 380 px, label di atas kolom isian, tombol "Batal" (sekunder) dan "Simpan" (utama) rata kanan.
- Toast gelap di kanan bawah, hilang otomatis setelah sekitar 2 detik. Teks toast mengulang nama aksi tombol ("Simpan" → "Tersimpan").

## 7. Status dan warna

| Situasi | Tampilan |
|---|---|
| Stok di atas minimum | Tag hijau "Aman" |
| Stok di bawah minimum | Tag kuning "Menipis" |
| Stok di bawah 70% minimum | Tag merah "Kritis" |
| Transaksi diedit | Tag kuning "Diedit" (tercatat di audit log) |
| Retur menunggu | Tag kuning + tombol Setujui / Tolak |
| Perubahan positif | Pill hijau `▲` |
| Perubahan negatif | Pill merah `▼` |

Arti "naik" tidak selalu baik: untuk pengeluaran dan harga supplier, kenaikan ditampilkan merah.

## 8. Peran dan menu

| Peran | Menu utama |
|---|---|
| **Admin** | Dashboard, Transaksi, Laporan harian, Produk, Kategori, Diskon hari ini, Bahan baku & pembelian, Resep, Bandingkan supplier, Retur supplier, Pengeluaran, Pengguna (hanya lihat) |
| **Kasir** | Katalog & stok (baca), Kasir/pembayaran (tunai, non-tunai), Diskon terpilih, Riwayat transaksi, Cetak struk, Input kas awal, Retur (butuh persetujuan) |
| **Owner** | Dashboard Owner, Business Health Checkup, Cashflow, Laporan bulanan, Hutang & piutang, Aset, Monitoring stok, Rekomendasi AI, Diskon hari ini, Kelola pengguna, Audit log, Chatbot |

Kartu promo di sidebar Admin menjelaskan bahwa rapor kesehatan bisnis khusus Owner. Menu yang tidak boleh diakses peran tersebut disembunyikan, bukan dinonaktifkan.

## 9. Business Health Checkup (khusus Owner)

Rapor memakai komponen yang sama dengan dashboard:

- **Skor keseluruhan** dengan gauge, plus kartu skor per dimensi: cash flow, profitabilitas, efisiensi, rantai pasok (supply chain).
- Warna skor: 80–100 hijau, 60–79 kuning, di bawah 60 merah.
- **Diagnosis:** kalimat singkat per dimensi ("Biaya bahan baku 38% dari penjualan, batas sehat 32%").
- **Resep tindakan:** daftar langkah spesifik (kurangi pemesanan bahan X, ganti supplier Y, naikkan harga produk Z).
- **Sumber data** wajib ditampilkan di setiap rekomendasi, ditelusuri dari data paling dasar: transaksi kasir → pemakaian bahan menurut resep → stok → pembelian → harga supplier → HPP → laba/rugi. Tautan "Lihat dasar perhitungan" membuka halaman asalnya.

## 10. Aksesibilitas dan gerak

- Kontras teks memenuhi WCAG AA di mode terang dan gelap.
- Fokus keyboard selalu terlihat: outline 2 px `--acc`, offset 2 px.
- Warna tidak jadi satu-satunya penanda: status selalu punya teks atau simbol (`▲`, `▼`, "Kritis").
- Gerak dibatasi: tanpa animasi masuk pada tiap kartu. Transisi hanya untuk respons tindakan (dialog terbuka, toast). Hormati `prefers-reduced-motion`.
- Target sentuh minimal 34 px untuk tombol ikon.
- Halaman mendukung area aman perangkat (`viewport-fit=cover` dan `env(safe-area-inset-*)`).

## 11. Yang dihindari

- Lebih dari satu warna aksen untuk aksi.
- Bayangan tebal dan gradien dekoratif selain yang tercantum di atas.
- Kartu berisi banyak angka tanpa hierarki (satu kartu, satu angka utama).
- Rekomendasi tanpa sumber data.
- Label tombol generik seperti "Submit". Gunakan kata kerja spesifik: "Simpan pembelian", "Setujui retur".