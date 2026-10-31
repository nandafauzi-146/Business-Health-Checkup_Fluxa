'use client'

import { useState, useMemo } from 'react'
import {
  Boxes,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Search,
  Filter,
  Download,
  Calendar,
  Layers,
  ChefHat,
  Eye,
  Info,
  Clock,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  DollarSign
} from 'lucide-react'
import { PageHeader } from '@/components/layout/Topbar'
import { calculateRecipeRatios } from '@/lib/unit-conversion'

export interface RawMaterialSubItem {
  id: string
  sub_material_id: string
  quantity: number
  unit: string
  sub_material?: {
    id: string
    name: string
    unit: string
    cost_per_unit: number
  } | null
}

export interface OwnerRawMaterialItem {
  id: string
  name: string
  sku: string | null
  material_type: 'raw' | 'semi_finished'
  stock: number
  min_stock: number
  unit: string
  cost_per_unit: number
  batch_yield?: number | null
  updated_at: string
  products_count: number
  sub_ingredients?: RawMaterialSubItem[]
}

export interface OwnerRawMaterialMovement {
  id: string
  raw_material_id: string
  raw_material_name: string
  unit: string
  type: string
  quantity: number
  previous_stock: number
  current_stock: number
  note: string | null
  created_at: string
  creator_name?: string
  creator_role?: string
}

interface Props {
  materials: OwnerRawMaterialItem[]
  movements: OwnerRawMaterialMovement[]
  loadError?: string | null
}

function formatRp(n: number) {
  return 'Rp' + new Intl.NumberFormat('id-ID').format(Math.round(n))
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export default function OwnerRawMaterialsHistoryClient({
  materials,
  movements,
  loadError
}: Props) {
  const [activeTab, setActiveTab] = useState<'history' | 'stock'>('history')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'in' | 'out' | 'production' | 'sale_usage' | 'adjustment' | 'void_return'>('all')
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7days' | '30days'>('all')

  // Recipe detail modal (Read-only)
  const [recipeModalMaterial, setRecipeModalMaterial] = useState<OwnerRawMaterialItem | null>(null)

  // Summary Metrics
  const totalMaterials = materials.length
  const rawSpicesCount = materials.filter(m => m.material_type === 'raw').length
  const semiFinishedCount = materials.filter(m => m.material_type === 'semi_finished').length
  const lowStockMaterials = materials.filter(m => m.stock <= m.min_stock)
  const outOfStockCount = materials.filter(m => m.stock === 0).length
  const totalValuation = materials.reduce((acc, m) => acc + (m.stock * m.cost_per_unit), 0)

  // Filtered movements
  const filteredMovements = useMemo(() => {
    const now = Date.now()
    return movements.filter(mov => {
      // Material filter
      if (selectedMaterialId !== 'all' && mov.raw_material_id !== selectedMaterialId) {
        return false
      }

      // Type filter
      if (typeFilter !== 'all' && mov.type !== typeFilter) {
        return false
      }

      // Date filter
      if (dateFilter !== 'all') {
        const movTime = new Date(mov.created_at).getTime()
        if (dateFilter === 'today') {
          const isToday = new Date(mov.created_at).toDateString() === new Date().toDateString()
          if (!isToday) return false
        } else if (dateFilter === '7days') {
          if (now - movTime > 7 * 86400000) return false
        } else if (dateFilter === '30days') {
          if (now - movTime > 30 * 86400000) return false
        }
      }

      // Search filter
      if (search.trim()) {
        const q = search.toLowerCase()
        const nameMatch = mov.raw_material_name.toLowerCase().includes(q)
        const noteMatch = (mov.note || '').toLowerCase().includes(q)
        const actorMatch = (mov.creator_name || '').toLowerCase().includes(q)
        if (!nameMatch && !noteMatch && !actorMatch) return false
      }

      return true
    })
  }, [movements, selectedMaterialId, typeFilter, dateFilter, search])

  // Filtered materials for stock overview
  const filteredMaterials = useMemo(() => {
    if (!search.trim()) return materials
    const q = search.toLowerCase()
    return materials.filter(m =>
      m.name.toLowerCase().includes(q) ||
      (m.sku || '').toLowerCase().includes(q)
    )
  }, [materials, search])

  // Export CSV
  const handleExportCSV = () => {
    if (filteredMovements.length === 0) return
    const headers = ['Waktu', 'Bahan Baku', 'Tipe Mutasi', 'Perubahan', 'Stok Sebelum', 'Stok Sesudah', 'Satuan', 'Dilakukan Oleh', 'Keterangan']
    const rows = filteredMovements.map(m => [
      formatDate(m.created_at),
      `"${m.raw_material_name}"`,
      m.type,
      m.quantity,
      m.previous_stock,
      m.current_stock,
      m.unit,
      `"${m.creator_name || 'Admin Toko'}"`,
      `"${(m.note || '').replace(/"/g, '""')}"`
    ])
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `riwayat-bahan-baku-${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Helper badge for mutation type
  const renderMovementBadge = (type: string) => {
    switch (type) {
      case 'in':
        return (
          <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'var(--oks)', color: 'var(--ok)' }}>
            + Restock Masuk
          </span>
        )
      case 'out':
        return (
          <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'var(--bads)', color: 'var(--bad)' }}>
            - Pengurangan
          </span>
        )
      case 'production':
        return (
          <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'rgba(59, 130, 246, 0.12)', color: '#2563eb' }}>
            🍳 Olah Bumbu
          </span>
        )
      case 'sale_usage':
        return (
          <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'var(--accs)', color: 'var(--acc)' }}>
            🛒 Penjualan Menu
          </span>
        )
      case 'void_return':
        return (
          <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'rgba(139, 92, 246, 0.12)', color: '#8b5cf6' }}>
            ↺ Void Dibatalkan
          </span>
        )
      case 'adjustment':
      default:
        return (
          <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'var(--warns)', color: 'var(--warn)' }}>
            ⚖️ Audit Opname
          </span>
        )
    }
  }

  return (
    <div style={{ paddingBottom: 40 }}>
      <PageHeader
        title="Monitoring & Riwayat Bahan Baku"
        subtitle="Pantau persediaan bahan baku mentah, resep bumbu olahan, serta transparansi audit mutasi stok oleh staf usaha Anda"
      />

      {/* Notice Read-Only untuk Owner */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        background: 'var(--panel)',
        border: '1px solid var(--line)',
        borderRadius: 12,
        marginBottom: 20,
        boxShadow: 'var(--shadow-soft)'
      }}>
        <div style={{
          width: 34,
          height: 34,
          borderRadius: 8,
          background: 'rgba(124, 58, 237, 0.12)',
          color: '#7c3aed',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          <ShieldCheck size={18} />
        </div>
        <div style={{ flex: 1, fontSize: 12.5, color: 'var(--mute)' }}>
          <strong style={{ color: 'var(--ink)' }}>Akses Pengawasan Owner: </strong>
          Halaman ini khusus untuk memantau data dan mengaudit riwayat pergerakan bahan baku. Penambahan bahan, pengeditan resep, dan produksi olahan bumbu sepenuhnya dikelola oleh tim Admin.
        </div>
      </div>

      {loadError && (
        <div style={{
          padding: '14px 18px',
          background: 'var(--bads)',
          border: '1px solid var(--bad)',
          borderRadius: 12,
          color: 'var(--bad)',
          marginBottom: 20,
          fontSize: 13
        }}>
          {loadError}
        </div>
      )}

      {/* 4 Kotak KPI Kompak Berjajar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 14,
        marginBottom: 24
      }}>
        {/* KPI 1 */}
        <div style={{
          padding: '14px 16px 12px',
          background: 'var(--panel)',
          border: '1px solid var(--line)',
          borderRadius: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 6
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--mute)' }}>Total Bahan Baku</span>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--accs)', color: 'var(--acc)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Boxes size={16} />
            </div>
          </div>
          <strong style={{ fontSize: 22, color: 'var(--ink)' }}>{totalMaterials} Jenis</strong>
          <span style={{ fontSize: 11, color: 'var(--mute)', marginTop: 'auto' }}>
            {rawSpicesCount} mentah, {semiFinishedCount} bumbu olahan
          </span>
        </div>

        {/* KPI 2 */}
        <div style={{
          padding: '14px 16px 12px',
          background: 'var(--panel)',
          border: '1px solid var(--line)',
          borderRadius: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 6
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--mute)' }}>Perlu Restock</span>
            <div style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: lowStockMaterials.length > 0 ? 'var(--warns)' : 'var(--oks)',
              color: lowStockMaterials.length > 0 ? 'var(--warn)' : 'var(--ok)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <AlertTriangle size={16} />
            </div>
          </div>
          <strong style={{ fontSize: 22, color: lowStockMaterials.length > 0 ? 'var(--warn)' : 'var(--ok)' }}>
            {lowStockMaterials.length} Bahan
          </strong>
          <span style={{ fontSize: 11, color: 'var(--mute)', marginTop: 'auto' }}>
            {outOfStockCount > 0 ? `${outOfStockCount} bahan habis total` : 'Semua bahan dalam kondisi aman'}
          </span>
        </div>

        {/* KPI 3 */}
        <div style={{
          padding: '14px 16px 12px',
          background: 'var(--panel)',
          border: '1px solid var(--line)',
          borderRadius: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 6
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--mute)' }}>Valuasi Aset Bahan</span>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--oks)', color: 'var(--ok)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DollarSign size={16} />
            </div>
          </div>
          <strong style={{ fontSize: 22, color: 'var(--ink)' }}>{formatRp(totalValuation)}</strong>
          <span style={{ fontSize: 11, color: 'var(--mute)', marginTop: 'auto' }}>
            Total nilai modal stok saat ini
          </span>
        </div>

        {/* KPI 4 */}
        <div style={{
          padding: '14px 16px 12px',
          background: 'var(--panel)',
          border: '1px solid var(--line)',
          borderRadius: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 6
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--mute)' }}>Bumbu Olahan Aktif</span>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(139, 92, 246, 0.12)', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ChefHat size={16} />
            </div>
          </div>
          <strong style={{ fontSize: 22, color: 'var(--ink)' }}>{semiFinishedCount} Resep</strong>
          <span style={{ fontSize: 11, color: 'var(--mute)', marginTop: 'auto' }}>
            Racikan bumbu siap pakai
          </span>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div style={{
        display: 'flex',
        gap: 8,
        borderBottom: '1px solid var(--line)',
        marginBottom: 20
      }}>
        <button
          type="button"
          onClick={() => setActiveTab('history')}
          style={{
            padding: '10px 18px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'history' ? '2px solid var(--acc)' : '2px solid transparent',
            color: activeTab === 'history' ? 'var(--acc)' : 'var(--mute)',
            fontWeight: 700,
            fontSize: 13.5,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}
        >
          <Clock size={16} />
          Riwayat Pengelolaan & Mutasi ({movements.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('stock')}
          style={{
            padding: '10px 18px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'stock' ? '2px solid var(--acc)' : '2px solid transparent',
            color: activeTab === 'stock' ? 'var(--acc)' : 'var(--mute)',
            fontWeight: 700,
            fontSize: 13.5,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}
        >
          <Layers size={16} />
          Status Persediaan Stok ({materials.length})
        </button>
      </div>

      {/* TAB 1: RIWAYAT MUTASI & AUDIT */}
      {activeTab === 'history' && (
        <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 16, padding: '20px', boxShadow: 'var(--shadow-soft)' }}>
          {/* Controls Bar */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, flex: 1, minWidth: 260 }}>
              {/* Search */}
              <div style={{ position: 'relative', minWidth: 220, flex: 1 }}>
                <Search size={15} style={{ position: 'absolute', left: 12, top: 11, color: 'var(--mute)' }} />
                <input
                  type="text"
                  placeholder="Cari bahan baku, catatan, atau admin..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 34px',
                    borderRadius: 9,
                    border: '1px solid var(--line)',
                    background: 'var(--bg)',
                    color: 'var(--ink)',
                    fontSize: 13,
                    outline: 'none'
                  }}
                />
              </div>

              {/* Tipe Mutasi */}
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
                style={{
                  padding: '8px 12px',
                  borderRadius: 9,
                  border: '1px solid var(--line)',
                  background: 'var(--bg)',
                  color: 'var(--ink)',
                  fontSize: 12.5,
                  outline: 'none'
                }}
              >
                <option value="all">Semua Jenis Mutasi</option>
                <option value="in">Restock Masuk</option>
                <option value="out">Pengurangan</option>
                <option value="production">Olah Bumbu (Produksi)</option>
                <option value="sale_usage">Pemakaian Penjualan</option>
                <option value="void_return">Pengembalian Void</option>
                <option value="adjustment">Audit Opname</option>
              </select>

              {/* Bahan Baku Spesifik */}
              <select
                value={selectedMaterialId}
                onChange={(e) => setSelectedMaterialId(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: 9,
                  border: '1px solid var(--line)',
                  background: 'var(--bg)',
                  color: 'var(--ink)',
                  fontSize: 12.5,
                  outline: 'none',
                  maxWidth: 200
                }}
              >
                <option value="all">Semua Bahan Baku</option>
                {materials.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>

              {/* Rentang Waktu */}
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as any)}
                style={{
                  padding: '8px 12px',
                  borderRadius: 9,
                  border: '1px solid var(--line)',
                  background: 'var(--bg)',
                  color: 'var(--ink)',
                  fontSize: 12.5,
                  outline: 'none'
                }}
              >
                <option value="all">Semua Waktu</option>
                <option value="today">Hari Ini</option>
                <option value="7days">7 Hari Terakhir</option>
                <option value="30days">30 Hari Terakhir</option>
              </select>
            </div>

            {/* Export CSV button */}
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={filteredMovements.length === 0}
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Download size={14} />
              Ekspor CSV ({filteredMovements.length})
            </button>
          </div>

          {/* Table */}
          <div className="table-wrap">
            <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--line)', color: 'var(--mute)', textAlign: 'left' }}>
                  <th style={{ padding: '10px 14px', fontWeight: 650 }}>Waktu</th>
                  <th style={{ padding: '10px 14px', fontWeight: 650 }}>Bahan Baku</th>
                  <th style={{ padding: '10px 14px', fontWeight: 650 }}>Jenis Aktivitas</th>
                  <th style={{ padding: '10px 14px', fontWeight: 650, textAlign: 'right' }}>Perubahan</th>
                  <th style={{ padding: '10px 14px', fontWeight: 650, textAlign: 'right' }}>Stok Akhir</th>
                  <th style={{ padding: '10px 14px', fontWeight: 650 }}>Dilakukan Oleh</th>
                  <th style={{ padding: '10px 14px', fontWeight: 650 }}>Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {filteredMovements.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '36px 14px', color: 'var(--mute)' }}>
                      Belum ada riwayat mutasi bahan baku yang cocok dengan filter.
                    </td>
                  </tr>
                ) : (
                  filteredMovements.map(mov => {
                    const isPositive = mov.quantity > 0
                    return (
                      <tr key={mov.id} style={{ borderBottom: '1px solid var(--line)' }}>
                        <td style={{ padding: '11px 14px', whiteSpace: 'nowrap', color: 'var(--mute)', fontSize: 12 }}>
                          {formatDate(mov.created_at)}
                        </td>
                        <td style={{ padding: '11px 14px', fontWeight: 600, color: 'var(--ink)' }}>
                          {mov.raw_material_name}
                        </td>
                        <td style={{ padding: '11px 14px' }}>
                          {renderMovementBadge(mov.type)}
                        </td>
                        <td style={{
                          padding: '11px 14px',
                          textAlign: 'right',
                          fontWeight: 700,
                          color: isPositive ? 'var(--ok)' : 'var(--bad)',
                          fontVariantNumeric: 'tabular-nums'
                        }}>
                          {isPositive ? `+${mov.quantity}` : mov.quantity} {mov.unit}
                        </td>
                        <td style={{ padding: '11px 14px', textAlign: 'right', color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
                          <span style={{ color: 'var(--mute)', fontSize: 11 }}>{mov.previous_stock} → </span>
                          <strong>{mov.current_stock}</strong> {mov.unit}
                        </td>
                        <td style={{ padding: '11px 14px', color: 'var(--ink)' }}>
                          <span style={{ fontWeight: 600 }}>{mov.creator_name || 'Admin Toko'}</span>
                          {mov.creator_role && (
                            <span style={{
                              marginLeft: 6,
                              fontSize: 10,
                              padding: '1px 5px',
                              borderRadius: 4,
                              background: 'var(--accs)',
                              color: 'var(--acc)',
                              textTransform: 'uppercase'
                            }}>
                              {mov.creator_role}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '11px 14px', color: 'var(--mute)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={mov.note || ''}>
                          {mov.note || '-'}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: STATUS PERSEDIAAN STOK (READ-ONLY) */}
      {activeTab === 'stock' && (
        <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 16, padding: '20px', boxShadow: 'var(--shadow-soft)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <div style={{ position: 'relative', width: 300 }}>
              <Search size={15} style={{ position: 'absolute', left: 12, top: 11, color: 'var(--mute)' }} />
              <input
                type="text"
                placeholder="Cari nama bahan baku..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 34px',
                  borderRadius: 9,
                  border: '1px solid var(--line)',
                  background: 'var(--bg)',
                  color: 'var(--ink)',
                  fontSize: 13,
                  outline: 'none'
                }}
              />
            </div>
            <span style={{ fontSize: 12, color: 'var(--mute)' }}>
              Menampilkan {filteredMaterials.length} bahan baku
            </span>
          </div>

          <div className="table-wrap">
            <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--line)', color: 'var(--mute)', textAlign: 'left' }}>
                  <th style={{ padding: '10px 14px', fontWeight: 650 }}>Nama Bahan</th>
                  <th style={{ padding: '10px 14px', fontWeight: 650 }}>Tipe</th>
                  <th style={{ padding: '10px 14px', fontWeight: 650 }}>Tingkat Persediaan</th>
                  <th style={{ padding: '10px 14px', fontWeight: 650, textAlign: 'right' }}>Harga Modal (HPP)</th>
                  <th style={{ padding: '10px 14px', fontWeight: 650, textAlign: 'right' }}>Valuasi Aset</th>
                  <th style={{ padding: '10px 14px', fontWeight: 650, textAlign: 'center' }}>Resep / Komposisi</th>
                </tr>
              </thead>
              <tbody>
                {filteredMaterials.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '36px 14px', color: 'var(--mute)' }}>
                      Tidak ada bahan baku yang ditemukan.
                    </td>
                  </tr>
                ) : (
                  filteredMaterials.map(mat => {
                    const isOut = mat.stock === 0
                    const isLow = mat.stock <= mat.min_stock
                    const pct = mat.min_stock > 0 ? Math.round((mat.stock / mat.min_stock) * 100) : 100
                    const assetVal = mat.stock * mat.cost_per_unit

                    return (
                      <tr key={mat.id} style={{ borderBottom: '1px solid var(--line)' }}>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ fontWeight: 650, color: 'var(--ink)' }}>{mat.name}</div>
                          {mat.sku && <div style={{ fontSize: 11, color: 'var(--mute)' }}>SKU: {mat.sku}</div>}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          {mat.material_type === 'semi_finished' ? (
                            <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'rgba(139, 92, 246, 0.12)', color: '#8b5cf6' }}>
                              🧂 Bumbu Olahan
                            </span>
                          ) : (
                            <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'var(--accs)', color: 'var(--acc)' }}>
                              🥩 Bahan Mentah
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px 14px', minWidth: 200 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
                            <span style={{ fontWeight: 700, color: isOut ? 'var(--bad)' : isLow ? 'var(--warn)' : 'var(--ink)' }}>
                              {mat.stock} {mat.unit}
                            </span>
                            <span style={{ color: 'var(--mute)', fontSize: 11 }}>
                              Min: {mat.min_stock} {mat.unit}
                            </span>
                          </div>
                          <div style={{ height: 6, background: 'var(--line)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{
                              height: '100%',
                              width: `${Math.min(pct, 100)}%`,
                              background: isOut ? 'var(--bad)' : isLow ? 'var(--warn)' : 'var(--ok)',
                              borderRadius: 3
                            }} />
                          </div>
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
                          {formatRp(mat.cost_per_unit)} / {mat.unit}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
                          {formatRp(assetVal)}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                          {mat.material_type === 'semi_finished' ? (
                            <button
                              type="button"
                              onClick={() => setRecipeModalMaterial(mat)}
                              className="btn btn-secondary btn-sm"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11 }}
                            >
                              <Eye size={13} />
                              Lihat Resep ({mat.sub_ingredients?.length || 0})
                            </button>
                          ) : (
                            <span style={{ fontSize: 11.5, color: 'var(--mute)' }}>
                              Digunakan di {mat.products_count} Menu
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Detail Komposisi Bumbu Olahan (Read-only) */}
      {recipeModalMaterial && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 16
        }}>
          <div style={{
            background: 'var(--panel)',
            border: '1px solid var(--line)',
            borderRadius: 16,
            width: '100%',
            maxWidth: 520,
            padding: 24,
            maxHeight: 'calc(100dvh - 32px)',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>
                  Komposisi Resep: {recipeModalMaterial.name}
                </h3>
                <p style={{ fontSize: 12, color: 'var(--mute)', margin: '4px 0 0' }}>
                  Standar takaran 1 batch ({recipeModalMaterial.batch_yield || 1000} {recipeModalMaterial.unit})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRecipeModalMaterial(null)}
                style={{ background: 'none', border: 'none', color: 'var(--mute)', cursor: 'pointer', fontSize: 18 }}
              >
                ✕
              </button>
            </div>

            <div style={{ background: 'var(--bg)', borderRadius: 12, padding: 14, marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--mute)', marginBottom: 8, fontWeight: 600 }}>
                Rempah-Rempah Penyusun:
              </div>
              {(!recipeModalMaterial.sub_ingredients || recipeModalMaterial.sub_ingredients.length === 0) ? (
                <div style={{ color: 'var(--mute)', fontSize: 12 }}>Belum ada komposisi rempah yang didaftarkan.</div>
              ) : (
                (() => {
                  const modalRatios = calculateRecipeRatios(
                    (recipeModalMaterial.sub_ingredients || []).map(s => ({
                      sub_material_id: s.sub_material_id,
                      sub_material_name: s.sub_material?.name || 'Rempah',
                      quantity: s.quantity,
                      unit: s.unit
                    }))
                  )
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {recipeModalMaterial.sub_ingredients.map((sub, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12.5, borderBottom: '1px dashed var(--line)', paddingBottom: 6 }}>
                          <span style={{ fontWeight: 600, color: 'var(--ink)' }}>
                            {sub.sub_material?.name || 'Rempah'}
                          </span>
                          <span style={{ color: 'var(--mute)', fontVariantNumeric: 'tabular-nums' }}>
                            {sub.quantity} {sub.unit}{' '}
                            <span style={{ color: '#9333ea', fontWeight: 700, marginLeft: 6 }}>
                              ({modalRatios.items[idx]?.percentage || 0}%)
                            </span>
                          </span>
                        </div>
                      ))}
                      <div style={{ fontSize: 11, color: 'var(--mute)', marginTop: 4 }}>
                        *Total komposisi ({modalRatios.totalCompositionBase.toFixed(1)} g setara) menjadi acuan rasio proporsi saat restock tanpa input susut masak.
                      </div>
                    </div>
                  )
                })()
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12.5, color: 'var(--mute)', marginBottom: 18 }}>
              <span>Estimasi HPP Bumbu Jadi:</span>
              <strong style={{ color: 'var(--ink)', fontSize: 14 }}>
                {formatRp(recipeModalMaterial.cost_per_unit)} / {recipeModalMaterial.unit}
              </strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setRecipeModalMaterial(null)}
                className="btn btn-secondary"
                style={{ fontSize: 12.5 }}
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

