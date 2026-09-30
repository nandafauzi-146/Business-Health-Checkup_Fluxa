/**
 * intelligence/services/business-health/evaluator.ts
 * Aturan inferensi diagnosis kesehatan bisnis UMKM untuk menghasilkan rekomendasi aksi.
 */

import {
  FinancialHealthInput,
  FinancialHealthMetrics,
  HealthRecommendation,
  BusinessHealthDiagnosis,
} from './types';
import { calculateFinancialMetrics } from './calculator';

export function evaluateBusinessHealth(input: FinancialHealthInput): BusinessHealthDiagnosis {
  const metrics = calculateFinancialMetrics(input);
  const recommendations: HealthRecommendation[] = [];

  // Evaluasi 1: Runway Kas
  if (metrics.cash_runway_months < 1.0) {
    recommendations.push({
      category: 'CASH_FLOW',
      priority: 'URGENT',
      title: 'Krisis Likuiditas Kas Mendekat',
      diagnosis: `Cadangan kas Anda hanya mencukupi untuk operasional selama ${metrics.cash_runway_months} bulan tanpa adanya pemasukan baru.`,
      action_plan: [
        'Prioritaskan penagihan piutang/kasbon pelanggan yang telah jatuh tempo.',
        'Tunda pembelian stok non-esensial dan negosiasikan termin pembayaran ke supplier.',
        'Pisahkan rekening operasional harian dengan kas pribadi pemilik.',
      ],
    });
  } else if (metrics.cash_runway_months < 3.0) {
    recommendations.push({
      category: 'CASH_FLOW',
      priority: 'HIGH',
      title: 'Cadangan Kas di Bawah Batas Aman',
      diagnosis: `Runway kas saat ini ${metrics.cash_runway_months} bulan. Standar minimal aman UMKM adalah 3-6 bulan.`,
      action_plan: [
        'Alokasikan minimal 10-15% dari laba bersih setiap pekan ke dana darurat bisnis.',
        'Audit biaya operasional bulanan yang dapat diefisienkan.',
      ],
    });
  }

  // Evaluasi 2: Margin Profitabilitas
  if (metrics.net_profit <= 0) {
    recommendations.push({
      category: 'PROFITABILITY',
      priority: 'URGENT',
      title: 'Bisnis Beroperasi dalam Kondisi Defisit/Rugi',
      diagnosis: `Margin bersih tercatat ${metrics.net_margin_pct}%. Pengeluaran operasional dan HPP melampaui pendapatan penjualan.`,
      action_plan: [
        'Evaluasi ulang harga jual produk berpenjualan tinggi namun bermargin tipis.',
        'Hentikan sementara promosi berbiaya tinggi yang tidak mendatangkan repeat order.',
        'Periksa potensi kebocoran stok atau pemborosan bahan baku/inventaris.',
      ],
    });
  } else if (metrics.net_margin_pct < 8.0) {
    recommendations.push({
      category: 'PROFITABILITY',
      priority: 'MEDIUM',
      title: 'Margin Bersih Relatif Tipis',
      diagnosis: `Margin bersih bisnis adalah ${metrics.net_margin_pct}%. Bisnis rentan jika terjadi kenaikan harga bahan pokok.`,
      action_plan: [
        'Tingkatkan Average Order Value (AOV) dengan strategi bundling produk komplementer.',
        'Negosiasi diskon volume pembelian kepada supplier utama.',
      ],
    });
  }

  // Evaluasi 3: Piutang / Kasbon vs Kas
  if (input.receivables > input.cash_on_hand) {
    recommendations.push({
      category: 'DEBT',
      priority: 'HIGH',
      title: 'Piutang Kasbon Melebihi Cadangan Kas Riil',
      diagnosis: `Total piutang kasbon pelanggan (Rp ${input.receivables.toLocaleString('id-ID')}) lebih besar dari saldo kas fisik/bank (Rp ${input.cash_on_hand.toLocaleString('id-ID')}).`,
      action_plan: [
        'Batasi limit kasbon baru per pelanggan dan terapkan tenggat waktu ketat.',
        'Berikan insentif diskon kecil (1-2%) untuk pembayaran tunai/QRIS langsung.',
        'Kirim pengingat tagihan otomatis secara berkala.',
      ],
    });
  }

  // Evaluasi 4: Nilai Persediaan / Stok Mati
  if (input.inventory_value > input.revenue * 2 && input.revenue > 0) {
    recommendations.push({
      category: 'INVENTORY',
      priority: 'MEDIUM',
      title: 'Penumpukan Aset pada Stok Barang',
      diagnosis: 'Nilai persediaan barang lebih dari dua kali lipat omzet bulanan, berisiko menjadi dead stock.',
      action_plan: [
        'Lakukan stock opname untuk mengidentifikasi produk slow-moving.',
        'Adakan program cuci gudang / flash sale untuk memutar kembali modal kerja menjadi kas cair.',
      ],
    });
  }

  // Ringkasan Kondisi
  let summary = '';
  if (metrics.status === 'SEHAT') {
    summary = `Kesehatan bisnis tergolong SEHAT (Skor: ${metrics.health_score}/100). Likuiditas dan margin operasional berada dalam rentang positif dan stabil.`;
  } else if (metrics.status === 'WASPADA') {
    summary = `Kesehatan bisnis berada dalam status WASPADA (Skor: ${metrics.health_score}/100). Terdapat area yang memerlukan perhatian segera, terutama pengelolaan arus kas dan piutang.`;
  } else {
    summary = `Kesehatan bisnis berada dalam status KRITIS (Skor: ${metrics.health_score}/100). Segera eksekusi rencana aksi darurat arus kas dan penyesuaian biaya untuk menjaga kelangsungan usaha.`;
  }

  return {
    timestamp: new Date().toISOString(),
    input,
    metrics,
    recommendations,
    summary,
  };
}
