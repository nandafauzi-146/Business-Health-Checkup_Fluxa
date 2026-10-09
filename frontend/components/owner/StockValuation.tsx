'use client'

import { useState } from 'react'
import { Package, DollarSign, TrendingUp, AlertTriangle, Search, Layers } from 'lucide-react'
import { PageHeader } from '@/components/layout/Topbar'
import { KpiCard, SectionCard, StatusTag, FormatRupiah } from '@/components/ui/Cards'

interface ProductValuation {
  id: string
  name: string
  category_name: string | null
  stock: number
  min_stock: number
  unit: string
  buy_price: number
  sell_price: number
  asset_value: number
  potential_revenue: number
  potential_profit: number
}

interface StockValuationProps {
  totalAssetValue: number
  totalPotentialRevenue: number
  totalPotentialProfit: number
  lowStockCount: number
  products: ProductValuation[]
}

export default function StockValuationClient({
  totalAssetValue,
  totalPotentialRevenue,
  totalPotentialProfit,
  lowStockCount,
  products
}: StockValuationProps) {
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('all')

  const categories = Array.from(new Set(products.map(p => p.category_name).filter(Boolean))) as string[]

  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase())
    const matchCat = filterCategory === 'all' ? true : p.category_name === filterCategory
    return matchSearch && matchCat
  })

  return (
    <div>
      <PageHeader
        title="Monitoring Inventaris & Valuasi Stok"
        subtitle="Analisis modal tertahan dalam persediaan barang, nilai aset gudang, dan potensi keuntungan stok"
      />

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 }}>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: 'var(--accs)', color: 'var(--acc)' }}>
            <Layers size={20} />
          </div>
          <div className="kpi-label">Total Nilai Aset Stok (HPP)</div>
          <div className="kpi-value" style={{ color: 'var(--acc)' }}>
            <FormatRupiah amount={totalAssetValue} />
          </div>
          <div className="kpi-sub">Modal barang yang ada di gudang</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: 'var(--oks)', color: 'var(--ok)' }}>
            <DollarSign size={20} />
          </div>
          <div className="kpi-label">Potensi Omzet Penjualan</div>
          <div className="kpi-value" style={{ color: 'var(--ok)' }}>
            <FormatRupiah amount={totalPotentialRevenue} />
          </div>
          <div className="kpi-sub">Jika seluruh stok terjual habis</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: 'var(--oks)', color: 'var(--ok)' }}>
            <TrendingUp size={20} />
          </div>
          <div className="kpi-label">Proyeksi Laba Kotor Stok</div>
          <div className="kpi-value" style={{ color: 'var(--ok)' }}>
            <FormatRupiah amount={totalPotentialProfit} />
          </div>
          <div className="kpi-sub">
            Margin: {totalPotentialRevenue > 0 ? ((totalPotentialProfit / totalPotentialRevenue) * 100).toFixed(1) : 0}%
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: lowStockCount > 0 ? 'var(--warns)' : 'var(--oks)', color: lowStockCount > 0 ? 'var(--warn)' : 'var(--ok)' }}>
            <AlertTriangle size={20} />
          </div>
          <div className="kpi-label">Produk Perlu Restock</div>
          <div className="kpi-value" style={{ color: lowStockCount > 0 ? 'var(--warn)' : 'var(--ok)' }}>
            {lowStockCount} SKU
          </div>
          <div className="kpi-sub">Stok di bawah batas minimum</div>
        </div>
      </div>

      <SectionCard>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <div className="search-bar" style={{ flex: 1, minWidth: 240 }}>
            <Search size={15} color="var(--mute)" />
            <input
              type="text"
              placeholder="Cari nama produk..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent' }}
            />
          </div>

          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            style={{
              padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)',
              background: 'var(--panel)', fontSize: 13, outline: 'none'
            }}
          >
            <option value="all">Semua Kategori</option>
            {categories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Produk</th>
                <th>Kategori</th>
                <th>Sisa Stok</th>
                <th>Harga Beli (Modal)</th>
                <th>Harga Jual</th>
                <th>Nilai Aset Modal</th>
                <th>Potensi Omzet</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '32px 0', color: 'var(--mute)' }}>
                    Tidak ada produk ditemukan
                  </td>
                </tr>
              ) : (
                filtered.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                    <td style={{ fontSize: 12, color: 'var(--mute)' }}>{p.category_name || '-'}</td>
                    <td style={{ fontWeight: 700 }}>
                      {p.stock} <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--mute)' }}>{p.unit}</span>
                    </td>
                    <td style={{ fontSize: 13 }}><FormatRupiah amount={p.buy_price} /></td>
                    <td style={{ fontSize: 13 }}><FormatRupiah amount={p.sell_price} /></td>
                    <td style={{ fontWeight: 600, color: 'var(--acc)' }}>
                      <FormatRupiah amount={p.asset_value} />
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--ok)' }}>
                      <FormatRupiah amount={p.potential_revenue} />
                    </td>
                    <td>
                      {p.stock <= 0 ? (
                        <StatusTag type="bad" label="Habis" />
                      ) : p.stock <= p.min_stock ? (
                        <StatusTag type="warn" label="Menipis" />
                      ) : (
                        <StatusTag type="ok" label="Aman" />
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  )
}
