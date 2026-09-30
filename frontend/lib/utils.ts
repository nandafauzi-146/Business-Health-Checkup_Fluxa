/**
 * frontend/lib/utils.ts
 * Utility helper functions untuk frontend Fluxa.
 */

/**
 * Format angka integer rupiah ke format mata uang Indonesia (contoh: Rp 50.000).
 */
export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Menggabungkan beberapa class string dengan aman.
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
