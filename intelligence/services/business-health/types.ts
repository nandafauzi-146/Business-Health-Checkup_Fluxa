/**
 * intelligence/services/business-health/types.ts
 * Tipe data untuk kalkulasi dan diagnosis kesehatan bisnis UMKM Fluxa (GTNIC 2026).
 * Seluruh nilai uang menggunakan integer rupiah utuh sesuai standar AGENTS.md.
 */

export interface ReceivableDetail {
  customer_name: string;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  due_date: string | null;
  created_at: string;
  days_overdue?: number;
  note?: string | null;
}

export interface ExpenseDetail {
  description: string;
  category_name?: string;
  amount: number;
  expense_date: string;
}

export interface ProductStockDetail {
  name: string;
  stock: number;
  min_stock: number;
  buy_price: number;
  sell_price: number;
  is_low_stock?: boolean;
}

export interface FinancialHealthInput {
  period_start: string;
  period_end: string;
  owner_name?: string;           // Nama pemilik dari tabel profiles (untuk sapaan personal AI)
  store_name?: string;           // Nama toko / usaha dari profil
  revenue: number;              // Total omzet penjualan (Rp)
  cogs: number;                 // Harga Pokok Penjualan / HPP (Rp)
  operating_expenses: number;   // Beban operasional: gaji, sewa, listrik, dsb (Rp)
  cash_on_hand: number;         // Kas & setara kas di tangan/bank (Rp)
  inventory_value: number;      // Nilai aset persediaan produk saat ini (Rp)
  receivables: number;          // Total piutang / kasbon belum lunas (Rp)
  payables: number;             // Total utang usaha / tagihan jatuh tempo (Rp)
  monthly_burn_rate?: number;   // Rata-rata pengeluaran kas bulanan (opsional)
  receivable_details?: ReceivableDetail[]; // Rincian kasbon konkret per pelanggan & tanggal
  expense_details?: ExpenseDetail[];       // Rincian beban operasional riil per tanggal
  product_details?: ProductStockDetail[];  // Rincian stok produk per SKU
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

export interface DimensionScore {
  dimension: string;
  score: number;
  status: 'sehat' | 'waspada' | 'kritis';
  cause: string;
  action: string;
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
  dimension_scores: DimensionScore[];
}

export interface BusinessHealthDiagnosis {
  timestamp: string;
  input: FinancialHealthInput;
  metrics: FinancialHealthMetrics;
  recommendations: HealthRecommendation[];
  summary: string;
  ai_insights?: string;
}
