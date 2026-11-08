'use client'

import { Wallet, ArrowUpRight, ArrowDownLeft } from 'lucide-react'
import { PageHeader } from '@/components/layout/Topbar'
import { SectionCard, FormatRupiah } from '@/components/ui/Cards'
import OwnerTrendChart from '@/components/owner/OwnerTrendChart'

interface CashflowEntry {
  date: string
  cash_in: number
  cash_out: number
  net: number
}

export interface CashflowProps {
  periodLabel: string
  totalIn: number
  totalOut: number
  netCashflow: number
  chartData: CashflowEntry[]
  recentActivities: {
    id: string
    date: string
    type: 'in' | 'out'
    title: string
    amount: number
    method: string
  }[]
}

function formatCompactRupiah(amount: number) {
  if (amount >= 1_000_000) return `Rp ${(amount / 1_000_000).toFixed(1)} jt`
  if (amount >= 1_000) return `Rp ${Math.round(amount / 1_000)} rb`
  return `Rp ${Math.round(amount).toLocaleString('id-ID')}`
}

function formatChartDate(date: string) {
  const [, month, day] = date.split('-')
  return `${day}/${month}`
}

export default function CashflowClient({
  periodLabel,
  totalIn,
  totalOut,
  netCashflow,
  chartData,
  recentActivities
}: CashflowProps) {
  return (
    <div>
      <PageHeader
        title="Analisis Cashflow (Arus Kas)"
        subtitle="Monitoring arus kas riil masuk dan keluar untuk menjaga likuiditas operasional bisnis"
      />

      {/* KPI Cards */}
      <div className="responsive-kpi">
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: 'var(--oks)', color: 'var(--ok)' }}>
            <ArrowDownLeft size={20} />
          </div>
          <div className="kpi-label">Total Kas Masuk · {periodLabel}</div>
          <div className="kpi-value" style={{ color: 'var(--ok)' }}>
            <FormatRupiah amount={totalIn} />
          </div>
          <div className="kpi-sub">Dari transaksi penjualan POS langsung</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: 'var(--bads)', color: 'var(--bad)' }}>
            <ArrowUpRight size={20} />
          </div>
          <div className="kpi-label">Total Kas Keluar · {periodLabel}</div>
          <div className="kpi-value" style={{ color: 'var(--bad)' }}>
            <FormatRupiah amount={totalOut} />
          </div>
          <div className="kpi-sub">Biaya operasional, sewa, gaji & belanja</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: netCashflow >= 0 ? 'var(--oks)' : 'var(--bads)', color: netCashflow >= 0 ? 'var(--ok)' : 'var(--bad)' }}>
            <Wallet size={20} />
          </div>
          <div className="kpi-label">Net Cash Flow · {periodLabel}</div>
          <div className="kpi-value" style={{ color: netCashflow >= 0 ? 'var(--ok)' : 'var(--bad)' }}>
            <FormatRupiah amount={netCashflow} />
          </div>
          <div className="kpi-sub">{netCashflow >= 0 ? 'Arus kas surplus & likuid' : 'Arus kas mengalami defisit'}</div>
        </div>
      </div>

      {/* Grafik Arus Kas Masuk vs Keluar */}
      <div style={{ marginBottom: 20 }}>
        <SectionCard
          title="Tren Arus Kas Harian (Kas Masuk vs Kas Keluar)"
          action={<span style={{ fontSize: 11, color: 'var(--mute)' }}>{periodLabel}</span>}
        >
          {chartData.length === 0 ? (
            <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mute)', fontSize: 13 }}>
              Belum ada data arus kas untuk ditampilkan.
            </div>
          ) : (
            <OwnerTrendChart
              data={chartData.map(entry => ({
                label: formatChartDate(entry.date),
                values: { cashIn: entry.cash_in, cashOut: entry.cash_out },
              }))}
              series={[
                {
                  key: 'cashIn',
                  label: 'Kas Masuk',
                  color: 'var(--ok)',
                  formatValue: value => formatCompactRupiah(value),
                },
                {
                  key: 'cashOut',
                  label: 'Kas Keluar',
                  color: 'var(--bad)',
                  formatValue: value => formatCompactRupiah(value),
                },
              ]}
              ariaLabel="Grafik tren kas masuk dan kas keluar harian"
              height={280}
              axisFormatter={formatCompactRupiah}
            />
          )}
        </SectionCard>
      </div>

      {/* Rincian Riwayat Mutasi Kas */}
      <SectionCard title="Aktivitas Kas Terbaru">
        <div className="table-container">
          <table className="data-table" style={{ minWidth: 540 }}>
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Aliran</th>
                <th>Keterangan</th>
                <th>Metode</th>
                <th style={{ textAlign: 'right' }}>Nominal</th>
              </tr>
            </thead>
            <tbody>
              {recentActivities.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '32px 0', color: 'var(--mute)' }}>
                    Belum ada aktivitas kas tercatat
                  </td>
                </tr>
              ) : (
                recentActivities.map(act => (
                  <tr key={act.id}>
                    <td style={{ fontSize: 12, color: 'var(--mute)' }}>
                      {new Date(act.date).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6,
                        fontSize: 11, fontWeight: 700,
                        background: act.type === 'in' ? 'var(--oks)' : 'var(--bads)',
                        color: act.type === 'in' ? 'var(--ok)' : 'var(--bad)'
                      }}>
                        {act.type === 'in' ? <ArrowDownLeft size={12} /> : <ArrowUpRight size={12} />}
                        {act.type === 'in' ? 'Masuk' : 'Keluar'}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{act.title}</td>
                    <td style={{ textTransform: 'uppercase', fontSize: 12 }}>{act.method}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 14, color: act.type === 'in' ? 'var(--ok)' : 'var(--bad)' }}>
                      {act.type === 'in' ? '+' : '-'}<FormatRupiah amount={act.amount} />
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
