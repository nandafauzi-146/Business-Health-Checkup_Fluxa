'use client'

import { useState } from 'react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts'
import { TrendingUp, TrendingDown, DollarSign, Wallet, ArrowUpRight, ArrowDownLeft, Calendar } from 'lucide-react'
import { PageHeader } from '@/components/layout/Topbar'
import { KpiCard, SectionCard, FormatRupiah } from '@/components/ui/Cards'

interface CashflowEntry {
  date: string
  cash_in: number
  cash_out: number
  net: number
}

interface CashflowProps {
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

export default function CashflowClient({
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 20 }}>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: 'var(--oks)', color: 'var(--ok)' }}>
            <ArrowDownLeft size={20} />
          </div>
          <div className="kpi-label">Total Kas Masuk</div>
          <div className="kpi-value" style={{ color: 'var(--ok)' }}>
            <FormatRupiah amount={totalIn} />
          </div>
          <div className="kpi-sub">Dari transaksi POS & pelunasan kasbon</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: 'var(--bads)', color: 'var(--bad)' }}>
            <ArrowUpRight size={20} />
          </div>
          <div className="kpi-label">Total Kas Keluar</div>
          <div className="kpi-value" style={{ color: 'var(--bad)' }}>
            <FormatRupiah amount={totalOut} />
          </div>
          <div className="kpi-sub">Biaya operasional, sewa, gaji & belanja</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: netCashflow >= 0 ? 'var(--oks)' : 'var(--bads)', color: netCashflow >= 0 ? 'var(--ok)' : 'var(--bad)' }}>
            <Wallet size={20} />
          </div>
          <div className="kpi-label">Net Cash Flow (Surplus/Defisit)</div>
          <div className="kpi-value" style={{ color: netCashflow >= 0 ? 'var(--ok)' : 'var(--bad)' }}>
            <FormatRupiah amount={netCashflow} />
          </div>
          <div className="kpi-sub">{netCashflow >= 0 ? 'Arus kas surplus & likuid' : 'Arus kas mengalami defisit'}</div>
        </div>
      </div>

      {/* Grafik Arus Kas Masuk vs Keluar */}
      <div style={{ marginBottom: 20 }}>
        <SectionCard title="Tren Arus Kas Harian (Kas Masuk vs Kas Keluar)">
          <div style={{ height: 320, width: '100%', marginTop: 12 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ECEEF4" vertical={false} />
                <XAxis dataKey="date" stroke="#7B8194" fontSize={12} tickLine={false} />
                <YAxis
                  stroke="#7B8194"
                  fontSize={12}
                  tickLine={false}
                  tickFormatter={val => `Rp ${(val / 1000).toLocaleString('id-ID')}k`}
                />
                <Tooltip
                  formatter={(val: any) => [`Rp ${Number(val).toLocaleString('id-ID')}`, '']}
                  contentStyle={{ background: '#fff', borderRadius: 8, border: '1px solid #ECEEF4', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                />
                <Legend />
                <Bar dataKey="cash_in" name="Kas Masuk" fill="#1F9D63" radius={[4, 4, 0, 0]} />
                <Bar dataKey="cash_out" name="Kas Keluar" fill="#E5484D" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      {/* Rincian Riwayat Mutasi Kas */}
      <SectionCard title="Aktivitas Kas Terbaru">
        <div className="table-container">
          <table className="data-table">
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
