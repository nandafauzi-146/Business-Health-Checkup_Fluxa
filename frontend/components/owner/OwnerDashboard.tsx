'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import { TrendingUp, DollarSign, ShoppingCart, AlertCircle, Package, CreditCard, Sparkles } from 'lucide-react'
import { KpiCard, SectionCard, StatusTag } from '@/components/ui/Cards'
import Link from 'next/link'

function formatRp(n: number) {
  return 'Rp' + new Intl.NumberFormat('id-ID').format(n)
}
function formatK(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'Jt'
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'Rb'
  return String(n)
}

interface Props {
  currentMonth: any
  prevMonth: any
  monthlySummary: any[]
  dailySales: any[]
  latestCheckup: any
  lowStockCount: number
  totalPendingReceivables: number
}

const DEMO_MONTHLY = [
  { month: '2026-05', gross_revenue: 42000000, cogs: 28000000, gross_profit: 14000000 },
  { month: '2026-06', gross_revenue: 48000000, cogs: 30000000, gross_profit: 18000000 },
  { month: '2026-07', gross_revenue: 38000000, cogs: 24000000, gross_profit: 14000000 },
  { month: '2026-08', gross_revenue: 52000000, cogs: 32000000, gross_profit: 20000000 },
  { month: '2026-09', gross_revenue: 61000000, cogs: 38000000, gross_profit: 23000000 },
  { month: '2026-10', gross_revenue: 55000000, cogs: 34000000, gross_profit: 21000000 },
]

const DEMO_DAILY = [
  { sale_date: '01', total_revenue: 1800000 },
  { sale_date: '02', total_revenue: 2200000 },
  { sale_date: '03', total_revenue: 1500000 },
  { sale_date: '04', total_revenue: 3100000 },
  { sale_date: '05', total_revenue: 2800000 },
  { sale_date: '06', total_revenue: 4200000 },
  { sale_date: '07', total_revenue: 3700000 },
]

const HEALTH_SCORES = [
  { dimension: 'Profitabilitas', score: 72, status: 'sehat' },
  { dimension: 'Cash Flow', score: 58, status: 'waspada' },
  { dimension: 'Efisiensi Biaya', score: 45, status: 'waspada' },
  { dimension: 'Utang', score: 81, status: 'sehat' },
  { dimension: 'Pertumbuhan', score: 65, status: 'waspada' },
  { dimension: 'Perputaran Stok', score: 38, status: 'kritis' },
]

function ScoreCircle({ score, status }: { score: number, status: string }) {
  const color = status === 'sehat' ? 'var(--ok)' : status === 'waspada' ? 'var(--warn)' : 'var(--bad)'
  const bg = status === 'sehat' ? 'var(--oks)' : status === 'waspada' ? 'var(--warns)' : 'var(--bads)'
  return (
    <div style={{
      width: 50, height: 50, borderRadius: '50%',
      background: bg, color, fontWeight: 700, fontSize: 16,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
    }}>{score}</div>
  )
}

export default function OwnerDashboardClient({
  currentMonth, prevMonth, monthlySummary, dailySales,
  latestCheckup, lowStockCount, totalPendingReceivables
}: Props) {

  const monthly = monthlySummary.length > 0 ? monthlySummary : DEMO_MONTHLY
  const daily = dailySales.length > 0 ? dailySales : DEMO_DAILY

  const cur = currentMonth || DEMO_MONTHLY[DEMO_MONTHLY.length - 1]
  const prev = prevMonth || DEMO_MONTHLY[DEMO_MONTHLY.length - 2]

  const revenueChange = prev?.gross_revenue ? ((cur.gross_revenue - prev.gross_revenue) / prev.gross_revenue) * 100 : 0
  const profitChange = prev?.gross_profit ? ((cur.gross_profit - prev.gross_profit) / prev.gross_profit) * 100 : 0

  const overallScore = latestCheckup?.overall_score || 62

  const monthlyChartData = monthly.map((m: any) => ({
    name: m.month?.slice(5) || m.sale_date,
    Omzet: m.gross_revenue,
    'HPP': m.cogs,
    'Laba Kotor': m.gross_profit,
  }))

  const dailyMax = Math.max(...daily.map((d: any) => d.total_revenue || 0))

  return (
    <div>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>Dashboard Owner</h1>
          <p style={{ color: 'var(--mute)', fontSize: 13, marginTop: 2 }}>
            Ringkasan kinerja bisnis Anda
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '6px 12px', fontSize: 13, color: 'var(--mute)' }}>
            Okt 2026
          </div>
          <button className="btn btn-primary" style={{ gap: 5 }}>
            <TrendingUp size={14} /> Ekspor
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div className="kpi-grid">
        <KpiCard
          label="Omzet Bulan Ini"
          value={formatRp(cur.gross_revenue || 55000000)}
          icon={<DollarSign size={15} />}
          change={revenueChange}
          changeLabel={`vs ${prev?.month || 'bulan lalu'}`}
        />
        <KpiCard
          label="Laba Kotor"
          value={formatRp(cur.gross_profit || 21000000)}
          icon={<TrendingUp size={15} />}
          change={profitChange}
          changeLabel={`Margin ${cur.gross_revenue ? ((cur.gross_profit / cur.gross_revenue) * 100).toFixed(1) : '38.2'}%`}
        />
        <KpiCard
          label="Skor Kesehatan"
          value={`${overallScore}/100`}
          icon={<Sparkles size={15} />}
          change={undefined}
          changeLabel={overallScore >= 70 ? 'Bisnis Sehat' : overallScore >= 40 ? 'Perlu Perhatian' : 'Status Kritis'}
        />
        <KpiCard
          label="Piutang Belum Lunas"
          value={formatRp(totalPendingReceivables || 4500000)}
          icon={<CreditCard size={15} />}
          change={undefined}
          changeLabel="Perlu ditagih"
        />
      </div>

      {/* Two columns */}
      <div className="two-col" style={{ gap: 16 }}>
        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Revenue bar chart */}
          <SectionCard
            title="Tren Omzet & Laba 6 Bulan"
            action={
              <div style={{ display: 'flex', gap: 14, fontSize: 11, color: 'var(--mute)', alignItems: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--acc)', display: 'inline-block' }} />
                  Omzet
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--ok)', display: 'inline-block' }} />
                  Laba Kotor
                </span>
              </div>
            }
          >
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthlyChartData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }} barGap={3}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--mute)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--mute)' }} axisLine={false} tickLine={false} tickFormatter={formatK} />
                <Tooltip formatter={(v: any) => formatRp(v)} contentStyle={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 10, fontSize: 12 }} />
                <Bar dataKey="Omzet" fill="var(--acc)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Laba Kotor" fill="var(--ok)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>

            {/* Segment row */}
            <div style={{ display: 'flex', gap: 12, marginTop: 14 }}>
              {[
                { label: 'Total Omzet', value: formatRp(cur.gross_revenue || 55000000), color: 'var(--acc)' },
                { label: 'HPP', value: formatRp(cur.cogs || 34000000), color: 'var(--seg-orange)' },
                { label: 'Laba Kotor', value: formatRp(cur.gross_profit || 21000000), color: 'var(--ok)' },
              ].map(seg => (
                <div key={seg.label} style={{ flex: 1, paddingTop: 10, borderTop: `3px solid ${seg.color}` }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>{seg.value}</div>
                  <div style={{ fontSize: 11, color: 'var(--mute)', marginTop: 2 }}>{seg.label}</div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Health Scores */}
          <SectionCard
            title="Skor Kesehatan Bisnis"
            action={
              <Link href="/owner/rapor" className="btn btn-secondary btn-sm">
                Lihat Rapor
              </Link>
            }
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {HEALTH_SCORES.map(hs => (
                <div key={hs.dimension} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px', background: 'var(--bg)', borderRadius: 10
                }}>
                  <ScoreCircle score={hs.score} status={hs.status} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{hs.dimension}</div>
                    <StatusTag status={hs.status} />
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Daily bar chart */}
          <SectionCard title="Penjualan 7 Hari Terakhir">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={daily} margin={{ top: 5, right: 0, left: 0, bottom: 5 }}>
                <XAxis dataKey="sale_date" tick={{ fontSize: 11, fill: 'var(--mute)' }} axisLine={false} tickLine={false}
                  tickFormatter={(v: any) => typeof v === 'string' ? v.slice(-2) : v} />
                <Tooltip formatter={(v: any) => formatRp(v)} contentStyle={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 10, fontSize: 12 }} />
                <Bar dataKey="total_revenue" radius={[8, 8, 0, 0]}
                  fill="var(--acc)"
                  label={{ position: 'top', formatter: (v: any) => v === dailyMax ? formatK(v) : '', fontSize: 10, fill: 'var(--acc)' }}
                />
              </BarChart>
            </ResponsiveContainer>
          </SectionCard>

          {/* Business Health Gauge */}
          <SectionCard title="Kesehatan Bisnis Keseluruhan">
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{
                width: 100, height: 100, borderRadius: '50%', margin: '0 auto 12px',
                background: `conic-gradient(var(--ok) 0% ${overallScore}%, var(--line) ${overallScore}% 100%)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{
                  width: 76, height: 76, borderRadius: '50%', background: 'var(--panel)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexDirection: 'column'
                }}>
                  <span style={{ fontSize: 24, fontWeight: 700, color: overallScore >= 70 ? 'var(--ok)' : overallScore >= 40 ? 'var(--warn)' : 'var(--bad)' }}>
                    {overallScore}
                  </span>
                  <span style={{ fontSize: 9, color: 'var(--mute)', fontWeight: 500 }}>/ 100</span>
                </div>
              </div>
              <StatusTag status={overallScore >= 70 ? 'sehat' : overallScore >= 40 ? 'waspada' : 'kritis'} />
              <p style={{ fontSize: 12, color: 'var(--mute)', marginTop: 8, lineHeight: 1.5 }}>
                {overallScore >= 70
                  ? 'Bisnis Anda dalam kondisi sehat. Pertahankan!'
                  : overallScore >= 40
                    ? 'Ada beberapa area yang perlu perhatian segera.'
                    : 'Kondisi kritis! Tindakan segera diperlukan.'
                }
              </p>
              <Link href="/owner/rapor" className="btn btn-primary" style={{ marginTop: 12, justifyContent: 'center', width: '100%', gap: 5 }}>
                <Sparkles size={13} /> Lihat Diagnosis Lengkap
              </Link>
            </div>
          </SectionCard>

          {/* Quick alerts */}
          <SectionCard title="Peringatan">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {lowStockCount > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--warns)', borderRadius: 10 }}>
                  <Package size={15} color="var(--warn)" />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--warn)' }}>Stok Menipis</div>
                    <div style={{ fontSize: 11, color: 'var(--warn)' }}>{lowStockCount} produk di bawah minimum</div>
                  </div>
                  <Link href="/owner/stok" className="btn btn-sm" style={{ background: 'var(--warn)', color: '#fff', borderRadius: 7 }}>
                    Cek
                  </Link>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bads)', borderRadius: 10 }}>
                <CreditCard size={15} color="var(--bad)" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--bad)' }}>Piutang Tertunda</div>
                  <div style={{ fontSize: 11, color: 'var(--bad)' }}>
                    {formatRp(totalPendingReceivables || 4500000)} belum ditagih
                  </div>
                </div>
                <Link href="/owner/hutang-piutang" className="btn btn-sm" style={{ background: 'var(--bad)', color: '#fff', borderRadius: 7 }}>
                  Cek
                </Link>
              </div>
            </div>
          </SectionCard>

          {/* AI Advisor card */}
          <div className="card" style={{ textAlign: 'center', padding: '20px 18px' }}>
            <div className="ai-orb" style={{ margin: '0 auto 12px' }}>
              <Sparkles size={28} color="#fff" />
            </div>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>Tanya AI Bisnis</div>
            <p style={{ fontSize: 12, color: 'var(--mute)', lineHeight: 1.6, marginBottom: 14 }}>
              &ldquo;Mengapa laba saya turun bulan ini? Apa yang harus dilakukan?&rdquo;
            </p>
            <Link href="/owner/rapor" className="btn btn-primary" style={{ justifyContent: 'center', gap: 5 }}>
              <Sparkles size={13} /> Mulai Diagnosis AI
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
