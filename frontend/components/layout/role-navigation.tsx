import {
  Activity, BarChart3, Boxes, Building2, ClipboardList, CreditCard, DollarSign, FileText, Globe,
  Layers, LayoutDashboard, Package, Scale, Settings2, ShieldCheck, ShoppingCart,
  Sparkles, Tag, Tags, TrendingUp, Users
} from 'lucide-react'

export type UserRole = 'kasir' | 'admin' | 'owner' | 'super_admin'

export interface NavItem {
  icon: React.ReactNode
  label: string
  href: string
  badge?: number
  children?: NavItem[]
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
        { icon: <Boxes size={16} />, label: 'Bahan Baku & Resep', href: '/admin/bahan-baku' },
        { icon: <Layers size={16} />, label: 'Stok & Kartu Stok', href: '/admin/stok' },
        { icon: <ClipboardList size={16} />, label: 'Kategori Produk', href: '/admin/kategori' },
      ]
    },
    {
      label: 'Keuangan',
      items: [
        { icon: <Tag size={16} />, label: 'Diskon & Promo', href: '/admin/diskon' },
        {
          icon: <DollarSign size={16} />,
          label: 'Biaya Operasional',
          href: '/admin/biaya',
          children: [
            { icon: <DollarSign size={16} />, label: 'Pengeluaran', href: '/admin/biaya' },
            { icon: <Tags size={16} />, label: 'Kategori Biaya', href: '/admin/biaya/kategori' },
          ]
        },
        {
          icon: <Scale size={16} />,
          label: 'Hutang & Piutang',
          href: '/admin/hutang-piutang',
          children: [
            { icon: <Scale size={16} />, label: 'Daftar Hutang & Piutang', href: '/admin/hutang-piutang' },
            { icon: <Tags size={16} />, label: 'Kelola Kategori', href: '/admin/hutang-piutang/kategori' },
          ]
        },
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
        {
          icon: <Scale size={16} />,
          label: 'Hutang & Piutang',
          href: '/owner/hutang-piutang',
          children: [
            { icon: <Scale size={16} />, label: 'Daftar Hutang & Piutang', href: '/owner/hutang-piutang' },
            { icon: <Tags size={16} />, label: 'Kelola Kategori', href: '/owner/hutang-piutang/kategori' },
          ]
        },
      ]
    },
    {
      label: 'Operasional',
      items: [
        { icon: <Activity size={16} />, label: 'Buka / Tutup Shift', href: '/owner/shift' },
        { icon: <Package size={16} />, label: 'Monitoring Stok', href: '/owner/stok' },
        { icon: <Boxes size={16} />, label: 'Bahan Baku & Resep', href: '/admin/bahan-baku' },
        { icon: <Users size={16} />, label: 'Kelola Pengguna', href: '/owner/pengguna' },
        { icon: <FileText size={16} />, label: 'Aktifitas', href: '/owner/audit' },
        { icon: <CreditCard size={16} />, label: 'Langganan', href: '/owner/langganan' },
      ]
    }
  ],
  super_admin: [
    {
      label: 'Platform',
      items: [
        { icon: <LayoutDashboard size={16} />, label: 'Dashboard', href: '/super-admin' },
        { icon: <Users size={16} />, label: 'Manajemen Pengguna', href: '/super-admin/pengguna' },
        { icon: <ShieldCheck size={16} />, label: 'Persetujuan Pendaftaran', href: '/super-admin/persetujuan' },
        { icon: <DollarSign size={16} />, label: 'Keuangan Platform', href: '/super-admin/keuangan' },
        { icon: <Globe size={16} />, label: 'CMS Landing Page', href: '/super-admin/cms' },
      ]
    },
    {
      label: 'Kontrol Platform',
      items: [
        { icon: <Activity size={16} />, label: 'Trial & Langganan', href: '/super-admin/trial' },
        { icon: <CreditCard size={16} />, label: 'Paket Subscription', href: '/super-admin/paket' },
        { icon: <FileText size={16} />, label: 'Audit Log & Keamanan', href: '/super-admin/audit-log' },
        { icon: <Settings2 size={16} />, label: 'Pengaturan Sistem', href: '/super-admin/pengaturan' },
        { icon: <ShieldCheck size={16} />, label: 'Profil Super Admin', href: '/super-admin/profil' },
      ]
    }
  ]
}
