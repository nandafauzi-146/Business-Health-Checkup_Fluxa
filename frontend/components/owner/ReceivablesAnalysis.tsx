'use client'

import { AlertCircle, CheckCircle, Clock, DollarSign, TrendingDown, Users } from 'lucide-react'
import { PageHeader } from '@/components/layout/Topbar'
import { KpiCard, SectionCard, StatusTag, FormatRupiah } from '@/components/ui/Cards'

interface ReceivableItem {
  id: string
  customer_name: string
  customer_phone: string | null
  total_amount: number
  paid_amount: number
  remaining: number
  due_date: string | null
  status: string
  days_overdue: number
}

interface AnalysisProps {
  totalOutstanding: number
  totalCustomersWithDebt: number
  aging: {
    current: number
    overdue1to30: number
    overdue30plus: number
  }
  receivables: ReceivableItem[]
}

export default function ReceivablesAnalysisClient({
  totalOutstanding,
  totalCustomersWithDebt,
  aging,
  receivables
}: AnalysisProps) {
  return (
    <div>
      <PageHeader
        title="Monitoring Piutang & Kasbon"
        subtitle="Analisis risiko likuiditas, aging schedule piutang belum tertagih, dan eksposur debitur"
      />

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 }}>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: 'var(--warns)', color: 'var(--warn)' }}>
            <DollarSign size={20} />
          </div>
          <div className="kpi-label">Total Piutang Belum Tertagih</div>
          <div className="kpi-value" style={{ color: 'var(--warn)' }}>
            <FormatRupiah amount={totalOutstanding} />
          </div>
          <div className="kpi-sub">Modal tertahan di luar bisnis</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: 'var(--accs)', color: 'var(--acc)' }}>
            <Users size={20} />
          </div>
          <div className="kpi-label">Jumlah Pelanggan Berhutang</div>
          <div className="kpi-value" style={{ color: 'var(--acc)' }}>
            {totalCustomersWithDebt}
          </div>
          <div className="kpi-sub">Debitur aktif</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: 'var(--bads)', color: 'var(--bad)' }}>
            <AlertCircle size={20} />
          </div>
          <div className="kpi-label">Piutang Menunggak (&gt;30 Hari)</div>
          <div className="kpi-value" style={{ color: 'var(--bad)' }}>
            <FormatRupiah amount={aging.overdue30plus} />
          </div>
          <div className="kpi-sub">Risiko piutang tak tertagih tinggi</div>
        </div>
      </div>

      {/* Aging Schedule Piutang */}
      <div style={{ marginBottom: 20 }}>
        <SectionCard title="Aging Schedule Piutang (Kategori Usia Tunggakan)">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginTop: 10 }}>
            <div style={{ padding: '14px', borderRadius: 10, background: 'var(--bg)', borderLeft: '4px solid var(--ok)' }}>
              <div style={{ fontSize: 12, color: 'var(--mute)', fontWeight: 600 }}>Belum Jatuh Tempo / Lancar</div>
              <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4, color: 'var(--ok)' }}>
                <FormatRupiah amount={aging.current} />
              </div>
            </div>

            <div style={{ padding: '14px', borderRadius: 10, background: 'var(--bg)', borderLeft: '4px solid var(--warn)' }}>
              <div style={{ fontSize: 12, color: 'var(--mute)', fontWeight: 600 }}>Jatuh Tempo 1 - 30 Hari</div>
              <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4, color: 'var(--warn)' }}>
                <FormatRupiah amount={aging.overdue1to30} />
              </div>
            </div>

            <div style={{ padding: '14px', borderRadius: 10, background: 'var(--bg)', borderLeft: '4px solid var(--bad)' }}>
              <div style={{ fontSize: 12, color: 'var(--mute)', fontWeight: 600 }}>Menunggak &gt; 30 Hari</div>
              <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4, color: 'var(--bad)' }}>
                <FormatRupiah amount={aging.overdue30plus} />
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Tabel Daftar Debitur */}
      <SectionCard title="Daftar Tagihan Pelanggan Terbesar">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nama Pelanggan</th>
                <th>Kontak</th>
                <th>Total Kasbon</th>
                <th>Sudah Dibayar</th>
                <th>Sisa Tagihan</th>
                <th>Jatuh Tempo</th>
                <th>Status Resiko</th>
              </tr>
            </thead>
            <tbody>
              {receivables.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '32px 0', color: 'var(--mute)' }}>
                    Tidak ada catatan piutang yang belum tertagih
                  </td>
                </tr>
              ) : (
                receivables.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600 }}>{r.customer_name}</td>
                    <td style={{ color: 'var(--mute)', fontSize: 12 }}>{r.customer_phone || '-'}</td>
                    <td style={{ fontWeight: 600 }}><FormatRupiah amount={r.total_amount} /></td>
                    <td style={{ color: 'var(--ok)' }}><FormatRupiah amount={r.paid_amount} /></td>
                    <td style={{ fontWeight: 700, color: 'var(--bad)', fontSize: 14 }}>
                      <FormatRupiah amount={r.remaining} />
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {r.due_date ? new Date(r.due_date).toLocaleDateString('id-ID') : '-'}
                    </td>
                    <td>
                      {r.days_overdue > 30 ? (
                        <StatusTag type="bad" label={`Lewat ${r.days_overdue} hari`} />
                      ) : r.days_overdue > 0 ? (
                        <StatusTag type="warn" label={`Lewat ${r.days_overdue} hari`} />
                      ) : (
                        <StatusTag type="ok" label="Lancar" />
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
