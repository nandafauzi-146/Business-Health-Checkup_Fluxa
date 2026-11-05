'use client'

import { useState } from 'react'
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts'
import { DollarSign, TrendingUp, TrendingDown, Percent, ArrowUpRight } from 'lucide-react'
import { PageHeader } from '@/components/layout/Topbar'
import { SectionCard, FormatRupiah } from '@/components/ui/Cards'
import OwnerReportExport from '@/components/owner/OwnerReportExport'
import type { OwnerReport } from '@/lib/owner-report-export'

interface MonthlyData {
  month: string
  total_orders: number
  gross_revenue: number
  cogs: number
  gross_profit: number
  expenses: number
  net_profit: number
  margin_gross: number
  margin_net: number
}

export default function FinancialReportClient({
  reports,
  businessName,
  generatedBy,
}: {
  reports: MonthlyData[]
  businessName?: string
  generatedBy?: string
}) {
  const [selectedMonth, setSelectedMonth] = useState<string>(reports[0]?.month || '')

  const currentData = reports.find(r => r.month === selectedMonth) || reports[0]
  const trendReports = reports.slice(0, 12).reverse()
  const selectedPeriod = currentData
    ? new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' })
      .format(new Date(`${currentData.month}-01T12:00:00+07:00`))
    : 'Tidak ada data'
  const exportReport: OwnerReport = {
    title: 'Laporan Laba Rugi Bulanan',
    period: selectedPeriod,
    fileName: `Laporan_Keuangan_${selectedPeriod}`,
    businessName,
    generatedBy,
    summary: currentData
      ? [
          { label: 'Total omzet', value: currentData.gross_revenue, format: 'currency' },
          { label: 'Jumlah transaksi', value: currentData.total_orders, format: 'number' },
          { label: 'Laba kotor', value: currentData.gross_profit, format: 'currency' },
          { label: 'Laba bersih', value: currentData.net_profit, format: 'currency' },
        ]
      : [],
    columns: [
      { key: 'item', header: 'Komponen Laporan' },
      { key: 'amount', header: 'Nilai (Rp)', format: 'currency' },
      { key: 'detail', header: 'Keterangan' },
    ],
    rows: currentData
      ? [
          { item: 'Pendapatan Penjualan Bersih', amount: currentData.gross_revenue, detail: `${currentData.total_orders} transaksi berhasil` },
          { item: 'Harga Pokok Penjualan (HPP)', amount: currentData.cogs, detail: 'Biaya barang terjual' },
          { item: 'Laba Kotor', amount: currentData.gross_profit, detail: `Margin ${currentData.margin_gross.toFixed(1)}%` },
          { item: 'Beban Operasional', amount: currentData.expenses, detail: 'Beban tercatat pada periode ini' },
          { item: 'Laba Bersih', amount: currentData.net_profit, detail: `Margin ${currentData.margin_net.toFixed(1)}%` },
        ]
      : [],
    chart: {
      title: 'Tren Laba Kotor dan Laba Bersih',
      categories: trendReports.map((report) =>
        new Intl.DateTimeFormat('id-ID', { month: 'short', timeZone: 'Asia/Jakarta' })
          .format(new Date(`${report.month}-01T12:00:00+07:00`))),
      series: [
        { name: 'Laba kotor', values: trendReports.map((report) => report.gross_profit), color: '#14b8a6' },
        { name: 'Laba bersih', values: trendReports.map((report) => report.net_profit), color: '#2563eb' },
      ],
    },
  }

  return (
    <div>
      <PageHeader
        title="Laporan Laba Rugi Bulanan"
        subtitle="Analisis terstruktur pendapatan kotor, HPP, beban operasional, dan margin laba bersih bisnis"
        actions={
          <OwnerReportExport report={exportReport} disabled={!currentData} />
        }
      />

      {/* Selector Bulan */}
      <div className="toolbar-row">
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--mute)' }}>Pilih Periode Bulan:</span>
        <select
          value={selectedMonth}
          onChange={e => setSelectedMonth(e.target.value)}
          style={{
            padding: '8px 16px', borderRadius: 8, border: '1px solid var(--line)',
            background: 'var(--panel)', fontSize: 14, fontWeight: 700, outline: 'none'
          }}
        >
          {reports.map(r => (
            <option key={r.month} value={r.month}>
              {new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' })
                .format(new Date(`${r.month}-01T12:00:00+07:00`))}
            </option>
          ))}
        </select>
      </div>

      {!currentData && <p className="card" role="status">Belum ada data laporan keuangan untuk ditampilkan.</p>}

      {currentData && (
        <>
          {/* KPI Cards untuk Bulan Terpilih */}
          <div className="responsive-kpi">
            <div className="kpi-card">
              <div className="kpi-icon" style={{ background: 'var(--accs)', color: 'var(--acc)' }}>
                <DollarSign size={20} />
              </div>
              <div className="kpi-label">Pendapatan Kotor (Omzet)</div>
              <div className="kpi-value" style={{ color: 'var(--acc)' }}>
                <FormatRupiah amount={currentData.gross_revenue} />
              </div>
              <div className="kpi-sub">{currentData.total_orders} total transaksi berhasil</div>
            </div>

            <div className="kpi-card">
              <div className="kpi-icon" style={{ background: 'var(--warns)', color: 'var(--warn)' }}>
                <TrendingDown size={20} />
              </div>
              <div className="kpi-label">HPP (Modal Barang)</div>
              <div className="kpi-value" style={{ color: 'var(--warn)' }}>
                <FormatRupiah amount={currentData.cogs} />
              </div>
              <div className="kpi-sub">{currentData.gross_revenue > 0 ? ((currentData.cogs / currentData.gross_revenue) * 100).toFixed(1) : 0}% dari omzet</div>
            </div>

            <div className="kpi-card">
              <div className="kpi-icon" style={{ background: 'var(--oks)', color: 'var(--ok)' }}>
                <TrendingUp size={20} />
              </div>
              <div className="kpi-label">Laba Kotor (Gross Profit)</div>
              <div className="kpi-value" style={{ color: 'var(--ok)' }}>
                <FormatRupiah amount={currentData.gross_profit} />
              </div>
              <div className="kpi-sub">Margin Kotor: {currentData.margin_gross.toFixed(1)}%</div>
            </div>

            <div className="kpi-card">
              <div className="kpi-icon" style={{
                background: currentData.net_profit >= 0 ? 'var(--oks)' : 'var(--bads)',
                color: currentData.net_profit >= 0 ? 'var(--ok)' : 'var(--bad)'
              }}>
                <Percent size={20} />
              </div>
              <div className="kpi-label">Laba Bersih (Net Profit)</div>
              <div className="kpi-value" style={{ color: currentData.net_profit >= 0 ? 'var(--ok)' : 'var(--bad)' }}>
                <FormatRupiah amount={currentData.net_profit} />
              </div>
              <div className="kpi-sub">Margin Bersih: {currentData.margin_net.toFixed(1)}%</div>
            </div>
          </div>

          {/* Rincian P&L Statement */}
          <div className="fin-split-grid">
            <SectionCard title="Ringkasan Laporan Laba Rugi (P&L)">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                  <span style={{ fontWeight: 600 }}>1. Pendapatan Penjualan Bersih</span>
                  <span style={{ fontWeight: 700 }}><FormatRupiah amount={currentData.gross_revenue} /></span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line)', color: 'var(--mute)' }}>
                  <span>2. Harga Pokok Penjualan (HPP / Biaya Kulakan)</span>
                  <span style={{ color: 'var(--bad)', fontWeight: 600 }}>- <FormatRupiah amount={currentData.cogs} /></span>
                </div>

                <div style={{
                  display: 'flex', justifyContent: 'space-between', padding: '10px 12px',
                  background: 'var(--bg)', borderRadius: 8, fontWeight: 700
                }}>
                  <span>LABA KOTOR (GROSS PROFIT)</span>
                  <span style={{ color: 'var(--ok)' }}><FormatRupiah amount={currentData.gross_profit} /></span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line)', color: 'var(--mute)' }}>
                  <span>3. Beban Operasional (Sewa, Listrik, Gaji, dll.)</span>
                  <span style={{ color: 'var(--bad)', fontWeight: 600 }}>- <FormatRupiah amount={currentData.expenses} /></span>
                </div>

                <div style={{
                  display: 'flex', justifyContent: 'space-between', padding: '14px 12px',
                  background: currentData.net_profit >= 0 ? 'var(--oks)' : 'var(--bads)',
                  borderRadius: 10, fontWeight: 800, fontSize: 16
                }}>
                  <span>LABA BERSIH (NET PROFIT)</span>
                  <span style={{ color: currentData.net_profit >= 0 ? 'var(--ok)' : 'var(--bad)' }}>
                    <FormatRupiah amount={currentData.net_profit} />
                  </span>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Historis Tren Margin Laba">
              <div style={{ height: 260, width: '100%', marginTop: 8 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={reports.slice().reverse()} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                    <XAxis dataKey="month" stroke="var(--mute)" fontSize={11} tickLine={false} />
                    <YAxis
                      stroke="var(--mute)"
                      fontSize={11}
                      tickLine={false}
                      tickFormatter={val => `Rp ${(val / 1000).toLocaleString('id-ID')}k`}
                    />
                    <Tooltip
                      formatter={(val: any) => [`Rp ${Number(val).toLocaleString('id-ID')}`, '']}
                      contentStyle={{ background: 'var(--panel)', color: 'var(--ink)', borderRadius: 8, border: '1px solid var(--line)' }}
                    />
                    <Legend />
                    <Bar dataKey="gross_profit" name="Laba Kotor" fill="var(--ok)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="net_profit" name="Laba Bersih" fill="var(--acc)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
          </div>
        </>
      )}
    </div>
  )
}
