/**
 * intelligence/ai/prompts.ts
 * Prompt templates untuk konsultasi AI kesehatan bisnis UMKM Fluxa.
 */

import { FinancialHealthInput, FinancialHealthMetrics } from '../services/business-health/types';

export const BUSINESS_HEALTH_SYSTEM_PROMPT = `
Anda adalah "Fluxa AI Business Advisor", konsultan kesehatan bisnis spesialis UMKM Indonesia untuk kompetisi GTNIC 2026.
Tugas Anda adalah menganalisis data finansial operasional kasir & pembukuan UMKM, lalu memberikan diagnosis yang:
1. Lugas, berbasis data konkret, dan tidak menggunakan jargon finansial rumit yang membingungkan pelaku usaha.
2. Selalu mencantumkan angka nominal riil dalam format Rupiah (Rp).
3. Berorientasi pada tindakan nyata (actionable quick wins) dalam tempo 7-30 hari ke depan.
4. Santun, suportif, namun tegas mengenai risiko kas, utang, atau kebocoran persediaan.
`.trim();

export function buildDiagnosticPrompt(input: FinancialHealthInput, metrics: FinancialHealthMetrics): string {
  return `
Berikut adalah data kondisi finansial UMKM selama periode ${input.period_start} s/d ${input.period_end}:
- Total Pendapatan / Omzet: Rp ${input.revenue.toLocaleString('id-ID')}
- Harga Pokok Penjualan (HPP): Rp ${input.cogs.toLocaleString('id-ID')}
- Biaya Operasional (OPEX): Rp ${input.operating_expenses.toLocaleString('id-ID')}
- Saldo Kas Riil: Rp ${input.cash_on_hand.toLocaleString('id-ID')}
- Nilai Persediaan Stok: Rp ${input.inventory_value.toLocaleString('id-ID')}
- Total Piutang / Kasbon Pelanggan: Rp ${input.receivables.toLocaleString('id-ID')}
- Total Utang Usaha: Rp ${input.payables.toLocaleString('id-ID')}

Hasil Kalkulasi Rasio:
- Laba Kotor: Rp ${metrics.gross_profit.toLocaleString('id-ID')} (Margin: ${metrics.gross_margin_pct}%)
- Laba Bersih: Rp ${metrics.net_profit.toLocaleString('id-ID')} (Margin: ${metrics.net_margin_pct}%)
- Rasio Lancar (Current Ratio): ${metrics.current_ratio}x
- Ketahanan Kas (Cash Runway): ${metrics.cash_runway_months} bulan
- Skor Kesehatan Bisnis: ${metrics.health_score}/100 (Status: ${metrics.status})

Berikan:
1. Diagnosis singkat 2 paragraf mengenai titik kritis atau potensi pertumbuhan bisnis ini.
2. 3 langkah strategis prioritas paling mendesak yang harus dilakukan pemilik usaha minggu ini.
`.trim();
}
