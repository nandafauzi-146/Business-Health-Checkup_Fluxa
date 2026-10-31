'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

export const ROUTE_TITLE_MAP: Record<string, string> = {
  // Sebelum Login & Publik
  '/': 'Kasir & Analisis Kesehatan Bisnis',
  '/login': 'Masuk',
  '/register': 'Registrasi',
  '/pending': 'Menunggu Persetujuan',
  '/langganan': 'Langganan',
  '/payment/finish': 'Pembayaran Berhasil',

  // Kasir
  '/kasir': 'Kasir',
  '/kasir/riwayat': 'Riwayat Transaksi',
  '/kasir/shift': 'Shift',

  // Admin
  '/admin': 'Dashboard',
  '/admin/transaksi': 'Transaksi',
  '/admin/shift': 'Shift',
  '/admin/produk': 'Produk',
  '/admin/bahan-baku': 'Bahan Baku',
  '/admin/stok': 'Inventaris',
  '/admin/kategori': 'Kategori Produk',
  '/admin/diskon': 'Diskon & Promo',
  '/admin/biaya': 'Biaya Operasional',
  '/admin/biaya/kategori': 'Kategori Biaya',
  '/admin/hutang-piutang': 'Hutang & Piutang',
  '/admin/hutang-piutang/kategori': 'Kategori Hutang & Piutang',
  '/admin/hutang-supplier': 'Hutang Supplier',
  '/admin/kasbon': 'Kasbon',
  '/admin/pengguna': 'Kelola Kasir',

  // Owner
  '/owner': 'Dashboard',
  '/owner/transaksi': 'Transaksi',
  '/owner/rapor': 'AI Insight',
  '/owner/cashflow': 'Cashflow',
  '/owner/laporan': 'Laporan',
  '/owner/stok': 'Inventaris',
  '/owner/bahan-baku': 'Bahan Baku',
  '/owner/hutang-piutang': 'Hutang & Piutang',
  '/owner/hutang-piutang/kategori': 'Kategori Hutang & Piutang',
  '/owner/hutang-supplier': 'Hutang Supplier',
  '/owner/shift': 'Shift',
  '/owner/pengguna': 'Kelola Pengguna',
  '/owner/audit': 'Aktivitas Usaha',
  '/owner/langganan': 'Langganan',

  // Super Admin
  '/super-admin': 'Dashboard',
  '/super-admin/pengguna': 'Manajemen Pengguna',
  '/super-admin/persetujuan': 'Persetujuan Pendaftaran',
  '/super-admin/keuangan': 'Keuangan Platform',
  '/super-admin/cms': 'CMS Landing Page',
  '/super-admin/trial': 'Trial & Langganan',
  '/super-admin/paket': 'Paket Subscription',
  '/super-admin/audit-log': 'Audit Log & Keamanan',
  '/super-admin/pengaturan': 'Pengaturan',
  '/super-admin/profil': 'Profil Super Admin',
  '/super-admin/bisnis': 'Daftar Bisnis',
}

export function resolveBrowserTitle(pathname: string | null): string {
  if (!pathname || pathname === '/') {
    return 'Fluxa | Kasir & Analisis Kesehatan Bisnis'
  }

  // Exact match
  const exact = ROUTE_TITLE_MAP[pathname]
  if (exact) {
    return `Fluxa | ${exact}`
  }

  // Prefix match (sort by longest route to avoid greedy matching)
  const sortedRoutes = Object.keys(ROUTE_TITLE_MAP)
    .filter(route => route !== '/')
    .sort((a, b) => b.length - a.length)

  for (const route of sortedRoutes) {
    if (pathname.startsWith(route + '/')) {
      return `Fluxa | ${ROUTE_TITLE_MAP[route]}`
    }
  }

  // Fallback: capitalize last segment cleanly
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length > 0) {
    const raw = segments[segments.length - 1].replace(/[-_]/g, ' ')
    const formatted = raw.charAt(0).toUpperCase() + raw.slice(1)
    return `Fluxa | ${formatted}`
  }

  return 'Fluxa | Kasir & Analisis Kesehatan Bisnis'
}

export default function DynamicTitle() {
  const pathname = usePathname()

  useEffect(() => {
    const nextTitle = resolveBrowserTitle(pathname)
    if (typeof document !== 'undefined' && document.title !== nextTitle) {
      document.title = nextTitle
    }
  }, [pathname])

  return null
}

