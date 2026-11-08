'use client'

import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  CalendarDays,
  CreditCard,
  DollarSign,
  FileText,
  Hand,
  Package,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import Link from 'next/link'
import { useId } from 'react'
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import OwnerBarChart from '@/components/owner/OwnerBarChart'
import OwnerTrendChart from '@/components/owner/OwnerTrendChart'
import { SectionCard, StatusTag } from '@/components/ui/Cards'
import type { Database, Json } from '@/lib/supabase/types'
import OwnerReportExport from '@/components/owner/OwnerReportExport'
import type { OwnerReport } from '@/lib/owner-report-export'

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
  businessName?: string
  generatedBy?: string
}

const CATEGORIES_PALETTE = ['#2864ea', '#8b5cf6', '#20d9f5', '#fbbf24', '#34d399', '#fb7185']

const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

function formatRp(value: number | null | undefined) {
  return value === null || value === undefined ? 'Belum tersedia' : currencyFormatter.format(value)
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

function CategoryDonut({ categories }: { categories: CategorySale[] }) {
  const chartData = categories
    .map(category => ({ ...category, value: Math.max(0, category.revenue) }))
    .filter(category => category.value > 0)

  return (
    <div role="img" aria-label="Distribusi omzet berdasarkan kategori penjualan" style={{ width: '100%', height: 150, minWidth: 0 }}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={150}>
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            innerRadius="58%"
            outerRadius="82%"
            paddingAngle={2}
            stroke="var(--panel)"
            strokeWidth={2}
            isAnimationActive={false}
          >
            {chartData.map((category, index) => (
              <Cell key={category.id} fill={CATEGORIES_PALETTE[index % CATEGORIES_PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: 'var(--panel)',
              border: '1px solid var(--line)',
              borderRadius: 10,
              color: 'var(--ink)',
              fontSize: 12,
            }}
            formatter={value => [formatRp(Number(value)), 'Omzet']}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
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

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const gradientId = `owner-sparkline-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  if (values.length < 2 || values.every((value) => value === 0)) return null

  return (
    <div className="owner-kpi-sparkline" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={29}>
        <AreaChart data={values.map(value => ({ value }))} margin={{ top: 3, right: 2, bottom: 0, left: 2 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.2} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
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
  businessName,
  generatedBy,
}: Props) {
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
  const reportPeriod = monthlySummary.length
    ? `${new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' })
      .format(new Date(`${monthlySummary[0].month}-01T12:00:00+07:00`))} – ${new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' })
      .format(new Date(`${monthlySummary[monthlySummary.length - 1].month}-01T12:00:00+07:00`))}`
    : 'Tidak ada data'
  const report: OwnerReport = {
    title: 'Ringkasan Performa Bisnis',
    period: reportPeriod,
    fileName: `Laporan_Dashboard_${monthlySummary[0]?.month ?? 'tanpa_data'}_${monthlySummary[monthlySummary.length - 1]?.month ?? ''}`,
    businessName,
    generatedBy,
    summary: [
      { label: 'Total omzet', value: monthlySummary.reduce((sum, month) => sum + month.gross_revenue, 0), format: 'currency' },
      { label: 'Total HPP', value: monthlySummary.reduce((sum, month) => sum + month.cogs, 0), format: 'currency' },
      { label: 'Laba kotor', value: monthlySummary.reduce((sum, month) => sum + month.gross_profit, 0), format: 'currency' },
      { label: 'Jumlah periode', value: monthlySummary.length, format: 'number' },
    ],
    columns: [
      { key: 'period', header: 'Periode' },
      { key: 'revenue', header: 'Omzet (Rp)', format: 'currency' },
      { key: 'cogs', header: 'HPP (Rp)', format: 'currency' },
      { key: 'profit', header: 'Laba Kotor (Rp)', format: 'currency' },
    ],
    rows: monthlySummary.map((month) => ({
      period: month.month,
      revenue: month.gross_revenue,
      cogs: month.cogs,
      profit: month.gross_profit,
    })),
    chart: {
      title: 'Tren Omzet dan Laba Kotor',
      categories: monthlySummary.map((month) => formatMonth(month.month)),
      series: [
        { name: 'Omzet', values: monthlySummary.map((month) => month.gross_revenue), color: '#2864ea' },
        { name: 'Laba kotor', values: monthlySummary.map((month) => month.gross_profit), color: '#22b8a7' },
      ],
    },
  }

  return (
    <div className="owner-dashboard role-dashboard-enter">
      <header className="owner-dashboard-header">
        <div>
          <div className="dashboard-eyebrow"><Activity size={13} /> RINGKASAN BISNIS</div>
          <h1>Selamat datang kembali <span style={{ display: 'inline-flex', verticalAlign: 'middle', marginLeft: 4 }} aria-hidden="true"><Hand size={22} /></span></h1>
          <p>Berikut ringkasan performa bisnis Anda.</p>
        </div>
        <div className="owner-dashboard-actions">
          <span className="dashboard-period"><CalendarDays size={14} /> {monthLabel}</span>
          <OwnerReportExport
            report={report}
            disabled={monthlySummary.length === 0}
            label="Ekspor"
            className="btn btn-primary"
          />
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
                <OwnerTrendChart
                  data={dailyChartData.map(day => ({
                    label: day.name,
                    values: { revenue: day.revenue, transactions: day.transactions },
                  }))}
                  series={[
                    {
                      key: 'revenue',
                      label: 'Omzet',
                      color: '#20d9f5',
                      formatValue: value => formatRp(value),
                    },
                    {
                      key: 'transactions',
                      label: 'Transaksi',
                      color: '#a78bfa',
                      axis: 'secondary',
                      formatValue: value => `${Math.round(value)} transaksi`,
                      formatAxisValue: value => `${Math.round(value)}`,
                    },
                  ]}
                  ariaLabel="Grafik tren omzet dan jumlah transaksi tujuh hari terakhir"
                  height={250}
                  axisFormatter={formatCompact}
                />
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
                    <CategoryDonut categories={categorySales} />
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
              <OwnerBarChart
                data={monthlyChartData.map(month => ({
                  label: month.name,
                  values: { revenue: month.revenue, profit: month.profit },
                }))}
                series={[
                  {
                    key: 'revenue',
                    label: 'Omzet',
                    color: '#20d9f5',
                    formatValue: value => formatRp(value),
                  },
                  {
                    key: 'profit',
                    label: 'Laba kotor',
                    color: '#22d3a6',
                    formatValue: value => formatRp(value),
                  },
                ]}
                ariaLabel="Grafik ringkasan omzet dan laba kotor bulanan"
                height={230}
                axisFormatter={formatCompact}
              />
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
                  <span><strong>Hutang operasional & usaha</strong><small>{formatRp(totalPendingReceivables)} belum dibayar</small></span>
                  <ArrowUpRight size={15} />
                </Link>
              )}
              {lowStockCount === 0 && totalPendingReceivables === 0 && (
                <p className="owner-dashboard-clear">Tidak ada peringatan stok atau hutang usaha saat ini.</p>
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
