import {
  Activity, BarChart3, Building2, ClipboardList, CreditCard, DollarSign, FileText,
  Layers, LayoutDashboard, Package, ShoppingCart, Sparkles, Tag, TrendingUp, Users
} from 'lucide-react'

export type UserRole = 'kasir' | 'admin' | 'owner'

export interface NavItem {
  icon: React.ReactNode
  label: string
  href: string
  badge?: number
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export const menuByRole: Record<UserRole, NavGroup[]> = {
  kasir: [
    {
      label: 'Utama',
      items: [
        { icon: <ShoppingCart size={16} />, label: 'Kasir / POS', href: '/kasir' },
        { icon: <FileText size={16} />, label: 'Riwayat Transaksi', href: '/kasir/riwayat' },
      ]
    }
  ],
  admin: [
    {
      label: 'Utama',
      items: [
        { icon: <LayoutDashboard size={16} />, label: 'Dashboard', href: '/admin' },
        { icon: <ShoppingCart size={16} />, label: 'Transaksi', href: '/admin/transaksi' },
        { icon: <Activity size={16} />, label: 'Buka / Tutup Shift', href: '/admin/shift' },
      ]
    },
    {
      label: 'Produk',
      items: [
        { icon: <Package size={16} />, label: 'Kelola Produk', href: '/admin/produk' },
        { icon: <Layers size={16} />, label: 'Stok & Kartu Stok', href: '/admin/stok' },
        { icon: <ClipboardList size={16} />, label: 'Kategori', href: '/admin/kategori' },
      ]
    },
    {
      label: 'Keuangan',
      items: [
        { icon: <Tag size={16} />, label: 'Diskon & Promo', href: '/admin/diskon' },
        { icon: <DollarSign size={16} />, label: 'Biaya Operasional', href: '/admin/biaya' },
        { icon: <Building2 size={16} />, label: 'Hutang Supplier', href: '/admin/hutang-supplier' },
      ]
    },
    {
      label: 'Akun',
      items: [
        { icon: <Users size={16} />, label: 'Kelola Kasir', href: '/admin/pengguna' },
      ]
    }
  ],
  owner: [
    {
      label: 'Utama',
      items: [
        { icon: <LayoutDashboard size={16} />, label: 'Dashboard', href: '/owner' },
        { icon: <Sparkles size={16} />, label: 'Business Health', href: '/owner/rapor' },
      ]
    },
    {
      label: 'Laporan',
      items: [
        { icon: <TrendingUp size={16} />, label: 'Cashflow', href: '/owner/cashflow' },
        { icon: <BarChart3 size={16} />, label: 'Laporan Bulanan', href: '/owner/laporan' },
        { icon: <Building2 size={16} />, label: 'Hutang Supplier', href: '/owner/hutang-supplier' },
      ]
    },
    {
      label: 'Operasional',
      items: [
        { icon: <Activity size={16} />, label: 'Buka / Tutup Shift', href: '/owner/shift' },
        { icon: <Package size={16} />, label: 'Monitoring Stok', href: '/owner/stok' },
        { icon: <Users size={16} />, label: 'Kelola Pengguna', href: '/owner/pengguna' },
        { icon: <FileText size={16} />, label: 'Audit Log', href: '/owner/audit' },
      ]
    }
  ]
}
