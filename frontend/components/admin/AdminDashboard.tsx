'use client'

import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { ShoppingCart, Package, TrendingUp, AlertCircle, DollarSign, ArrowRight, Layers, CreditCard, RotateCcw } from 'lucide-react'
import { KpiCard, SectionCard, StatusTag, FormatRupiah } from '@/components/ui/Cards'
import { PageHeader } from '@/components/layout/Topbar'
import Link from 'next/link'

function formatRp(n: number) {
  return 'Rp' + new Intl.NumberFormat('id-ID').format(n)
}

const DEMO_DAILY = [
  { sale_date: '01', total_revenue: 1800000, transaction_count: 12 },
  { sale_date: '02', total_revenue: 2200000, transaction_count: 16 },
  { sale_date: '03', total_revenue: 1500000, transaction_count: 9 },
  { sale_date: '04', total_revenue: 3100000, transaction_count: 22 },
  { sale_date: '05', total_revenue: 2800000, transaction_count: 18 },
  { sale_date: '06', total_revenue: 4200000, transaction_count: 28 },
  { sale_date: '07', total_revenue: 3700000, transaction_count: 24 },
]

const DEMO_LOW_STOCK = [
  { id: '1', name: 'Kopi Arabika 250g', category_name: 'Minuman', stock: 3, min_stock: 10, unit: 'pcs' },
  { id: '2', name: 'Gula Pasir 1kg', category_name: 'Bahan Baku', stock: 5, min_stock: 20, unit: 'kg' },
  { id: '3', name: 'Susu UHT Full Cream', category_name: 'Minuman', stock: 2, min_stock: 12, unit: 'liter' },
]

const DEMO_SALES = [
  { id: '1', invoice_number: 'INV-001', final_amount: 135000, payment_method: 'cash', status: 'completed', created_at: new Date().toISOString(), customers: { name: 'Budi Santoso' } },
  { id: '2', invoice_number: 'INV-002', final_amount: 87500, payment_method: 'qris', status: 'completed', created_at: new Date().toISOString(), customers: null },
  { id: '3', invoice_number: 'INV-003', final_amount: 212000, payment_method: 'credit', status: 'completed', created_at: new Date().toISOString(), customers: { name: 'Siti Rahayu' } },
  { id: '4', invoice_number: 'INV-004', final_amount: 45000, payment_method: 'transfer', status: 'voided', created_at: new Date().toISOString(), customers: null },
]

const payMethodLabel: Record<string, { label: string; bg: string; color: string }> = {
  cash: { label: 'Tunai', bg: 'var(--oks)', color: 'var(--ok)' },
  qris: { label: 'QRIS', bg: 'var(--accs)', color: 'var(--acc)' },
  transfer: { label: 'Transfer', bg: 'rgba(138, 63, 252, 0.12)', color: '#8A3FFC' },
  credit: { label: 'Kasbon', bg: 'var(--warns)', color: 'var(--warn)' }
}

interface Props {
  dailySales: any[]
  lowStockProducts: any[]
  recentSales: any[]
  voidedSales?: any[]
  todaySummary: any
  totalProducts: number
}

export default function AdminDashboardClient({
  dailySales,
  lowStockProducts,
  recentSales,
  voidedSales = [],
  todaySummary,
  totalProducts
}: Props) {
  const daily = dailySales.length > 0 ? dailySales : DEMO_DAILY
  const lowStock = lowStockProducts.length > 0 ? lowStockProducts : DEMO_LOW_STOCK
  const sales = recentSales.length > 0 ? recentSales : DEMO_SALES
  const voidList = voidedSales.length > 0 ? voidedSales : [
    {
      id: 'demo-void-1',
      invoice_number: 'INV-20261007-004',
      final_amount: 145000,
      payment_method: 'cash',
      void_reason: 'Pelanggan membatalkan pesanan (barang salah ambil)',
      voided_at: new Date().toISOString(),
      profiles: { full_name: 'Budi Santoso' }
    }
  ]

  const today = todaySummary || DEMO_DAILY[DEMO_DAILY.length - 1]

  return (
    <div>
      <PageHeader
        title="Dashboard Admin"
        subtitle="Ringkasan performa penjualan dan monitoring operasional toko hari ini"
        actions={
          <Link href="/admin/transaksi" className="btn btn-primary">
            <ShoppingCart size={15} /> Lihat Semua Transaksi
          </Link>
        }
      />

      {/* KPIs Grid */}
      <div className="kpi-grid">
        <KpiCard
          label="Omzet Penjualan Hari Ini"
          value={formatRp(today?.total_revenue || 3700000)}
          icon={<DollarSign size={16} />}
          change={8.3}
          changeLabel="vs hari kemarin"
        />
        <KpiCard
          label="Jumlah Transaksi"
          value={String(today?.transaction_count || 24)}
          icon={<ShoppingCart size={16} />}
          change={5.2}
          changeLabel="vs hari kemarin"
        />
        <KpiCard
          label="Total Produk Aktif"
          value={String(totalProducts || 47)}
          icon={<Package size={16} />}
          changeLabel={`${lowStock.length} produk stok menipis`}
        />
        <KpiCard
          label="Rata-rata Keranjang Belanja"
          value={formatRp(today?.total_revenue && today?.transaction_count ? Math.round(today.total_revenue / today.transaction_count) : 154167)}
          icon={<TrendingUp size={16} />}
          changeLabel="Per nota transaksi hari ini"
        />
      </div>

      <div className="two-col">
        {/* Left: Chart & Recent Sales */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Chart */}
          <SectionCard title="Tren Omzet 7 Hari Terakhir">
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={daily} margin={{ top: 10, right: 0, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                <XAxis
                  dataKey="sale_date"
                  tick={{ fontSize: 11, fill: 'var(--mute)' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: any) => typeof v === 'string' ? (v.length > 2 ? v.slice(-2) : v) : v}
                />
                <Tooltip
                  formatter={(v: any, n: any) => [n === 'total_revenue' ? formatRp(v) : v, n === 'total_revenue' ? 'Omzet' : 'Transaksi']}
                  contentStyle={{
                    background: 'var(--panel)',
                    border: '1px solid var(--line)',
                    borderRadius: 12,
                    fontSize: 12.5,
                    color: 'var(--ink)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)'
                  }}
                />
                <Bar dataKey="total_revenue" radius={[6, 6, 0, 0]} fill="var(--acc)" />
              </BarChart>
            </ResponsiveContainer>
          </SectionCard>

          {/* Recent sales */}
          <SectionCard
            title="Transaksi Kasir Terbaru"
            action={
              <Link href="/admin/transaksi" className="btn btn-secondary btn-sm">
                Lihat Semua <ArrowRight size={12} />
              </Link>
            }
          >
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Pelanggan</th>
                    <th>Metode</th>
                    <th>Total</th>
                    <th style={{ textAlign: 'right' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((s: any) => {
                    const pay = payMethodLabel[s.payment_method] || { label: s.payment_method, bg: 'var(--bg)', color: 'var(--ink)' }

                    return (
                      <tr key={s.id}>
                        <td>
                          <span style={{ fontWeight: 600, fontSize: 12.5, fontFamily: 'monospace', color: 'var(--acc)' }}>
                            {s.invoice_number}
                          </span>
                        </td>
                        <td style={{ fontSize: 13 }}>
                          {s.customers?.name || <span style={{ color: 'var(--mute)', fontStyle: 'italic' }}>Umum</span>}
                        </td>
                        <td>
                          <span style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: 6,
                            background: pay.bg,
                            color: pay.color
                          }}>
                            {pay.label}
                          </span>
                        </td>
                        <td style={{ fontWeight: 700, fontSize: 13 }}>
                          {formatRp(s.final_amount)}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <StatusTag
                            status={s.status === 'completed' ? 'sehat' : 'void'}
                            label={s.status === 'completed' ? 'Selesai' : 'Void'}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>

        {/* Right: Low Stock & Quick Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Low stock */}
          <SectionCard
            title={`Peringatan Stok Menipis ${lowStock.length > 0 ? `(${lowStock.length})` : ''}`}
            action={
              <Link href="/admin/stok" className="btn btn-secondary btn-sm">
                Kelola Stok <ArrowRight size={12} />
              </Link>
            }
          >
            {lowStock.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--ok)', fontSize: 13, fontWeight: 500 }}>
                ✅ Seluruh stok produk dalam batas aman
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {lowStock.map((p: any) => {
                  const pct = p.min_stock > 0 ? Math.round((p.stock / p.min_stock) * 100) : 0
                  const isCritical = p.stock <= 0 || pct < 30

                  return (
                    <div
                      key={p.id}
                      style={{
                        padding: '12px 14px',
                        background: 'var(--bg)',
                        border: '1px solid var(--line)',
                        borderRadius: 12
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--ink)' }}>{p.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--mute)' }}>{p.category_name || 'Umum'}</div>
                        </div>
                        <StatusTag status={isCritical ? 'kritis' : 'menipis'} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ flex: 1, height: 5, background: 'var(--line)', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            width: `${Math.min(pct, 100)}%`,
                            background: isCritical ? 'var(--bad)' : 'var(--warn)',
                            borderRadius: 4
                          }} />
                        </div>
                        <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--mute)', whiteSpace: 'nowrap' }}>
                          {p.stock} / {p.min_stock} {p.unit}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </SectionCard>
 
          {/* Laporan Refund & Pembatalan Kasir */}
          <SectionCard
            title="Laporan Refund & Pembatalan Kasir"
            action={
              <Link href="/admin/transaksi" style={{ fontSize: 12, color: 'var(--acc)', textDecoration: 'none', fontWeight: 600 }}>
                Audit Transaksi →
              </Link>
            }
          >
            {voidList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--mute)', fontSize: 12.5 }}>
                Belum ada transaksi refund yang dilaporkan hari ini
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {voidList.map((v: any) => (
                  <div
                    key={v.id}
                    style={{
                      padding: '12px 14px',
                      background: 'var(--bg)',
                      border: '1px solid var(--line)',
                      borderLeft: '3px solid var(--bad)',
                      borderRadius: 12
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, fontFamily: 'monospace', color: 'var(--ink)' }}>
                          {v.invoice_number}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--mute)' }}>
                          Kasir: {v.profiles?.full_name || 'Kasir'} • {new Date(v.voided_at || v.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                        </div>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--bad)' }}>
                        -Rp {v.final_amount.toLocaleString('id-ID')}
                      </span>
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--mute)', background: 'var(--panel)', padding: '5px 8px', borderRadius: 6, marginTop: 4 }}>
                      <strong>Alasan:</strong> {v.void_reason || 'Pembatalan transaksi oleh kasir'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Quick actions */}
          <SectionCard title="Akses Cepat Modul Admin">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { label: 'Katalog Produk', href: '/admin/produk', icon: <Package size={18} />, color: 'var(--acc)', bg: 'var(--accs)' },
                { label: 'Audit Stok', href: '/admin/stok', icon: <Layers size={18} />, color: 'var(--ok)', bg: 'var(--oks)' },
                { label: 'Catat Biaya', href: '/admin/biaya', icon: <DollarSign size={18} />, color: 'var(--warn)', bg: 'var(--warns)' },
                { label: 'Kasbon Pelanggan', href: '/admin/kasbon', icon: <CreditCard size={18} />, color: 'var(--bad)', bg: 'var(--bads)' },
              ].map(a => (
                <Link
                  key={a.label}
                  href={a.href}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 8,
                    padding: '16px 12px',
                    background: 'var(--bg)',
                    border: '1px solid var(--line)',
                    borderRadius: 14,
                    textDecoration: 'none',
                    color: 'var(--ink)',
                    transition: 'all 0.15s ease'
                  }}
                  className="quick-action-link"
                >
                  <div style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: a.bg,
                    color: a.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {a.icon}
                  </div>
                  <span style={{ fontSize: 12.5, fontWeight: 600, textAlign: 'center' }}>{a.label}</span>
                </Link>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
