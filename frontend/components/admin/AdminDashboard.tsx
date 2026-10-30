'use client'

import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { ShoppingCart, Package, TrendingUp, DollarSign, ArrowRight, Layers, CreditCard, Building2, Scale, Boxes, AlertCircle } from 'lucide-react'
import { SectionCard, StatusTag } from '@/components/ui/Cards'
import { PageHeader } from '@/components/layout/Topbar'
import type { Database } from '@/lib/supabase/types'
import Link from 'next/link'

type DailySale = Database['public']['Views']['v_daily_sales_summary']['Row']
type LowStockProduct = Database['public']['Views']['v_low_stock_products']['Row']
type SaleRow = Database['public']['Tables']['sales']['Row']
type RecentSale = Pick<SaleRow, 'id' | 'invoice_number' | 'final_amount' | 'payment_method' | 'status' | 'created_at'>
type VoidedSale = Pick<
  SaleRow,
  'id' | 'invoice_number' | 'final_amount' | 'void_reason' | 'voided_at' | 'created_at'
> & {
  profiles: { full_name: string } | { full_name: string }[] | null
}

export interface LowStockRawMaterial {
  id: string
  name: string
  stock: number
  min_stock: number
  unit: string
}

function AnimatedStat({
  label,
  value,
  format,
  icon,
  color,
  description,
}: {
  label: string
  value: number
  format: (value: number) => string
  icon: React.ReactNode
  color: string
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
    <article
      className="card admin-dashboard-kpi"
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: 104,
        padding: '14px 16px 12px',
        gap: 6,
      }}
    >
      <div
        className="owner-kpi-heading"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <span
          style={{
            fontSize: 11.5,
            fontWeight: 500,
            color: 'var(--mute)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </span>
        <span
          className="owner-kpi-icon"
          style={{
            display: 'grid',
            width: 30,
            height: 30,
            flex: '0 0 30px',
            placeItems: 'center',
            borderRadius: 9,
            border: `1px solid color-mix(in srgb, ${color} 28%, transparent)`,
            background: `color-mix(in srgb, ${color} 14%, transparent)`,
            color: color,
          }}
        >
          {icon}
        </span>
      </div>
      <strong
        className="owner-kpi-value"
        style={{
          color: 'var(--ink)',
          fontSize: 'clamp(18px, 1.55vw, 22px)',
          fontWeight: 700,
          letterSpacing: '-0.035em',
          fontVariantNumeric: 'tabular-nums',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          lineHeight: 1.2,
        }}
      >
        {format(displayValue)}
      </strong>
      <div
        className="owner-kpi-footer"
        style={{
          display: 'flex',
          alignItems: 'center',
          marginTop: 'auto',
          fontSize: 10.5,
          color: 'var(--mute)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        <span>{description}</span>
      </div>
    </article>
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
  non_cash: { label: 'Non-Tunai', bg: 'var(--accs)', color: 'var(--acc)' },
  qris: { label: 'Non-Tunai', bg: 'var(--accs)', color: 'var(--acc)' },
  transfer: { label: 'Non-Tunai', bg: 'var(--accs)', color: 'var(--acc)' },
  credit: { label: 'Kasbon', bg: 'var(--warns)', color: 'var(--warn)' }
}

interface Props {
  dailySales: DailySale[]
  lowStockProducts: LowStockProduct[]
  lowStockMaterials?: LowStockRawMaterial[]
  recentSales: RecentSale[]
  voidedSales?: VoidedSale[]
  todaySummary: DailySale | null
  totalProducts: number | null
}

export default function AdminDashboardClient({
  dailySales,
  lowStockProducts,
  lowStockMaterials = [],
  recentSales,
  voidedSales = [],
  todaySummary,
  totalProducts
}: Props) {
  const daily = dailySales
  const lowStock = lowStockProducts
  const rawMatLow = lowStockMaterials
  const sales = recentSales
  const voidList = voidedSales
  const prefersReducedMotion = usePrefersReducedMotion()

  const activeToday = todaySummary
  const revenue = activeToday ? Number(activeToday.total_revenue) : 0
  const transactionCount = activeToday ? Number(activeToday.transaction_count) : 0
  const averageBasket = revenue > 0 && transactionCount > 0
    ? Math.round(revenue / transactionCount)
    : 0

  return (
    <div className="admin-dashboard role-dashboard-enter">
      <PageHeader
        title="Dashboard Penjualan & Inventaris"
        subtitle="Ringkasan performa operasional toko hari ini, monitoring transaksi kasir, dan kesiapan persediaan stok"
      />

      {/* KPI Cards - 4 kotak kecil berjajar */}
      <div className="owner-dashboard-kpis kpi-grid" style={{ marginBottom: 20 }}>
        <AnimatedStat
          label="Penghasilan Hari Ini"
          value={revenue}
          format={formatRp}
          icon={<DollarSign size={16} />}
          color="#10b981"
          description={`${transactionCount} transaksi berhasil`}
        />
        <AnimatedStat
          label="Total Transaksi"
          value={transactionCount}
          format={(value) => value.toLocaleString('id-ID')}
          icon={<ShoppingCart size={16} />}
          color="#3478f6"
          description="Selesai hari ini"
        />
        <AnimatedStat
          label="Total Produk Aktif"
          value={totalProducts || 0}
          format={(value) => value.toLocaleString('id-ID')}
          icon={<Package size={16} />}
          color="#f59e0b"
          description={`${lowStock.length} produk stok menipis`}
        />
        <AnimatedStat
          label="Rata-rata Keranjang Belanja"
          value={averageBasket}
          format={formatRp}
          icon={<TrendingUp size={16} />}
          color="#8b5cf6"
          description="Per transaksi hari ini"
        />
      </div>

      {/* 2-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20 }}>
        {/* Left: Chart & Recent Sales */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Revenue chart */}
          <div className="admin-dashboard-enter" style={{ animationDelay: '75ms' }}>
            <SectionCard title="Tren Penjualan 7 Hari Terakhir">
              {daily.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--mute)', fontSize: 13 }}>
                  Belum ada data penjualan tercatat dalam 7 hari terakhir
                </div>
              ) : (
                <div style={{ height: 260, width: '100%', marginTop: 8 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={daily} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                      <XAxis
                        dataKey="sale_date"
                        stroke="var(--mute)"
                        fontSize={11.5}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v: string) => {
                          const d = new Date(v)
                          return d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' })
                        }}
                      />
                      <Tooltip
                        contentStyle={{
                          background: 'var(--panel)',
                          border: '1px solid var(--line)',
                          borderRadius: 12,
                          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                          fontSize: 12,
                          color: 'var(--ink)'
                        }}
                        formatter={(val: any) => [formatRp(Number(val)), 'Omzet']}
                        labelFormatter={(lbl: any) => new Date(lbl).toLocaleDateString('id-ID', { dateStyle: 'full' })}
                      />
                      <Bar
                        dataKey="total_revenue"
                        fill="var(--acc)"
                        radius={[6, 6, 0, 0]}
                        isAnimationActive={!prefersReducedMotion}
                        animationDuration={600}
                        animationEasing="ease-out"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </SectionCard>
          </div>

          {/* Recent sales */}
          <div className="admin-dashboard-enter" style={{ animationDelay: '150ms' }}>
            <SectionCard
              title="Transaksi Penjualan Terkini"
              action={
                <Link href="/admin/transaksi" className="btn btn-secondary btn-sm">
                  Lihat Semua <ArrowRight size={12} />
                </Link>
              }
            >
              {sales.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--mute)', fontSize: 13 }}>
                  Belum ada transaksi penjualan yang tercatat hari ini
                </div>
              ) : (
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>No. Invoice</th>
                        <th>Waktu</th>
                        <th>Metode</th>
                        <th>Total</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sales.map((s, index) => {
                        const pm = payMethodLabel[s.payment_method] || { label: s.payment_method, bg: 'var(--bg)', color: 'var(--ink)' }
                        return (
                          <tr
                            key={s.id}
                            className="admin-dashboard-row"
                            style={{ ['--row-delay' as string]: `${index * 45}ms` }}
                          >
                            <td style={{ fontWeight: 600, fontSize: 12.5, fontFamily: 'monospace' }}>
                              {s.invoice_number}
                            </td>
                            <td style={{ fontSize: 12, color: 'var(--mute)' }}>
                              {new Date(s.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td>
                              <span style={{
                                padding: '2px 8px',
                                borderRadius: 6,
                                fontSize: 11,
                                fontWeight: 600,
                                background: pm.bg,
                                color: pm.color
                              }}>
                                {pm.label}
                              </span>
                            </td>
                            <td style={{ fontWeight: 700, fontSize: 13 }}>
                              {formatRp(s.final_amount)}
                            </td>
                            <td>
                              <StatusTag status={s.status === 'completed' ? 'ok' : 'void'} label={s.status === 'completed' ? 'Selesai' : 'Void'} />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          </div>
        </div>

        {/* Right: Low Stock, Raw Materials & Quick Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Peringatan Restock Bahan Baku (Resep / BOM) */}
          <div className="admin-dashboard-enter" style={{ animationDelay: '200ms' }}>
            <SectionCard
              title={`Peringatan Restock Bahan Baku ${rawMatLow.length > 0 ? `(${rawMatLow.length})` : ''}`}
              action={
                <Link href="/admin/bahan-baku" className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Boxes size={13} /> Kelola Bahan <ArrowRight size={12} />
                </Link>
              }
            >
              {rawMatLow.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--ok)', fontSize: 13, fontWeight: 500 }}>
                  ✅ Seluruh stok bahan baku dalam batas aman
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {rawMatLow.map((mat) => {
                    const isOut = mat.stock <= 0
                    const pct = mat.min_stock > 0 ? Math.round((mat.stock / mat.min_stock) * 100) : 0

                    return (
                      <div
                        key={mat.id}
                        style={{
                          padding: '12px 14px',
                          background: 'var(--bg)',
                          border: `1px solid ${isOut ? 'var(--bad)' : 'var(--warn)'}`,
                          borderRadius: 12
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--ink)' }}>
                              {mat.name}
                            </div>
                            <div style={{ fontSize: 11, color: isOut ? 'var(--bad)' : 'var(--warn)', fontWeight: 600, marginTop: 2 }}>
                              {isOut ? '⚠️ Stok Habis! Segera restock' : '⚠️ Stok Menipis di bawah batas minimum'}
                            </div>
                          </div>
                          <Link
                            href="/admin/bahan-baku"
                            className="btn btn-sm"
                            style={{
                              background: isOut ? 'var(--bad)' : 'var(--warn)',
                              color: '#fff',
                              fontSize: 11,
                              fontWeight: 700,
                              padding: '4px 8px'
                            }}
                          >
                            Restock
                          </Link>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ flex: 1, height: 5, background: 'var(--line)', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{
                              height: '100%',
                              width: `${Math.min(pct, 100)}%`,
                              background: isOut ? 'var(--bad)' : 'var(--warn)',
                              borderRadius: 4
                            }} />
                          </div>
                          <span style={{ fontSize: 11.5, fontWeight: 700, color: isOut ? 'var(--bad)' : 'var(--ink)', whiteSpace: 'nowrap' }}>
                            {mat.stock} / {mat.min_stock} {mat.unit}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </SectionCard>
          </div>

          {/* Low stock products */}
          <div className="admin-dashboard-enter" style={{ animationDelay: '225ms' }}>
            <SectionCard
              title={`Peringatan Stok Produk Menipis ${lowStock.length > 0 ? `(${lowStock.length})` : ''}`}
              action={
                <Link href="/admin/stok" className="btn btn-secondary btn-sm">
                  Kelola Stok <ArrowRight size={12} />
                </Link>
              }
            >
              {lowStock.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--ok)', fontSize: 13, fontWeight: 500 }}>
                  ✅ Seluruh stok produk siap jual dalam batas aman
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
                  { label: 'Bahan Baku & Resep', href: '/admin/bahan-baku', icon: <Boxes size={18} />, color: '#2563eb', bg: 'rgba(37, 99, 235, 0.1)' },
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
