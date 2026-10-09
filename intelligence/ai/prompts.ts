/**
 * intelligence/ai/prompts.ts
 * Prompt templates untuk FluxAI — AI Business Health Checkup Advisor.
 * Didesain untuk menghasilkan analisis naratif yang luwes, elegan, profesional,
 * dan secara konkret membedah data transaksi, tanggal, serta nama debitur dari database.
 */

import { FinancialHealthInput, FinancialHealthMetrics } from '../services/business-health/types';

export const BUSINESS_HEALTH_SYSTEM_PROMPT = `
Anda adalah "Fluxa AI Business Advisor", partner strategis dan konsultan keuangan eksekutif terpercaya bagi pemilik UMKM Indonesia.

Pedoman Utama Gaya Komunikasi & Penulisan:
1. **Luwes & Mengalir Alami**: Tulis narasi dengan bahasa Indonesia bisnis yang luwes, hangat, elegan, dan solutif. Hindari kalimat kaku, formulaik, atau robotik. Berikan apresiasi atas pencapaian bisnis sebelum membedah risiko.
2. **Sapaan Personal**: Sapa pemilik usaha dengan nama lengkapnya yang berasal dari database (contoh: "Pak Budi" atau "Bu Sari"). Jangan gunakan nama generik seperti "Pemilik" atau "Owner".
3. **Kerapihan Tipografi & Struktur**:
   - Gunakan heading Markdown terstruktur (##, ###).
   - Gunakan format visual bullet points yang rapi dengan highlight tebal (**bold**).
   - Format semua angka moneter ke dalam Rupiah utuh (misal: **Rp 2.850.000**).
4. **WAJIB DATA KONKRET DARI DATABASE (Zero Hallucination)**:
   - Jika terdapat data piutang/kasbon pelanggan, Anda **HARUS menyebutkan nama pelanggan, tanggal transaksi, tanggal jatuh tempo, status keterlambatan, dan nominal sisa tagihannya secara spesifik** (contoh: *"Perhatikan tagihan atas nama Warung Bu Joko per 2 Oktober 2026 sebesar Rp 2.850.000 dengan sisa Rp 2.350.000 yang sudah melewati jatuh tempo 5 Oktober 2026"*).
   - Jika terdapat rincian pos pengeluaran operasional, sebutkan tanggal, jenis beban, dan nominal pastinya (contoh: *"Gaji kasir per 5 Oktober Rp 3.200.000"*).
   - Jika ada rincian stok barang, sebutkan nama produk konkretnya.
   - **DILARANG keras mengarang atau menduga-duga data yang tidak ada dalam laporan.** Jika suatu data kosong, katakan "belum ada catatan" — jangan menambah angka fiktif.
5. **Roadmap Taktis Terukur**: Berikan langkah aksi 7–30 hari yang realistis dan langsung dapat dieksekusi pemilik usaha tanpa membutuhkan modal tambahan yang besar.
`.trim();

export function buildDiagnosticPrompt(input: FinancialHealthInput, metrics: FinancialHealthMetrics): string {
  // Format rincian piutang / kasbon jika tersedia
  let receivablesText = 'Tidak ada catatan piutang/kasbon aktif.';
  if (input.receivable_details && input.receivable_details.length > 0) {
    receivablesText = input.receivable_details.map((r, i) => {
      const overdueInfo = r.due_date
        ? (new Date(r.due_date) < new Date() ? `[LEWAT JATUH TEMPO!]` : `Jatuh tempo: ${r.due_date}`)
        : 'Tanpa tanggal tempo';
      return `${i + 1}. Pelanggan: **${r.customer_name}** | Tanggal Transaksi: ${r.created_at.split('T')[0]} | ${overdueInfo} | Total Kasbon: Rp ${r.total_amount.toLocaleString('id-ID')} | Sisa Belum Lunas: **Rp ${r.remaining_amount.toLocaleString('id-ID')}**${r.note ? ` | Catatan: "${r.note}"` : ''}`;
    }).join('\n');
  }

  // Format rincian biaya operasional jika tersedia
  let expensesText = 'Tidak ada rincian pengeluaran tercatat.';
  if (input.expense_details && input.expense_details.length > 0) {
    expensesText = input.expense_details.map((e, i) => {
      return `${i + 1}. Tanggal: ${e.expense_date} | Kategori: ${e.category_name || 'Umum'} | Pos: **${e.description}** | Nominal: **Rp ${e.amount.toLocaleString('id-ID')}**`;
    }).join('\n');
  }

  // Format rincian produk jika tersedia
  let productsText = 'Data stok produk standar.';
  if (input.product_details && input.product_details.length > 0) {
    productsText = input.product_details.slice(0, 7).map(p => {
      return `- **${p.name}**: Stok ${p.stock} (Batas Min: ${p.min_stock}) | Modal: Rp ${p.buy_price.toLocaleString('id-ID')} | Jual: Rp ${p.sell_price.toLocaleString('id-ID')}`;
    }).join('\n');
  }

  // Tentukan sapaan personal berdasarkan nama owner dari database
  const ownerGreeting = input.owner_name && input.owner_name !== 'Pemilik'
    ? input.owner_name
    : 'Bapak/Ibu Pemilik';
  const storeName = input.store_name || 'toko';

  return `
Laporan Data Finansial ${storeName} dari Database (${input.period_start} s/d ${input.period_end}):
Pemilik Usaha: ${ownerGreeting}
=============================================================================
RINGKASAN UTAMA:
- Total Omzet Penjualan: Rp ${input.revenue.toLocaleString('id-ID')}
- Total HPP (Modal Barang): Rp ${input.cogs.toLocaleString('id-ID')}
- Total Biaya Operasional (Opex): Rp ${input.operating_expenses.toLocaleString('id-ID')}
- Saldo Kas Riil Tersedia: Rp ${input.cash_on_hand.toLocaleString('id-ID')}
- Nilai Persediaan Stok: Rp ${input.inventory_value.toLocaleString('id-ID')}
- Total Piutang / Kasbon Pelanggan: Rp ${input.receivables.toLocaleString('id-ID')}
- Total Utang Usaha: Rp ${input.payables.toLocaleString('id-ID')}

HASIL KALKULASI ENGINE RASIO:
- Laba Kotor: Rp ${metrics.gross_profit.toLocaleString('id-ID')} (Margin Kotor: ${metrics.gross_margin_pct}%)
- Laba Bersih: Rp ${metrics.net_profit.toLocaleString('id-ID')} (Margin Bersih: ${metrics.net_margin_pct}%)
- Rasio Lancar (Current Ratio): ${metrics.current_ratio}x
- Ketahanan Kas (Cash Runway): ${metrics.cash_runway_months} bulan
- Skor Kesehatan Bisnis: ${metrics.health_score}/100 (Status: ${metrics.status})

RINCIAN PIUTANG / KASBON PELANGGAN DARI DATABASE:
${receivablesText}

RINCIAN BIAYA OPERASIONAL DARI DATABASE:
${expensesText}

SAMPEL STOK PRODUK TOKO:
${productsText}

TUGAS ANDA:
Susun diagnosis naratif eksekutif yang luwes, enak dibaca, elegan, dan mendalam dengan format berikut:
1. **Salam & Evaluasi Fundamental**: Sapa **${ownerGreeting}** secara langsung dengan nama tersebut. Ulas performa omzet dan profitabilitas bisnis dengan bahasa yang hangat, memotivasi, namun objektif.
2. **Sorotan Kritis Likuiditas & Piutang (Sebutkan Data Konkret)**: Bedah anomali kas vs kasbon. SEBUTKAN SECARA EKSPLISIT nama pelanggan yang memiliki kasbon, tanggal transaksi, tanggal jatuh tempo, dan nominal pastinya. Jelaskan dampaknya terhadap cash runway bisnis.
3. **Analisis Struktur Biaya & Persediaan**: Ulas pos-pos biaya operasional riil yang tercatat (sebutkan tanggal dan jenis bebannya) serta kondisi persediaan produk.
4. **Roadmap Aksi Taktis 7–30 Hari**: Berikan 3 langkah prioritas konkret, terukur, dan berdampak langsung untuk mengamankan kas bisnis minggu ini.

PASTIKAN seluruh 4 bagian di atas ditulis tuntas dan lengkap hingga penutup yang menginspirasi (panjang optimal 500–800 kata). Jangan berhenti di tengah kalimat!
`.trim();
}
