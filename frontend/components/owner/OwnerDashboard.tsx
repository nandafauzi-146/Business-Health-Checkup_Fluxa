'use client'

import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  CalendarDays,
  CreditCard,
  DollarSign,
  Download,
  FileText,
  Package,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { SectionCard, StatusTag } from '@/components/ui/Cards'
import type { Database, Json } from '@/lib/supabase/types'

type MonthlySummary = Database['public']['Views']['v_monthly_revenue_cogs']['Row']
type DailySale = Database['public']['Views']['v_daily_sales_summary']['Row']
type Checkup = Pick<
  Database['public']['Tables']['checkups']['Row'],
  'overall_score' | 'health_status' | 'metrics' | 'ai_recommendations' | 'period_start' | 'period_end' | 'created_at'
>
type HealthDimension = {
  dimension: string
  score: number
  status: 'sehat' | 'waspada' | 'kritis'
}
type BestSellingProduct = {
  id: string
  name: string
  quantity: number
  revenue: number
}
type CategorySale = {
  id: string
  name: string
  revenue: number
}
type RecentSale = {
  id: string
  invoice_number: string
  final_amount: number
  created_at: string
}

interface Props {
  currentMonth: MonthlySummary | null
  prevMonth: MonthlySummary | null
  monthlySummary: MonthlySummary[]
  dailySales: DailySale[]
  latestCheckup: Checkup | null
  lowStockCount: number
  totalPendingReceivables: number
  bestSellingProducts: BestSellingProduct[]
  categorySales: CategorySale[]
  recentSales: RecentSale[]
}

const CATEGORIES_PALETTE = ['#4f83ff', '#8b5cf6', '#20d9f5', '#fbbf24', '#34d399', '#fb7185']

const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

function formatRp(value: number | null | undefined) {
  return value === null || value === undefined ? '—' : currencyFormatter.format(value)
}

function formatCompact(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} jt`
  if (value >= 1_000) return `${Math.round(value / 1_000)} rb`
  return String(value)
}

function formatMonth(value: string) {
  return new Intl.DateTimeFormat('id-ID', {
    month: 'short',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(`${value}-01T12:00:00+07:00`))
}

function formatDay(value: string) {
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'short',
    day: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(`${value}T12:00:00+07:00`))
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(value))
}

function getHealthDimensions(metrics: Json | null): HealthDimension[] {
  if (!metrics || typeof metrics !== 'object' || Array.isArray(metrics)) return []

  const dimensions = metrics.dimension_scores
  if (!Array.isArray(dimensions)) return []

  return dimensions.flatMap((dimension): HealthDimension[] => {
    if (!dimension || typeof dimension !== 'object' || Array.isArray(dimension)) return []

    const name = dimension.dimension
    const score = dimension.score
    const status = dimension.status

    if (
      typeof name !== 'string'
      || typeof score !== 'number'
      || (status !== 'sehat' && status !== 'waspada' && status !== 'kritis')
    ) return []

    return [{ dimension: name, score, status }]
  })
}

function exportMonthlyReport(months: MonthlySummary[]) {
  const escapeCsv = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`
  const rows = [
    ['Periode', 'Omzet (Rp)', 'HPP (Rp)', 'Laba Kotor (Rp)'],
    ...months.map((month) => [month.month, month.gross_revenue, month.cogs, month.gross_profit]),
  ]
  const csv = `\uFEFF${rows.map((row) => row.map(escapeCsv).join(',')).join('\r\n')}`
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `fluxa-ringkasan-${new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' }).format(new Date())}.csv`
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
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

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2 || values.every((value) => value === 0)) return null

  const minimum = Math.min(...values)
  const range = Math.max(...values) - minimum || 1
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * 100
    const y = 30 - ((value - minimum) / range) * 24
    return `${x},${y}`
  })

  return (
    <svg className="owner-kpi-sparkline" viewBox="0 0 100 34" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={points.join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function DashboardKpi({
  label,
  value,
  detail,
  icon,
  color,
  values,
}: {
  label: string
  value: string
  detail: string
  icon: React.ReactNode
  color: string
  values: number[]
}) {
  return (
    <article className="card owner-dashboard-kpi">
      <div className="owner-kpi-heading">
        <span>{label}</span>
        <span className="owner-kpi-icon" style={{ '--kpi-color': color } as React.CSSProperties}>{icon}</span>
      </div>
      <strong className="owner-kpi-value">{value}</strong>
      <div className="owner-kpi-footer">
        <span style={{ color }}>{detail}</span>
        <Sparkline values={values} color={color} />
      </div>
    </article>
  )
}

export default function OwnerDashboardClient({
  currentMonth,
  prevMonth,
  monthlySummary,
  dailySales,
  latestCheckup,
  lowStockCount,
  totalPendingReceivables,
  bestSellingProducts,
  categorySales,
  recentSales,
}: Props) {
  const prefersReducedMotion = usePrefersReducedMotion()
  const overallScore = latestCheckup?.overall_score ?? null
  const healthDimensions = getHealthDimensions(latestCheckup?.metrics ?? null)
  const monthLabel = new Intl.DateTimeFormat('id-ID', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(new Date())
  const sevenDayRevenue = dailySales.reduce((total, sale) => total + sale.total_revenue, 0)
  const sevenDayTransactions = dailySales.reduce((total, sale) => total + sale.transaction_count, 0)
  const averageTransaction = sevenDayTransactions > 0 ? Math.round(sevenDayRevenue / sevenDayTransactions) : null
  const dailyChartData = dailySales.map((sale) => ({
    name: formatDay(sale.sale_date),
    revenue: sale.total_revenue,
    transactions: sale.transaction_count,
  }))
  const monthlyChartData = monthlySummary.map((month) => ({
    name: formatMonth(month.month),
    revenue: month.gross_revenue,
    profit: month.gross_profit,
  }))
  const revenueChange = currentMonth && prevMonth && prevMonth.gross_revenue > 0
    ? ((currentMonth.gross_revenue - prevMonth.gross_revenue) / prevMonth.gross_revenue) * 100
    : null
  const latestRecommendation = latestCheckup?.ai_recommendations?.trim()
  const healthStatus = latestCheckup?.health_status ?? null
  const healthColor = healthStatus === 'sehat'
    ? 'var(--ok)'
    : healthStatus === 'waspada'
      ? 'var(--warn)'
      : 'var(--bad)'
  const totalCategoryRevenue = categorySales.reduce((total, category) => total + category.revenue, 0)
  const maximumProductQuantity = Math.max(...bestSellingProducts.map((product) => product.quantity), 0)

  return (
    <div className="owner-dashboard role-dashboard-enter">
      <header className="owner-dashboard-header">
        <div>
          <div className="dashboard-eyebrow"><Activity size={13} /> RINGKASAN BISNIS</div>
          <h1>Selamat datang kembali 👋</h1>
          <p>Berikut ringkasan performa bisnis Anda.</p>
        </div>
        <div className="owner-dashboard-actions">
          <span className="dashboard-period"><CalendarDays size={14} /> {monthLabel}</span>
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => exportMonthlyReport(monthlySummary)}
            disabled={monthlySummary.length === 0}
          >
            <Download size={15} /> Ekspor
          </button>
        </div>
      </header>

      <div className="owner-dashboard-kpis">
        <DashboardKpi
          label="Omzet 7 Hari"
          value={formatRp(sevenDayRevenue)}
          detail={revenueChange === null ? 'Performa periode ini' : `${revenueChange >= 0 ? '+' : ''}${revenueChange.toFixed(1)}% vs bulan lalu`}
          icon={<DollarSign size={17} />}
          color="#20d9f5"
          values={dailySales.map((sale) => sale.total_revenue)}
        />
        <DashboardKpi
          label="Laba Kotor Bulan Ini"
          value={formatRp(currentMonth?.gross_profit)}
          detail={currentMonth && currentMonth.gross_revenue > 0
            ? `Margin ${((currentMonth.gross_profit / currentMonth.gross_revenue) * 100).toFixed(1)}%`
            : 'Menunggu transaksi'}
          icon={<TrendingUp size={17} />}
          color="#22d3a6"
          values={monthlySummary.map((month) => month.gross_profit)}
        />
        <DashboardKpi
          label="Jumlah Transaksi"
          value={sevenDayTransactions.toLocaleString('id-ID')}
          detail="7 hari terakhir"
          icon={<CreditCard size={17} />}
          color="#a78bfa"
          values={dailySales.map((sale) => sale.transaction_count)}
        />
        <DashboardKpi
          label="Rata-rata Keranjang"
          value={formatRp(averageTransaction)}
          detail={averageTransaction === null ? 'Belum ada transaksi' : 'Nilai rata-rata 7 hari'}
          icon={<Package size={17} />}
          color="#fbbf24"
          values={dailySales.map((sale) => sale.transaction_count > 0
            ? Math.round(sale.total_revenue / sale.transaction_count)
            : 0)}
        />
      </div>

      <div className="owner-dashboard-grid">
        <main className="owner-dashboard-main">
          <div className="owner-dashboard-feature-row">
            <SectionCard title="Tren Omzet & Transaksi">
              <p className="owner-panel-subtitle">Performa penjualan 7 hari terakhir</p>
              {dailyChartData.length > 0 ? (
                <>
                  <div className="owner-chart-legend">
                    <span><i className="owner-legend-revenue" /> Omzet</span>
                    <span><i className="owner-legend-transactions" /> Transaksi</span>
                  </div>
                  <ResponsiveContainer width="100%" height={240}>
                    <ComposedChart data={dailyChartData} margin={{ top: 12, right: 0, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 5" stroke="var(--line)" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--mute)' }} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="revenue" tick={{ fontSize: 9, fill: 'var(--mute)' }} axisLine={false} tickLine={false} tickFormatter={formatCompact} width={48} />
                      <YAxis yAxisId="transactions" orientation="right" allowDecimals={false} hide />
                      <Tooltip
                        formatter={(value, name) => [
                          name === 'revenue' ? formatRp(Number(value ?? 0)) : Number(value ?? 0).toLocaleString('id-ID'),
                          name === 'revenue' ? 'Omzet' : 'Transaksi',
                        ]}
                        contentStyle={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 12, fontSize: 11 }}
                      />
                      <Bar yAxisId="revenue" dataKey="revenue" name="Omzet" fill="var(--acc)" radius={[5, 5, 0, 0]} isAnimationActive={!prefersReducedMotion} animationDuration={650} />
                      <Line yAxisId="transactions" dataKey="transactions" name="Transaksi" type="monotone" stroke="#a78bfa" strokeWidth={2} dot={{ r: 3, fill: '#a78bfa', strokeWidth: 0 }} activeDot={{ r: 5 }} isAnimationActive={!prefersReducedMotion} animationDuration={750} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </>
              ) : (
                <div className="dashboard-empty-state">Belum ada transaksi pada 7 hari terakhir.</div>
              )}
            </SectionCard>

            <SectionCard title="Insight AI">
              <div className="owner-ai-insight">
                <span className="owner-ai-icon"><Sparkles size={19} /></span>
                <div>
                  <span className="owner-ai-badge">BUSINESS HEALTH</span>
                  <strong>{latestRecommendation ? 'Rekomendasi terakhir' : 'Insight belum tersedia'}</strong>
                  <p>{latestRecommendation || 'Jalankan diagnosis Business Health untuk mendapatkan rekomendasi berdasarkan data bisnis Anda.'}</p>
                  {latestCheckup && (
                    <small className="owner-ai-date">
                      Rapor {new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeZone: 'Asia/Jakarta' }).format(new Date(latestCheckup.created_at))}
                    </small>
                  )}
                  <Link href="/owner/rapor" className="btn btn-secondary btn-sm">
                    Lihat detail <ArrowUpRight size={13} />
                  </Link>
                </div>
              </div>
            </SectionCard>
          </div>

          <div className="owner-dashboard-data-row">
            <SectionCard
              title="Produk Terlaris"
              action={<span className="owner-panel-caption">7 hari terakhir</span>}
            >
              <p className="owner-panel-subtitle">Peringkat berdasarkan jumlah terjual</p>
              {bestSellingProducts.length > 0 ? (
                <div className="owner-best-sellers">
                  {bestSellingProducts.map((product, index) => (
                    <div className="owner-best-seller" key={product.id}>
                      <span className={`owner-product-rank${index === 0 ? ' is-first' : ''}`}>{index + 1}</span>
                      <div className="owner-product-mark"><Package size={15} /></div>
                      <div className="owner-product-info">
                        <strong>{product.name}</strong>
                        <small>{formatRp(product.revenue)}</small>
                      </div>
                      <div className="owner-product-bar-track">
                        <span style={{ width: `${(product.quantity / maximumProductQuantity) * 100}%` }} />
                      </div>
                      <span className="owner-product-percent">{product.quantity}x</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="dashboard-empty-state">Belum ada produk terjual pada 7 hari terakhir.</div>
              )}
            </SectionCard>

            <SectionCard
              title="Kategori Penjualan"
              action={<span className="owner-panel-caption">Berdasarkan omzet</span>}
            >
              <p className="owner-panel-subtitle">Distribusi penjualan per kategori</p>
              {totalCategoryRevenue > 0 ? (
                <div className="owner-category-chart">
                  <div className="owner-category-donut">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={categorySales} dataKey="revenue" nameKey="name" innerRadius="66%" outerRadius="92%" paddingAngle={3} stroke="none" isAnimationActive={!prefersReducedMotion} animationDuration={700}>
                          {categorySales.map((category, index) => (
                            <Cell key={category.id} fill={CATEGORIES_PALETTE[index % CATEGORIES_PALETTE.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value) => [formatRp(Number(value ?? 0)), 'Omzet']}
                          contentStyle={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 12, fontSize: 11 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="owner-category-total"><span>Total</span><strong>{formatRp(totalCategoryRevenue)}</strong></div>
                  </div>
                  <div className="owner-category-legend">
                    {categorySales.slice(0, 6).map((category, index) => (
                      <div key={category.id}>
                        <i style={{ background: CATEGORIES_PALETTE[index % CATEGORIES_PALETTE.length] }} />
                        <span>{category.name}</span>
                        <strong>{Math.round((category.revenue / totalCategoryRevenue) * 100)}%</strong>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="dashboard-empty-state">Belum ada data kategori penjualan pada 7 hari terakhir.</div>
              )}
            </SectionCard>
          </div>

          {monthlyChartData.length > 0 && (
            <SectionCard title="Ringkasan Keuangan Bulanan">
              <p className="owner-panel-subtitle">Perbandingan omzet dan laba kotor dari data transaksi</p>
              <ResponsiveContainer width="100%" height={188}>
                <BarChart data={monthlyChartData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }} barGap={6}>
                  <CartesianGrid strokeDasharray="3 5" stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--mute)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: 'var(--mute)' }} axisLine={false} tickLine={false} tickFormatter={formatCompact} width={48} />
                  <Tooltip
                    formatter={(value, name) => [formatRp(Number(value ?? 0)), name === 'revenue' ? 'Omzet' : 'Laba kotor']}
                    contentStyle={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 12, fontSize: 11 }}
                  />
                  <Bar dataKey="revenue" name="Omzet" fill="var(--acc)" radius={[5, 5, 0, 0]} isAnimationActive={!prefersReducedMotion} animationDuration={650} />
                  <Bar dataKey="profit" name="Laba kotor" fill="#22d3ee" radius={[5, 5, 0, 0]} isAnimationActive={!prefersReducedMotion} animationDuration={720} />
                </BarChart>
              </ResponsiveContainer>
            </SectionCard>
          )}
        </main>

        <aside className="owner-dashboard-rail">
          <SectionCard title="Kesehatan Bisnis">
            {overallScore === null || !latestCheckup ? (
              <div className="dashboard-empty-state">
                Belum ada hasil diagnosis tersimpan.
                <Link href="/owner/rapor">Buat rapor kesehatan bisnis</Link>
              </div>
            ) : (
              <div className="owner-health-summary">
                <div
                  className="owner-health-gauge"
                  style={{ background: `conic-gradient(${healthColor} 0% ${overallScore}%, var(--line) ${overallScore}% 100%)` }}
                  role="img"
                  aria-label={`Skor kesehatan bisnis ${overallScore} dari 100`}
                >
                  <div><strong>{overallScore}</strong><span>/100</span></div>
                </div>
                <StatusTag status={healthStatus ?? undefined} />
                <p>Rapor terakhir {new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeZone: 'Asia/Jakarta' }).format(new Date(latestCheckup.created_at))}</p>
                <Link href="/owner/rapor" className="btn btn-primary"><Sparkles size={14} /> Buka rapor lengkap</Link>
              </div>
            )}
            {healthDimensions.length > 0 && (
              <div className="owner-health-dimensions">
                {healthDimensions.map((dimension) => (
                  <div className="owner-health-dimension" key={dimension.dimension}>
                    <div className="owner-health-dimension-heading">
                      <span>{dimension.dimension}</span>
                      <strong>{dimension.score}<small>/100</small></strong>
                    </div>
                    <div
                      className="owner-health-track"
                      role="meter"
                      aria-label={`Skor ${dimension.dimension}`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={dimension.score}
                    >
                      <span className={`owner-health-fill is-${dimension.status}`} style={{ width: `${dimension.score}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Aktivitas Terbaru" action={<span className="owner-panel-caption">Transaksi selesai</span>}>
            {recentSales.length > 0 ? (
              <div className="owner-recent-activity">
                {recentSales.map((sale) => (
                  <div className="owner-recent-activity-item" key={sale.id}>
                    <span><CreditCard size={14} /></span>
                    <div><strong>Transaksi baru</strong><small>{sale.invoice_number} · {formatTime(sale.created_at)}</small></div>
                    <b>{formatRp(sale.final_amount)}</b>
                  </div>
                ))}
              </div>
            ) : (
              <div className="dashboard-empty-state">Belum ada transaksi terbaru.</div>
            )}
          </SectionCard>

          <SectionCard title="Perhatian Operasional">
            <div className="owner-dashboard-alerts">
              {lowStockCount > 0 && (
                <Link href="/owner/stok" className="owner-dashboard-alert is-warning">
                  <Package size={17} />
                  <span><strong>Stok menipis</strong><small>{lowStockCount} produk perlu diperiksa</small></span>
                  <ArrowUpRight size={15} />
                </Link>
              )}
              {totalPendingReceivables > 0 && (
                <Link href="/owner/hutang-piutang" className="owner-dashboard-alert is-danger">
                  <AlertCircle size={17} />
                  <span><strong>Piutang tertunda</strong><small>{formatRp(totalPendingReceivables)} belum lunas</small></span>
                  <ArrowUpRight size={15} />
                </Link>
              )}
              {lowStockCount === 0 && totalPendingReceivables === 0 && (
                <p className="owner-dashboard-clear">Tidak ada peringatan stok atau piutang saat ini.</p>
              )}
            </div>
          </SectionCard>

          <SectionCard title="Akses Cepat">
            <div className="owner-quick-actions">
              <Link href="/owner/stok"><Package size={16} /><span>Kelola stok</span><ArrowUpRight size={13} /></Link>
              <Link href="/owner/rapor"><Sparkles size={16} /><span>Analisis bisnis</span><ArrowUpRight size={13} /></Link>
              <Link href="/owner/cashflow"><TrendingUp size={16} /><span>Arus kas</span><ArrowUpRight size={13} /></Link>
              <Link href="/owner/laporan"><FileText size={16} /><span>Laporan</span><ArrowUpRight size={13} /></Link>
            </div>
          </SectionCard>
        </aside>
      </div>
    </div>
  )
}
