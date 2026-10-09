/**
 * intelligence/services/business-health/calculator.ts
 * Logika perhitungan rasio finansial UMKM dan scoring kesehatan bisnis komposit.
 */

import { FinancialHealthInput, FinancialHealthMetrics, HealthStatus } from './types';

export function calculateFinancialMetrics(input: FinancialHealthInput): FinancialHealthMetrics {
  const {
    revenue,
    cogs,
    operating_expenses,
    cash_on_hand,
    inventory_value,
    receivables,
    payables,
  } = input;

  // 1. Laba Kotor & Bersih (Rupiah integer)
  const gross_profit = Math.round(revenue - cogs);
  const net_profit = Math.round(gross_profit - operating_expenses);

  // 2. Persentase Margin (%)
  const gross_margin_pct = revenue > 0
    ? Number(((gross_profit / revenue) * 100).toFixed(1))
    : 0;

  const net_margin_pct = revenue > 0
    ? Number(((net_profit / revenue) * 100).toFixed(1))
    : 0;

  // 3. Rasio Lancar (Current Ratio)
  // Aset lancar = Kas + Nilai Stok + Piutang
  const current_assets = cash_on_hand + inventory_value + receivables;
  const current_liabilities = Math.max(payables, 1); // Hindari division by zero
  const current_ratio = Number((current_assets / current_liabilities).toFixed(2));

  // 4. Cash Runway (Bulan kas mampu menanggung beban operasional + HPP bulanan)
  const monthly_burn = input.monthly_burn_rate ?? (operating_expenses + (cogs > 0 ? cogs / 1.5 : 0));
  const cash_runway_months = monthly_burn > 0
    ? Number((cash_on_hand / monthly_burn).toFixed(1))
    : 99;

  // 5. Composite Health Score (0 - 100)
  // Bobot:
  // - Profitabilitas Bersih: 35 poin
  // - Runway Kas: 30 poin
  // - Likuiditas / Current Ratio: 20 poin
  // - Margin Kotor: 15 poin
  let score = 0;

  // Skor Net Margin (Maks 35)
  if (net_margin_pct >= 20) score += 35;
  else if (net_margin_pct >= 10) score += 28;
  else if (net_margin_pct >= 5) score += 20;
  else if (net_margin_pct > 0) score += 12;
  else score += 0;

  // Skor Cash Runway (Maks 30)
  if (cash_runway_months >= 6) score += 30;
  else if (cash_runway_months >= 3) score += 22;
  else if (cash_runway_months >= 1) score += 12;
  else score += 2;

  // Skor Current Ratio (Maks 20)
  if (current_ratio >= 2.0) score += 20;
  else if (current_ratio >= 1.5) score += 16;
  else if (current_ratio >= 1.0) score += 10;
  else score += 3;

  // Skor Gross Margin (Maks 15)
  if (gross_margin_pct >= 40) score += 15;
  else if (gross_margin_pct >= 25) score += 11;
  else if (gross_margin_pct >= 15) score += 7;
  else score += 2;

  const health_score = Math.min(100, Math.max(0, Math.round(score)));

  // Status
  let status: HealthStatus = 'SEHAT';
  if (health_score < 50) {
    status = 'KRITIS';
  } else if (health_score < 75) {
    status = 'WASPADA';
  }

  // Perhitungan 6 Dimensi Rapor Kesehatan Bisnis secara Deterministik
  // 1. Profitabilitas
  let profScore = Math.min(100, Math.max(10, Math.round((net_margin_pct * 3) + (gross_margin_pct * 0.8))));
  if (revenue <= 0) profScore = 20;

  // 2. Cash Flow
  let cfScore = Math.min(100, Math.max(10, Math.round(cash_runway_months * 18)));
  if (cash_on_hand <= 0) cfScore = 15;

  // 3. Efisiensi Biaya (Opex / Revenue)
  const opexRatio = revenue > 0 ? (operating_expenses / revenue) * 100 : 50;
  let opexScore = Math.min(100, Math.max(10, Math.round(100 - (opexRatio * 1.5))));

  // 4. Utang & Kasbon (Receivables vs Cash)
  const recRatio = cash_on_hand > 0 ? (receivables / cash_on_hand) * 100 : 100;
  let debtScore = Math.min(100, Math.max(10, Math.round(100 - (recRatio * 0.6))));

  // 5. Pertumbuhan (Didasarkan pada kapasitas omzet dan profitabilitas)
  let growthScore = Math.min(100, Math.max(20, Math.round(profScore * 0.6 + cfScore * 0.4)));

  // 6. Perputaran Stok (Turnover: Revenue / Inventory)
  const inventoryTurnover = inventory_value > 0 ? (revenue / inventory_value) : 1;
  let stockTurnoverScore = Math.min(100, Math.max(15, Math.round(inventoryTurnover * 35)));

  const dimension_scores = [
    {
      dimension: 'Profitabilitas',
      score: profScore,
      status: profScore >= 70 ? ('sehat' as const) : profScore >= 45 ? ('waspada' as const) : ('kritis' as const),
      cause: `Margin bersih ${net_margin_pct}% dan margin kotor ${gross_margin_pct}% dari total omzet.`,
      action: profScore >= 70
        ? 'Pertahankan margin laba. Evaluasi berkala produk dengan kontribusi margin terbesar.'
        : 'Tinjau ulang harga jual produk bermargin tipis dan tekan biaya pokok kulakan.'
    },
    {
      dimension: 'Cash Flow',
      score: cfScore,
      status: cfScore >= 70 ? ('sehat' as const) : cfScore >= 45 ? ('waspada' as const) : ('kritis' as const),
      cause: `Cadangan kas mampu menopang operasional selama ${cash_runway_months} bulan.`,
      action: cfScore >= 70
        ? 'Likuiditas kas sangat baik. Simpan 20% surplus ke rekening cadangan dana darurat.'
        : 'Perketat pengeluaran kas non-prioritas dan percepat penagihan piutang pelanggan.'
    },
    {
      dimension: 'Efisiensi Biaya',
      score: opexScore,
      status: opexScore >= 70 ? ('sehat' as const) : opexScore >= 45 ? ('waspada' as const) : ('kritis' as const),
      cause: `Beban operasional sebesar ${opexRatio.toFixed(1)}% dari total pendapatan penjualan.`,
      action: opexScore >= 70
        ? 'Struktur biaya operasional sangat ramping dan terkontrol dengan baik.'
        : 'Audit pos pengeluaran terbesar (sewa, listrik, logistik) dan cari opsi penghematan.'
    },
    {
      dimension: 'Utang & Kasbon',
      score: debtScore,
      status: debtScore >= 70 ? ('sehat' as const) : debtScore >= 45 ? ('waspada' as const) : ('kritis' as const),
      cause: `Total piutang kasbon pelanggan tercatat Rp ${receivables.toLocaleString('id-ID')}.`,
      action: debtScore >= 70
        ? 'Tingkat piutang terkendali terhadap saldo kas.'
        : 'Batasi plafon kasbon pelanggan dan kirimkan pengingat tagihan sebelum jatuh tempo.'
    },
    {
      dimension: 'Pertumbuhan',
      score: growthScore,
      status: growthScore >= 70 ? ('sehat' as const) : growthScore >= 45 ? ('waspada' as const) : ('kritis' as const),
      cause: `Total omzet berjalan sebesar Rp ${revenue.toLocaleString('id-ID')} dengan laba bersih Rp ${net_profit.toLocaleString('id-ID')}.`,
      action: 'Dorong repeat order melalui penawaran bundling dan optimasi produk terlaris.'
    },
    {
      dimension: 'Perputaran Stok',
      score: stockTurnoverScore,
      status: stockTurnoverScore >= 70 ? ('sehat' as const) : stockTurnoverScore >= 45 ? ('waspada' as const) : ('kritis' as const),
      cause: `Nilai persediaan barang di gudang adalah Rp ${inventory_value.toLocaleString('id-ID')}.`,
      action: stockTurnoverScore >= 70
        ? 'Perputaran stok optimal, tidak ada penumpukan barang berlebih.'
        : 'Segera lakukan clearance promo untuk barang slow-moving agar modal kembali cair.'
    }
  ];

  return {
    gross_profit,
    net_profit,
    gross_margin_pct,
    net_margin_pct,
    current_ratio,
    cash_runway_months,
    health_score,
    status,
    dimension_scores,
  };
}
