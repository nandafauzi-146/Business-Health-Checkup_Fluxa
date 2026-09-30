/**
 * intelligence/services/business-health/types.ts
 * Tipe data untuk kalkulasi dan diagnosis kesehatan bisnis UMKM Fluxa (GTNIC 2026).
 * Seluruh nilai uang menggunakan integer rupiah utuh sesuai standar AGENTS.md.
 */

export interface FinancialHealthInput {
  period_start: string;
  period_end: string;
  revenue: number;              // Total omzet penjualan (Rp)
  cogs: number;                 // Harga Pokok Penjualan / HPP (Rp)
  operating_expenses: number;   // Beban operasional: gaji, sewa, listrik, dsb (Rp)
  cash_on_hand: number;         // Kas & setara kas di tangan/bank (Rp)
  inventory_value: number;      // Nilai aset persediaan produk saat ini (Rp)
  receivables: number;          // Total piutang / kasbon belum lunas (Rp)
  payables: number;             // Total utang usaha / tagihan jatuh tempo (Rp)
  monthly_burn_rate?: number;   // Rata-rata pengeluaran kas bulanan (opsional)
}

export type HealthStatus = 'SEHAT' | 'WASPADA' | 'KRITIS';

export type RecommendationCategory = 'CASH_FLOW' | 'PROFITABILITY' | 'INVENTORY' | 'DEBT';
export type RecommendationPriority = 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface HealthRecommendation {
  category: RecommendationCategory;
  priority: RecommendationPriority;
  title: string;
  diagnosis: string;
  action_plan: string[];
}

export interface FinancialHealthMetrics {
  gross_profit: number;         // Laba kotor = Revenue - COGS
  net_profit: number;           // Laba bersih = Gross Profit - Operating Expenses
  gross_margin_pct: number;     // Gross Profit Margin (%)
  net_margin_pct: number;       // Net Profit Margin (%)
  current_ratio: number;        // Rasio lancar (Aset Lancar / Liabilitas Lancar)
  cash_runway_months: number;   // Daya tahan kas tanpa pemasukan (bulan)
  health_score: number;         // Skor kesehatan bisnis komposit (0 - 100)
  status: HealthStatus;
}

export interface BusinessHealthDiagnosis {
  timestamp: string;
  input: FinancialHealthInput;
  metrics: FinancialHealthMetrics;
  recommendations: HealthRecommendation[];
  summary: string;
  ai_insights?: string;
}
