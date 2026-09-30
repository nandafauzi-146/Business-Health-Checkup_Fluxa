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

  return {
    gross_profit,
    net_profit,
    gross_margin_pct,
    net_margin_pct,
    current_ratio,
    cash_runway_months,
    health_score,
    status,
  };
}
