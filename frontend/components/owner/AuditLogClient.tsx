'use client'

import { useState, useMemo } from 'react'
import {
  ShieldAlert, Search, Filter, Calendar, User, Clock, CheckCircle,
  AlertTriangle, ArrowUpRight, ArrowDownLeft, Printer, RefreshCw,
  FileText, ShoppingCart, Layers, DollarSign, Scale, X, ChevronRight, Eye
} from 'lucide-react'
import { PageHeader } from '@/components/layout/Topbar'
import { SectionCard, FormatRupiah } from '@/components/ui/Cards'

export interface AuditLogItem {
  id: string
  action: string
  table_name: string
  record_id?: string | null
  old_data?: any
  new_data?: any
  ip_address?: string | null
  created_at: string
  user_id?: string | null
  user_name?: string | null
  user_role?: 'kasir' | 'admin' | 'owner' | null
}

const DEMO_AUDIT_LOGS: AuditLogItem[] = [
  {
    id: 'log-01',
    action: 'CREATE_SALE',
    table_name: 'sales',
    record_id: 'sale-981',
    created_at: new Date(Date.now() - 1000 * 60 * 12).toISOString(), // 12 mins ago
    user_id: 'u-kasir-1',
    user_name: 'Ahmad Fauzi',
    user_role: 'kasir',
    new_data: {
      invoice_number: 'INV-20261017-89A1',
      final_amount: 145000,
      payment_method: 'cash',
      items_count: 4,
      discount: 0
    }
  },
  {
    id: 'log-02',
    action: 'VOID_SALE',
    table_name: 'sales',
    record_id: 'sale-975',
    created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(), // 45 mins ago
    user_id: 'u-admin-1',
    user_name: 'Siti Nurhaliza',
    user_role: 'admin',
    new_data: {
      invoice_number: 'INV-20261017-4B2C',
      final_amount: 85000,
      void_reason: 'Pelanggan membatalkan pesanan karena salah varian rasa',
      restored_stock: true
    }
  },
  {
    id: 'log-03',
    action: 'ADJUST_STOCK',
    table_name: 'products',
    record_id: 'prod-001',
    created_at: new Date(Date.now() - 1000 * 60 * 90).toISOString(), // 1.5 hrs ago
    user_id: 'u-admin-1',
    user_name: 'Siti Nurhaliza',
    user_role: 'admin',
    old_data: { stock: 15 },
    new_data: {
      product_name: 'Kopi Susu Gula Aren',
      stock: 65,
      type: 'in',
      qty: 50,
      note: 'Restock mingguan dari supplier CV Maju Jaya'
    }
  },
  {
    id: 'log-04',
    action: 'CREATE_EXPENSE',
    table_name: 'expenses',
    record_id: 'exp-102',
    created_at: new Date(Date.now() - 1000 * 60 * 150).toISOString(), // 2.5 hrs ago
    user_id: 'u-admin-1',
    user_name: 'Siti Nurhaliza',
    user_role: 'admin',
    new_data: {
      amount: 250000,
      description: 'Beli token listrik operasional toko ruko 500kWh',
      category: 'Listrik & Utilitas Toko',
      expense_date: '2026-10-17'
    }
  },
  {
    id: 'log-05',
    action: 'CREATE_SALE',
    table_name: 'sales',
    record_id: 'sale-980',
    created_at: new Date(Date.now() - 1000 * 60 * 210).toISOString(),
    user_id: 'u-kasir-1',
    user_name: 'Ahmad Fauzi',
    user_role: 'kasir',
    new_data: {
      invoice_number: 'INV-20261017-71F9',
      final_amount: 92000,
      payment_method: 'qris',
      items_count: 2,
      discount: 5000
    }
  },
  {
    id: 'log-06',
    action: 'CREATE_DEBT',
    table_name: 'supplier_payables',
    record_id: 'deb-501',
    created_at: new Date(Date.now() - 1000 * 60 * 320).toISOString(),
    user_id: 'u-admin-1',
    user_name: 'Siti Nurhaliza',
    user_role: 'admin',
    new_data: {
      party_name: 'Bpk. Hendro (Pemilik Ruko)',
      type: 'payable',
      category: 'Operasional & Sewa Ruko',
      description: 'Sewa ruko toko semester 2 tahun 2026',
      total_amount: 12000000,
      due_date: '2026-11-15'
    }
  },
  {
    id: 'log-07',
    action: 'RECORD_DEBT_PAYMENT',
    table_name: 'supplier_payments',
    record_id: 'pay-201',
    created_at: new Date(Date.now() - 1000 * 60 * 380).toISOString(),
    user_id: 'u-admin-1',
    user_name: 'Siti Nurhaliza',
    user_role: 'admin',
    new_data: {
      party_name: 'CV Maju Jaya',
      amount: 500000,
      payment_method: 'transfer',
      note: 'Cicilan ke-1 pengadaan bahan baku'
    }
  },
  {
    id: 'log-08',
    action: 'UPDATE_PRODUCT',
    table_name: 'products',
    record_id: 'prod-004',
    created_at: new Date(Date.now() - 1000 * 60 * 480).toISOString(),
    user_id: 'u-admin-1',
    user_name: 'Siti Nurhaliza',
    user_role: 'admin',
    old_data: { sell_price: 10000, buy_price: 6000 },
    new_data: {
      name: 'Keripik Singkong Balado',
      sell_price: 12000,
      buy_price: 7000
    }
  },
  {
    id: 'log-09',
    action: 'OPEN_SHIFT',
    table_name: 'shifts',
    record_id: 'shf-101',
    created_at: new Date(Date.now() - 1000 * 60 * 540).toISOString(), // pagi hari
    user_id: 'u-kasir-1',
    user_name: 'Ahmad Fauzi',
    user_role: 'kasir',
    new_data: {
      initial_cash: 500000,
      opened_at: '2026-10-17 07:45:00'
    }
  },
  {
    id: 'log-10',
    action: 'CLOSE_SHIFT',
    table_name: 'shifts',
    record_id: 'shf-099',
    created_at: new Date(Date.now() - 86400000 * 1 + 1000 * 60 * 60 * 8).toISOString(), // kemarin sore
    user_id: 'u-kasir-2',
    user_name: 'Rian Saputra',
    user_role: 'kasir',
    new_data: {
      initial_cash: 500000,
      final_cash: 1820000,
      expected_cash: 1820000,
      difference: 0,
      note: 'Kas cocok fisik vs sistem, nota rapi'
    }
  },
  {
    id: 'log-11',
    action: 'CLOSE_SHIFT',
    table_name: 'shifts',
    record_id: 'shf-098',
    created_at: new Date(Date.now() - 86400000 * 2 + 1000 * 60 * 60 * 8).toISOString(),
    user_id: 'u-kasir-1',
    user_name: 'Ahmad Fauzi',
    user_role: 'kasir',
    new_data: {
      initial_cash: 500000,
      final_cash: 1475000,
      expected_cash: 1480000,
      difference: -5000,
      note: 'Selisih Rp5.000 (kembalian uang receh kurang pecahan Rp1.000)'
    }
  },
  {
    id: 'log-12',
    action: 'CREATE_RECEIVABLE',
    table_name: 'supplier_payables',
    record_id: 'rec-101',
    created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    user_id: 'u-admin-1',
    user_name: 'Siti Nurhaliza',
    user_role: 'admin',
    new_data: {
      party_name: 'Toko Roti Bu Ani (Mitra Konsinyasi)',
      type: 'receivable',
      category: 'Konsinyasi & Kemitraan Toko',
      description: 'Titip jual produk kemasan 50 pcs',
      total_amount: 750000,
      due_date: '2026-10-28'
    }
  }
]

function formatRp(n: number) {
  return 'Rp' + new Intl.NumberFormat('id-ID').format(n)
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'Baru saja'
  if (mins < 60) return `${mins} mnt lalu`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} jam lalu`
  const days = Math.floor(hours / 24)
  return `${days} hari lalu`
}

export default function AuditLogClient({
  initialLogs,
}: {
  initialLogs: AuditLogItem[]
}) {
  const logs = initialLogs.length > 0 ? initialLogs : DEMO_AUDIT_LOGS

  // Filters
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | 'kasir' | 'admin' | 'owner'>('all')
  const [actionCategory, setActionCategory] = useState<string>('all')
  const [dateRange, setDateRange] = useState<'all' | 'today' | '7days' | '30days'>('all')

  // Selected Log for detail modal
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null)

  // Filter calculation
  const filtered = useMemo(() => {
    const now = Date.now()
    return logs.filter(log => {
      // Role filter
      if (roleFilter !== 'all' && log.user_role !== roleFilter) return false

      // Category filter
      if (actionCategory !== 'all') {
        if (actionCategory === 'pos' && log.action !== 'CREATE_SALE') return false
        if (actionCategory === 'void' && log.action !== 'VOID_SALE') return false
        if (actionCategory === 'shift' && !['OPEN_SHIFT', 'CLOSE_SHIFT'].includes(log.action)) return false
        if (actionCategory === 'stock' && log.action !== 'ADJUST_STOCK') return false
        if (actionCategory === 'expense' && log.action !== 'CREATE_EXPENSE') return false
        if (actionCategory === 'debt' && !['CREATE_DEBT', 'CREATE_RECEIVABLE', 'RECORD_DEBT_PAYMENT'].includes(log.action)) return false
        if (actionCategory === 'product' && log.action !== 'UPDATE_PRODUCT') return false
      }

      // Date filter
      if (dateRange !== 'all') {
        const logTime = new Date(log.created_at).getTime()
        if (dateRange === 'today') {
          const isToday = new Date(log.created_at).toDateString() === new Date().toDateString()
          if (!isToday) return false
        } else if (dateRange === '7days') {
          if (now - logTime > 7 * 86400000) return false
        } else if (dateRange === '30days') {
          if (now - logTime > 30 * 86400000) return false
        }
      }

      // Search keyword
      if (search.trim()) {
        const q = search.toLowerCase()
        const userMatch = (log.user_name || '').toLowerCase().includes(q)
        const actionMatch = log.action.toLowerCase().includes(q)
        const tableMatch = log.table_name.toLowerCase().includes(q)
        const dataStr = JSON.stringify({ ...log.new_data, ...log.old_data }).toLowerCase()
        if (!userMatch && !actionMatch && !tableMatch && !dataStr.includes(q)) return false
      }

      return true
    })
  }, [logs, roleFilter, actionCategory, dateRange, search])

  // KPIs
  const totalCount = logs.length
  const cashierActions = logs.filter(l => l.user_role === 'kasir').length
  const adminActions = logs.filter(l => l.user_role === 'admin').length
  const voidActions = logs.filter(l => l.action === 'VOID_SALE').length

  // Helper formatting narrative per action
  const formatNarrative = (log: AuditLogItem) => {
    const nd = log.new_data || {}
    const od = log.old_data || {}

    switch (log.action) {
      case 'CREATE_SALE':
        return (
          <div>
            <strong>Transaksi Penjualan</strong> nota <code style={{ background: 'var(--bg)', padding: '2px 5px', borderRadius: 4 }}>{nd.invoice_number || 'INV'}</code> senilai{' '}
            <strong style={{ color: 'var(--ok)' }}>{formatRp(nd.final_amount || 0)}</strong> via <em>{(nd.payment_method || 'tunai').toUpperCase()}</em>
            {nd.discount ? ` (Diskon: ${formatRp(nd.discount)})` : ''}.
          </div>
        )
      case 'VOID_SALE':
        return (
          <div>
            <strong style={{ color: 'var(--bad)' }}>Pembatalan / Void Transaksi</strong> nota{' '}
            <code style={{ background: 'var(--bg)', padding: '2px 5px', borderRadius: 4 }}>{nd.invoice_number}</code> senilai{' '}
            <strong>{formatRp(nd.final_amount || 0)}</strong>.
            <div style={{ fontSize: 12, color: 'var(--bad)', marginTop: 2 }}>
              Alasan: "{nd.void_reason || 'Tidak disebutkan'}"
            </div>
          </div>
        )
      case 'ADJUST_STOCK':
        return (
          <div>
            <strong>Koreksi Stok Fisik (Opname/Restock)</strong> produk <em>{nd.product_name || 'Produk'}</em>:{' '}
            <span style={{ fontWeight: 600, color: nd.qty >= 0 ? 'var(--ok)' : 'var(--bad)' }}>
              {nd.qty >= 0 ? `+${nd.qty}` : nd.qty} unit
            </span> (Stok: {od.stock ?? '—'} → {nd.stock}).
            {nd.note && <div style={{ fontSize: 12, color: 'var(--mute)', marginTop: 2 }}>Keterangan: "{nd.note}"</div>}
          </div>
        )
      case 'OPEN_SHIFT':
        return (
          <div>
            <strong>Buka Shift Kasir</strong> dengan modal awal kas fisik senilai{' '}
            <strong style={{ color: 'var(--acc)' }}>{formatRp(nd.initial_cash || 0)}</strong>.
          </div>
        )
      case 'CLOSE_SHIFT':
        const diff = nd.difference || 0
        return (
          <div>
            <strong>Tutup Shift Kasir</strong>. Kas fisik laci: <strong>{formatRp(nd.final_cash || 0)}</strong>, Sistem: {formatRp(nd.expected_cash || 0)}.{' '}
            <span style={{
              fontWeight: 700,
              color: diff === 0 ? 'var(--ok)' : 'var(--bad)'
            }}>
              {diff === 0 ? '(Kas Sesuai / Selisih Rp0)' : `(Selisih: ${diff > 0 ? '+' : ''}${formatRp(diff)})`}
            </span>
            {nd.note && <div style={{ fontSize: 12, color: 'var(--mute)', marginTop: 2 }}>Catatan: "{nd.note}"</div>}
          </div>
        )
      case 'CREATE_EXPENSE':
        return (
          <div>
            <strong>Pencatatan Biaya Operasional</strong> senilai{' '}
            <strong style={{ color: 'var(--bad)' }}>{formatRp(nd.amount || 0)}</strong> untuk:{' '}
            "{nd.description || 'Operasional toko'}".
          </div>
        )
      case 'UPDATE_PRODUCT':
        return (
          <div>
            <strong>Pembaruan Data & Harga Produk</strong> <em>{nd.name}</em>.{' '}
            Harga Jual: {od.sell_price ? formatRp(od.sell_price) : '—'} → <strong style={{ color: 'var(--ink)' }}>{formatRp(nd.sell_price || 0)}</strong>.
          </div>
        )
      case 'CREATE_DEBT':
        return (
          <div>
            <strong>Pencatatan Hutang Toko</strong> senilai{' '}
            <strong style={{ color: 'var(--bad)' }}>{formatRp(nd.total_amount || 0)}</strong> kepada{' '}
            <strong>{nd.party_name}</strong> ({nd.category}).
          </div>
        )
      case 'CREATE_RECEIVABLE':
        return (
          <div>
            <strong>Pencatatan Piutang Usaha</strong> senilai{' '}
            <strong style={{ color: 'var(--ok)' }}>{formatRp(nd.total_amount || 0)}</strong> dari{' '}
            <strong>{nd.party_name}</strong> ({nd.category}).
          </div>
        )
      case 'RECORD_DEBT_PAYMENT':
        return (
          <div>
            <strong>Pembayaran Cicilan / Pelunasan</strong> senilai{' '}
            <strong>{formatRp(nd.amount || 0)}</strong> via {(nd.payment_method || 'transfer').toUpperCase()}.
            {nd.note && <div style={{ fontSize: 12, color: 'var(--mute)', marginTop: 2 }}>Catatan: "{nd.note}"</div>}
          </div>
        )
      default:
        return (
          <div>
            <strong>{log.action}</strong> pada tabel <code>{log.table_name}</code>
            {nd ? <div style={{ fontSize: 12, color: 'var(--mute)' }}>{JSON.stringify(nd).slice(0, 70)}...</div> : null}
          </div>
        )
    }
  }

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'CREATE_SALE':
        return <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'var(--oks)', color: 'var(--ok)', whiteSpace: 'nowrap' }}>Penjualan POS</span>
      case 'VOID_SALE':
        return <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'var(--bads)', color: 'var(--bad)', whiteSpace: 'nowrap' }}>Void Transaksi</span>
      case 'ADJUST_STOCK':
        return <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'var(--warns)', color: 'var(--warn)', whiteSpace: 'nowrap' }}>Koreksi Stok</span>
      case 'OPEN_SHIFT':
        return <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'var(--accs)', color: 'var(--acc)', whiteSpace: 'nowrap' }}>Buka Shift</span>
      case 'CLOSE_SHIFT':
        return <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'var(--bg)', color: 'var(--ink)', border: '1px solid var(--line)', whiteSpace: 'nowrap' }}>Tutup Shift</span>
      case 'CREATE_EXPENSE':
        return <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'var(--bads)', color: 'var(--bad)', whiteSpace: 'nowrap' }}>Biaya Toko</span>
      case 'CREATE_DEBT':
        return <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'var(--bads)', color: 'var(--bad)', whiteSpace: 'nowrap' }}>Hutang Baru</span>
      case 'CREATE_RECEIVABLE':
        return <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'var(--oks)', color: 'var(--ok)', whiteSpace: 'nowrap' }}>Piutang Usaha</span>
      case 'RECORD_DEBT_PAYMENT':
        return <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'var(--accs)', color: 'var(--acc)', whiteSpace: 'nowrap' }}>Cicilan Hutang</span>
      default:
        return <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'var(--bg)', color: 'var(--mute)', whiteSpace: 'nowrap' }}>{action}</span>
    }
  }

  const getRoleBadge = (role?: string | null) => {
    const r = (role || 'kasir').toLowerCase()
    if (r === 'kasir') {
      return (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '2px 7px', borderRadius: 5, fontSize: 10.5, fontWeight: 700,
          background: 'rgba(59, 130, 246, 0.12)', color: '#2563eb'
        }}>
          KASIR
        </span>
      )
    }
    if (r === 'admin') {
      return (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '2px 7px', borderRadius: 5, fontSize: 10.5, fontWeight: 700,
          background: 'rgba(245, 158, 11, 0.12)', color: '#d97706'
        }}>
          ADMIN
        </span>
      )
    }
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '2px 7px', borderRadius: 5, fontSize: 10.5, fontWeight: 700,
        background: 'rgba(16, 185, 129, 0.12)', color: '#059669'
      }}>
        OWNER
      </span>
    )
  }

  return (
    <div>
      <PageHeader
        title="Audit Log & Integritas Operasional"
        subtitle="Laporan lengkap rekaman aktivitas Kasir dan Admin untuk transparansi kas fisik, akuntabilitas stok, dan audit keamanan sistem (GTNIC 2026)"
        actions={
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => window.print()}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontWeight: 600 }}
          >
            <Printer size={15} /> Cetak / Ekspor Laporan
          </button>
        }
      />

      {/* 4 KPI Ringkasan Aktivitas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 }}>
        {/* Total Log */}
        <div className="kpi-card" style={{ borderLeft: '4px solid var(--acc)' }}>
          <div className="kpi-icon" style={{ background: 'var(--accs)', color: 'var(--acc)' }}>
            <FileText size={20} />
          </div>
          <div className="kpi-label">Total Aktivitas Tercatat</div>
          <div className="kpi-value" style={{ color: 'var(--acc)' }}>
            {totalCount} <span style={{ fontSize: 14, fontWeight: 500 }}>Aksi</span>
          </div>
          <div className="kpi-sub">Seluruh jejak rekam Kasir & Admin</div>
        </div>

        {/* Aktivitas Kasir */}
        <div className="kpi-card" style={{ borderLeft: '4px solid #2563eb' }}>
          <div className="kpi-icon" style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#2563eb' }}>
            <ShoppingCart size={20} />
          </div>
          <div className="kpi-label">Aktivitas Kasir (POS & Shift)</div>
          <div className="kpi-value" style={{ color: '#2563eb' }}>
            {cashierActions} <span style={{ fontSize: 14, fontWeight: 500 }}>Log</span>
          </div>
          <div className="kpi-sub">Transaksi penjualan, kasir buka & tutup shift</div>
        </div>

        {/* Aktivitas Admin */}
        <div className="kpi-card" style={{ borderLeft: '4px solid #d97706' }}>
          <div className="kpi-icon" style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#d97706' }}>
            <Layers size={20} />
          </div>
          <div className="kpi-label">Aktivitas Admin Toko</div>
          <div className="kpi-value" style={{ color: '#d97706' }}>
            {adminActions} <span style={{ fontSize: 14, fontWeight: 500 }}>Log</span>
          </div>
          <div className="kpi-sub">Stok opname, biaya toko, hutang & harga</div>
        </div>

        {/* Void Transaksi (Penting untuk Audit Fraud) */}
        <div className="kpi-card" style={{ borderLeft: '4px solid var(--bad)' }}>
          <div className="kpi-icon" style={{ background: 'var(--bads)', color: 'var(--bad)' }}>
            <ShieldAlert size={20} />
          </div>
          <div className="kpi-label">Pembatalan Nota (Void)</div>
          <div className="kpi-value" style={{ color: voidActions > 0 ? 'var(--bad)' : 'var(--ok)' }}>
            {voidActions} <span style={{ fontSize: 14, fontWeight: 500 }}>Transaksi</span>
          </div>
          <div className="kpi-sub">
            {voidActions > 0 ? 'Perlu perhatian pengawasan khusus' : 'Kondisi aman (nihil void)'}
          </div>
        </div>
      </div>

      {/* Main Section */}
      <SectionCard title="Kronologi Jejak Audit Sistem">
        {/* Filter Bar */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 18, alignItems: 'center' }}>
          {/* Search Box */}
          <div style={{ flex: '1 1 240px', position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--mute)' }} />
            <input
              id="search-audit-input"
              className="input"
              placeholder="Cari nama kasir/admin, invoice, produk, alasan void..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 36, width: '100%' }}
            />
          </div>

          {/* Filter Role Pelaku */}
          <div style={{ display: 'flex', background: 'var(--bg)', padding: 4, borderRadius: 8, border: '1px solid var(--line)', gap: 4 }}>
            <button
              type="button"
              onClick={() => setRoleFilter('all')}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: 'none',
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
                background: roleFilter === 'all' ? 'var(--panel)' : 'transparent',
                color: roleFilter === 'all' ? 'var(--ink)' : 'var(--mute)',
                boxShadow: roleFilter === 'all' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
              }}
            >
              Semua Pelaku
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter('kasir')}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: 'none',
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
                background: roleFilter === 'kasir' ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
                color: roleFilter === 'kasir' ? '#2563eb' : 'var(--mute)',
                boxShadow: roleFilter === 'kasir' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
              }}
            >
              🔵 Kasir Saja
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter('admin')}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: 'none',
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
                background: roleFilter === 'admin' ? 'rgba(245, 158, 11, 0.12)' : 'transparent',
                color: roleFilter === 'admin' ? '#d97706' : 'var(--mute)',
                boxShadow: roleFilter === 'admin' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
              }}
            >
              🟠 Admin Saja
            </button>
          </div>

          {/* Filter Kategori Aksi */}
          <select
            className="input"
            value={actionCategory}
            onChange={e => setActionCategory(e.target.value)}
            style={{ width: 'auto', minWidth: 170 }}
          >
            <option value="all">Semua Kategori Aksi</option>
            <option value="pos">🛒 Penjualan POS Kasir</option>
            <option value="void">🚫 Void Transaksi Kasir</option>
            <option value="shift">⏱️ Buka / Tutup Shift Kasir</option>
            <option value="stock">📦 Koreksi & Opname Stok</option>
            <option value="expense">💸 Biaya Operasional Toko</option>
            <option value="debt">⚖️ Hutang & Piutang Usaha</option>
            <option value="product">🏷️ Perubahan Harga / Produk</option>
          </select>

          {/* Filter Rentang Tanggal */}
          <select
            className="input"
            value={dateRange}
            onChange={e => setDateRange(e.target.value as any)}
            style={{ width: 'auto', minWidth: 140 }}
          >
            <option value="all">Semua Waktu</option>
            <option value="today">Hari Ini</option>
            <option value="7days">7 Hari Terakhir</option>
            <option value="30days">30 Hari Terakhir</option>
          </select>
        </div>

        {/* Data Table */}
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 140 }}>Waktu & Tanggal</th>
                <th style={{ width: 160 }}>Pelaku (Staf)</th>
                <th style={{ width: 130 }}>Aksi Sistem</th>
                <th>Laporan Deskripsi Aktivitas</th>
                <th style={{ width: 90, textAlign: 'center' }}>Detail</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--mute)' }}>
                    <ShieldAlert size={28} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.5 }} />
                    Tidak ada catatan aktivitas audit yang sesuai filter.
                  </td>
                </tr>
              ) : (
                filtered.map(item => (
                  <tr key={item.id}>
                    {/* Waktu */}
                    <td>
                      <div style={{ fontSize: 12.5, fontWeight: 600 }}>
                        {formatDate(item.created_at)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--mute)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                        <Clock size={11} /> {timeAgo(item.created_at)}
                      </div>
                    </td>

                    {/* Pelaku & Role */}
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 3 }}>
                        {item.user_name || 'Sistem / Anonim'}
                      </div>
                      {getRoleBadge(item.user_role)}
                    </td>

                    {/* Aksi Badge */}
                    <td>
                      {getActionBadge(item.action)}
                      <div style={{ fontSize: 10.5, fontFamily: 'monospace', color: 'var(--mute)', marginTop: 4 }}>
                        tbl: {item.table_name}
                      </div>
                    </td>

                    {/* Deskripsi Narasi Kejadian */}
                    <td style={{ lineHeight: 1.55 }}>
                      {formatNarrative(item)}
                    </td>

                    {/* Tombol Detail */}
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setSelectedLog(item)}
                        style={{ padding: '4px 10px', fontSize: 11.5, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      >
                        <Eye size={13} /> Detail
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Modal Detail JSON & Metadata */}
      {selectedLog && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: 16
        }}>
          <div style={{
            background: 'var(--panel)',
            border: '1px solid var(--line)',
            borderRadius: 14,
            width: '100%',
            maxWidth: 640,
            boxShadow: '0 16px 40px rgba(0,0,0,0.25)',
            overflow: 'hidden',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--line)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  Detail Log Aktivitas Audit
                  {getActionBadge(selectedLog.action)}
                </div>
                <div style={{ fontSize: 12, color: 'var(--mute)', marginTop: 2 }}>
                  ID: {selectedLog.id} • Waktu: {formatDate(selectedLog.created_at)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--mute)' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Ringkasan Kejadian */}
              <div style={{ background: 'var(--bg)', padding: '14px', borderRadius: 10, border: '1px solid var(--line)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mute)', textTransform: 'uppercase', marginBottom: 6 }}>
                  Ringkasan Narasi
                </div>
                <div style={{ fontSize: 14 }}>
                  {formatNarrative(selectedLog)}
                </div>
              </div>

              {/* Data Pelaku & Target */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ background: 'var(--bg)', padding: '12px', borderRadius: 8, border: '1px solid var(--line)' }}>
                  <div style={{ fontSize: 11, color: 'var(--mute)', fontWeight: 600 }}>Staf Pelaksana:</div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>{selectedLog.user_name || 'Sistem'}</div>
                  <div style={{ marginTop: 4 }}>{getRoleBadge(selectedLog.user_role)}</div>
                </div>

                <div style={{ background: 'var(--bg)', padding: '12px', borderRadius: 8, border: '1px solid var(--line)' }}>
                  <div style={{ fontSize: 11, color: 'var(--mute)', fontWeight: 600 }}>Tabel & Record ID:</div>
                  <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'monospace', marginTop: 2 }}>
                    {selectedLog.table_name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--mute)', fontFamily: 'monospace', marginTop: 2 }}>
                    ID: {selectedLog.record_id || '—'}
                  </div>
                </div>
              </div>

              {/* Old Data (Jika Ada) */}
              {selectedLog.old_data && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--bad)', marginBottom: 6 }}>
                    Data Sebelum Perubahan (Old Data):
                  </div>
                  <pre style={{
                    background: 'var(--bg)',
                    padding: '12px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontFamily: 'monospace',
                    border: '1px solid var(--line)',
                    overflowX: 'auto',
                    whiteSpace: 'pre-wrap'
                  }}>
                    {JSON.stringify(selectedLog.old_data, null, 2)}
                  </pre>
                </div>
              )}

              {/* New Data */}
              {selectedLog.new_data && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ok)', marginBottom: 6 }}>
                    Data Sesudah / Rekaman Transaksi (New Data):
                  </div>
                  <pre style={{
                    background: 'var(--bg)',
                    padding: '12px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontFamily: 'monospace',
                    border: '1px solid var(--line)',
                    overflowX: 'auto',
                    whiteSpace: 'pre-wrap'
                  }}>
                    {JSON.stringify(selectedLog.new_data, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{
              padding: '14px 20px',
              borderTop: '1px solid var(--line)',
              display: 'flex',
              justifyContent: 'flex-end'
            }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSelectedLog(null)}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
