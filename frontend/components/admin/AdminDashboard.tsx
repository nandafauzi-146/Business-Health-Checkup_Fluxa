'use client'

import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { ShoppingCart, Package, TrendingUp, DollarSign, ArrowRight, Layers, CreditCard, Building2, Scale } from 'lucide-react'
import { KpiCard, SectionCard, StatusTag } from '@/components/ui/Cards'
import { PageHeader } from '@/components/layout/Topbar'
import type { Database } from '@/lib/supabase/types'
import Link from 'next/link'

type DailySale = Database['public']['Views']['v_daily_sales_summary']['Row']
type LowStockProduct = Database['public']['Views']['v_low_stock_products']['Row']
type SaleRow = Database['public']['Tables']['sales']['Row']
type RecentSale = Pick<SaleRow, 'id' | 'invoice_number' | 'final_amount' | 'payment_method' | 'status' | 'created_at'> & {
  customers: { name: string } | { name: string }[] | null
}
type VoidedSale = Pick<
  SaleRow,
  'id' | 'invoice_number' | 'final_amount' | 'void_reason' | 'voided_at' | 'created_at'
> & {
  profiles: { full_name: string } | { full_name: string }[] | null
}

function AnimatedStat({
  label,
  value,
  format,
  icon,
  description,
}: {
  label: string
  value: number
  format: (value: number) => string
  icon: React.ReactNode
  description: string
}) {
  const [displayValue, setDisplayValue] = useState(value)

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const duration = prefersReducedMotion ? 0 : 480
    let frame = 0
    let startTime: number | undefined

    const update = (time: number) => {
      if (startTime === undefined) startTime = time
      const progress = duration === 0 ? 1 : Math.min((time - startTime) / duration, 1)
      const easedProgress = 1 - (1 - progress) ** 3
      setDisplayValue(Math.round(value * easedProgress))
      if (progress < 1) frame = window.requestAnimationFrame(update)
    }

    frame = window.requestAnimationFrame(update)
    return () => window.cancelAnimationFrame(frame)
  }, [value])

  return (
    <KpiCard
      className="admin-dashboard-kpi"
      label={label}
      value={format(displayValue)}
      icon={icon}
      changeLabel={description}
    />
  )
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(true)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches)
    updatePreference()
    mediaQuery.addEventListener('change', updatePreference)

    return () => mediaQuery.removeEventListener('change', updatePreference)
  }, [])

  return prefersReducedMotion
}

function formatRp(n: number) {
  return 'Rp' + new Intl.NumberFormat('id-ID').format(n)
}

const payMethodLabel: Record<string, { label: string; bg: string; color: string }> = {
  cash: { label: 'Tunai', bg: 'var(--oks)', color: 'var(--ok)' },
  qris: { label: 'QRIS', bg: 'var(--accs)', color: 'var(--acc)' },
  transfer: { label: 'Transfer', bg: 'rgba(138, 63, 252, 0.12)', color: '#8A3FFC' },
  credit: { label: 'Non-tunai', bg: 'var(--warns)', color: 'var(--warn)' }
}

const DEMO_DAILY_SALES: DailySale[] = [
  { sale_date: '2026-10-11', total_revenue: 1250000, transaction_count: 14, cash_revenue: 750000, non_cash_revenue: 500000, credit_revenue: 0 },
  { sale_date: '2026-10-12', total_revenue: 1420000, transaction_count: 16, cash_revenue: 820000, non_cash_revenue: 600000, credit_revenue: 0 },
  { sale_date: '2026-10-13', total_revenue: 1180000, transaction_count: 12, cash_revenue: 680000, non_cash_revenue: 500000, credit_revenue: 0 },
  { sale_date: '2026-10-14', total_revenue: 1650000, transaction_count: 18, cash_revenue: 950000, non_cash_revenue: 700000, credit_revenue: 0 },
  { sale_date: '2026-10-15', total_revenue: 1890000, transaction_count: 21, cash_revenue: 1100000, non_cash_revenue: 790000, credit_revenue: 0 },
  { sale_date: '2026-10-16', total_revenue: 1720000, transaction_count: 19, cash_revenue: 980000, non_cash_revenue: 740000, credit_revenue: 0 },
  { sale_date: '2026-10-17', total_revenue: 1540000, transaction_count: 17, cash_revenue: 890000, non_cash_revenue: 650000, credit_revenue: 0 },
]

const DEMO_RECENT_SALES: RecentSale[] = [
  { id: 's-1', invoice_number: 'INV-20261017-89A1', final_amount: 145000, payment_method: 'cash', status: 'completed', created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(), customers: { name: 'Budi Santoso' } },
  { id: 's-2', invoice_number: 'INV-20261017-71F9', final_amount: 92000, payment_method: 'qris', status: 'completed', created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(), customers: null },
  { id: 's-3', invoice_number: 'INV-20261017-32D8', final_amount: 210000, payment_method: 'transfer', status: 'completed', created_at: new Date(Date.now() - 1000 * 60 * 110).toISOString(), customers: { name: 'Siti Rahmawati' } },
  { id: 's-4', invoice_number: 'INV-20261017-55E2', final_amount: 65000, payment_method: 'cash', status: 'completed', created_at: new Date(Date.now() - 1000 * 60 * 180).toISOString(), customers: null },
  { id: 's-5', invoice_number: 'INV-20261017-19B4', final_amount: 120000, payment_method: 'qris', status: 'completed', created_at: new Date(Date.now() - 1000 * 60 * 240).toISOString(), customers: { name: 'Warung Bu Joko' } },
]

interface Props {
  dailySales: DailySale[]
  lowStockProducts: LowStockProduct[]
  recentSales: RecentSale[]
  voidedSales?: VoidedSale[]
  todaySummary: DailySale | null
  totalProducts: number | null
}

export default function AdminDashboardClient({
  dailySales,
  lowStockProducts,
  recentSales,
  voidedSales = [],
  todaySummary,
  totalProducts
}: Props) {
  const isDemo = (!dailySales || dailySales.length === 0) && (!recentSales || recentSales.length === 0)
  const daily = isDemo ? DEMO_DAILY_SALES : dailySales
  const lowStock = lowStockProducts
  const sales = isDemo ? DEMO_RECENT_SALES : recentSales
  const voidList = voidedSales
  const prefersReducedMotion = usePrefersReducedMotion()

  // Ambil summary hari ini: dari database atau dari demo data
  const activeToday = todaySummary ?? (isDemo ? DEMO_DAILY_SALES[DEMO_DAILY_SALES.length - 1] : null)
  const revenue = activeToday ? Number(activeToday.total_revenue) : 0
  const transactionCount = activeToday ? Number(activeToday.transaction_count) : 0
  const averageBasket = revenue > 0 && transactionCount > 0
    ? Math.round(revenue / transactionCount)
    : 0
  const productsCount = totalProducts ?? 7

  return (
    <div className="admin-dashboard">
      <div className="admin-dashboard-enter" style={{ animationDelay: '0ms' }}>
        <PageHeader
          title="Dashboard Admin"
          subtitle="Ringkasan performa penjualan dan monitoring operasional toko hari ini"
          actions={
            <Link href="/admin/transaksi" className="btn btn-primary">
              <ShoppingCart size={15} /> Lihat Semua Transaksi
            </Link>
          }
        />
      </div>

      {/* KPIs Grid */}
      <div className="kpi-grid">
        <AnimatedStat
          label="Omzet Penjualan Hari Ini"
          value={revenue}
          format={formatRp}
          icon={<DollarSign size={16} />}
          description="Dari transaksi hari ini"
        />
        <AnimatedStat
          label="Jumlah Transaksi"
          value={transactionCount}
          format={(value) => value.toLocaleString('id-ID')}
          icon={<ShoppingCart size={16} />}
          description="Transaksi hari ini"
        />
        <AnimatedStat
          label="Total Produk Aktif"
          value={productsCount}
          format={(value) => value.toLocaleString('id-ID')}
          icon={<Package size={16} />}
          description={`${lowStock.length} produk stok menipis`}
        />
        <AnimatedStat
          label="Rata-rata Keranjang Belanja"
          value={averageBasket}
          format={formatRp}
          icon={<TrendingUp size={16} />}
          description="Per nota transaksi hari ini"
        />
      </div>

      <div className="two-col">
        {/* Left: Chart & Recent Sales */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Chart */}
          <div className="admin-dashboard-enter" style={{ animationDelay: '150ms' }}>
            <SectionCard title="Tren Omzet 7 Hari Terakhir">
              {daily.length > 0 ? <ResponsiveContainer width="100%" height={210}>
                <BarChart data={daily} margin={{ top: 10, right: 0, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                  <XAxis
                    dataKey="sale_date"
                    tick={{ fontSize: 11, fill: 'var(--mute)' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => String(typeof value === 'string' && value.length > 2 ? value.slice(-2) : value)}
                  />
                  <Tooltip
                    formatter={(value, name) => [
                      String(name) === 'total_revenue' ? formatRp(Number(value ?? 0)) : String(value ?? ''),
                      String(name) === 'total_revenue' ? 'Omzet' : 'Transaksi'
                    ]}
                    contentStyle={{
                      background: 'var(--panel)',
                      border: '1px solid var(--line)',
                      borderRadius: 12,
                      fontSize: 12.5,
                      color: 'var(--ink)',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.12)'
                    }}
                  />
                  <Bar
                    dataKey="total_revenue"
                    radius={[6, 6, 0, 0]}
                    fill="var(--acc)"
                    isAnimationActive={!prefersReducedMotion}
                    animationDuration={650}
                    animationEasing="ease-out"
                  />
                </BarChart>
              </ResponsiveContainer> : <div className="dashboard-empty-state" style={{ height: 210, display: 'grid', placeItems: 'center' }}>Belum ada data omzet untuk ditampilkan.</div>}
            </SectionCard>
          </div>

          {/* Recent sales */}
          <div className="admin-dashboard-enter" style={{ animationDelay: '300ms' }}>
            <SectionCard
              title="Transaksi Kasir Terbaru"
              action={
                <Link href="/admin/transaksi" className="btn btn-secondary btn-sm">
                  Lihat Semua <ArrowRight size={12} />
                </Link>
              }
            >
              {sales.length > 0 ? <div className="table-container">
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
                    {sales.map((s, index) => {
                      const pay = payMethodLabel[s.payment_method] || { label: s.payment_method, bg: 'var(--bg)', color: 'var(--ink)' }

                      return (
                        <tr key={s.id} className="admin-dashboard-table-row" style={{ animationDelay: `${320 + index * 35}ms` }}>
                          <td>
                            <span style={{ fontWeight: 600, fontSize: 12.5, fontFamily: 'monospace', color: 'var(--acc)' }}>
                              {s.invoice_number}
                            </span>
                          </td>
                          <td style={{ fontSize: 13 }}>
                            {(Array.isArray(s.customers) ? s.customers[0]?.name : s.customers?.name) || <span style={{ color: 'var(--mute)', fontStyle: 'italic' }}>Umum</span>}
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
              </div> : <div className="dashboard-empty-state">Belum ada transaksi terbaru.</div>}
            </SectionCard>
          </div>
        </div>

        {/* Right: Low Stock & Quick Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Low stock */}
          <div className="admin-dashboard-enter" style={{ animationDelay: '225ms' }}>
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
                <div className="admin-stock-list" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {lowStock.map((p, index) => {
                    const pct = p.min_stock > 0 ? Math.round((p.stock / p.min_stock) * 100) : 0
                    const isCritical = p.stock <= 0 || pct < 30

                    return (
                      <div
                        key={p.id}
                        style={{
                          padding: '12px 14px',
                          background: 'var(--bg)',
                          border: '1px solid var(--line)',
                          borderRadius: 12,
                          ['--stock-delay' as string]: `${index * 65}ms`
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
                            <div className="admin-stock-progress-fill" style={{
                              ['--stock-progress' as string]: `${Math.min(pct, 100)}%`,
                              height: '100%',
                              width: 'var(--stock-progress)',
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
          </div>

          {/* Laporan Refund & Pembatalan Kasir */}
          <div className="admin-dashboard-enter" style={{ animationDelay: '300ms' }}>
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
                  {voidList.map((v) => (
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
                            Kasir: {(Array.isArray(v.profiles) ? v.profiles[0]?.full_name : v.profiles?.full_name) || 'Kasir'} • {new Date(v.voided_at || v.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
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
          </div>

          {/* Quick actions */}
          <div className="admin-dashboard-enter" style={{ animationDelay: '375ms' }}>
            <SectionCard title="Akses Cepat Modul Admin">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
                {[
                  { label: 'Katalog Produk', href: '/admin/produk', icon: <Package size={18} />, color: 'var(--acc)', bg: 'var(--accs)' },
                  { label: 'Audit Stok', href: '/admin/stok', icon: <Layers size={18} />, color: 'var(--ok)', bg: 'var(--oks)' },
                  { label: 'Catat Biaya', href: '/admin/biaya', icon: <DollarSign size={18} />, color: 'var(--warn)', bg: 'var(--warns)' },
                  { label: 'Hutang & Piutang', href: '/admin/hutang-piutang', icon: <Scale size={18} />, color: 'var(--warn)', bg: 'var(--warns)' },
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
    </div>
  )
}
