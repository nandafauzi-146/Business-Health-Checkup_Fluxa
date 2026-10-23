'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Building2,
  Calendar,
  CheckCircle2,
  Clock3,
  CreditCard,
  DollarSign,
  Download,
  FileSpreadsheet,
  Filter,
  Info,
  Layers,
  Percent,
  Plus,
  RefreshCw,
  Search,
  TrendingUp,
  Wallet,
  XCircle,
} from 'lucide-react'
import { Empty, ErrorBox, Loading } from './SuperAdminOverview'
import styles from './super-admin-content.module.css'

type FinanceSummary = {
  totalPayments: number
  grossRevenue: number
  successCount: number
  pendingAmount: number
  pendingCount: number
  failedAmount: number
  failedCount: number
  refundedAmount: number
  refundedCount: number
  successRate: number
  totalExpenses: number
  expensesCount: number
  netBalance: number
  byPlan: { plan: string; grossRevenue: number; payments: number }[]
}

type DailyData = {
  date: string
  formattedDate: string
  totalTransactions: number
  successfulTransactions: number
  revenue: number
  failedCount: number
}

type MonthlyData = {
  month: string
  formattedMonth: string
  revenue: number
  count: number
}

type Transaction = {
  id: string
  order_id: string
  owner_id: string
  plan_name: string
  amount: number
  status: string
  gateway_transaction_id: string | null
  created_at: string
  paid_at: string | null
  customerName: string
  customerEmail: string
  customerPhone: string
}

type ExpenseRecord = {
  id: string
  amount: number
  currency: string
  status: 'pending' | 'approved' | 'rejected' | 'completed' | 'cancelled'
  reference_number: string
  destination: string
  category: string
  transaction_date: string
  notes: string
  created_by_name: string
  created_at: string
}

type ExpenseSummary = {
  totalCompletedAmount: number
  completedCount: number
  pendingCount: number
  pendingAmount: number
  byCategory: Record<string, number>
}

const money = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })
const numberFormat = new Intl.NumberFormat('id-ID')
const dateTime = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' })
const dateOnly = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeZone: 'Asia/Jakarta' })

const statusBadgeLabel: Record<string, { label: string; tone: string }> = {
  success: { label: 'Berhasil', tone: 'status_active' },
  pending: { label: 'Menunggu', tone: 'status_pending' },
  failed: { label: 'Gagal', tone: 'status_rejected' },
  expired: { label: 'Kedaluwarsa', tone: 'status_expired' },
  cancelled: { label: 'Dibatalkan', tone: 'status_inactive' },
  refunded: { label: 'Direfund', tone: 'status_inactive' },
  completed: { label: 'Tercatat Selesai', tone: 'status_active' },
}

const categoryLabels: Record<string, string> = {
  operasional: 'Operasional & Kantor',
  server_infra: 'Server & Cloud Infrastructure',
  pajak: 'Pajak & Legalitas',
  penarikan_dividen: 'Penarikan Dev / Dividen',
  peralatan_software: 'Software & Lisensi Tools',
  marketing: 'Marketing & Promosi',
  withdraw: 'Penarikan Internal',
  lainnya: 'Pengeluaran Lainnya',
}

export default function SuperAdminFinance() {
  const [activeTab, setActiveTab] = useState<'overview' | 'daily' | 'expenses'>('overview')
  const [trendView, setTrendView] = useState<'daily' | 'monthly'>('daily')

  // Data states
  const [summary, setSummary] = useState<FinanceSummary | null>(null)
  const [dailyAnalytics, setDailyAnalytics] = useState<DailyData[]>([])
  const [monthlyAnalytics, setMonthlyAnalytics] = useState<MonthlyData[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [availablePlans, setAvailablePlans] = useState<string[]>([])
  const [totalTransactions, setTotalTransactions] = useState(0)

  // Filter states
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [status, setStatus] = useState('')
  const [selectedPlan, setSelectedPlan] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 15

  // Expense/Withdrawal states (Reporting Only)
  const [expenseRecords, setExpenseRecords] = useState<ExpenseRecord[]>([])
  const [expenseSummary, setExpenseSummary] = useState<ExpenseSummary | null>(null)
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState('')
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false)
  const [expenseSubmitting, setExpenseSubmitting] = useState(false)
  const [expenseModalError, setExpenseModalError] = useState('')

  // Expense Form fields
  const [expAmount, setExpAmount] = useState('')
  const [expDate, setExpDate] = useState(new Date().toISOString().slice(0, 10))
  const [expCategory, setExpCategory] = useState('operasional')
  const [expDestination, setExpDestination] = useState('')
  const [expRefNumber, setExpRefNumber] = useState('')
  const [expNotes, setExpNotes] = useState('')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Load finance report
  const loadFinanceReport = useCallback(async () => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    })
    if (start) params.set('start', start)
    if (end) params.set('end', end)
    if (status) params.set('status', status)
    if (selectedPlan) params.set('plan', selectedPlan)
    if (searchTerm) params.set('search', searchTerm)

    const response = await fetch(`/api/super-admin/finance?${params}`, { cache: 'no-store' })
    const result = await response.json() as {
      summary?: FinanceSummary
      dailyAnalytics?: DailyData[]
      monthlyAnalytics?: MonthlyData[]
      transactions?: Transaction[]
      availablePlans?: string[]
      total?: number
      error?: string
    }

    if (!response.ok) throw new Error(result.error || 'Laporan keuangan belum dapat dimuat.')

    setSummary(result.summary ?? null)
    setDailyAnalytics(result.dailyAnalytics ?? [])
    setMonthlyAnalytics(result.monthlyAnalytics ?? [])
    setTransactions(result.transactions ?? [])
    setAvailablePlans(result.availablePlans ?? [])
    setTotalTransactions(result.total ?? 0)
    setError('')
  }, [page, start, end, status, selectedPlan, searchTerm])

  // Load expense/withdrawal report
  const loadExpenseReport = useCallback(async () => {
    const params = new URLSearchParams({ pageSize: '50' })
    if (start) params.set('start', start)
    if (end) params.set('end', end)
    if (expenseCategoryFilter) params.set('category', expenseCategoryFilter)

    const response = await fetch(`/api/super-admin/withdrawals?${params}`, { cache: 'no-store' })
    const result = await response.json() as {
      withdrawals?: ExpenseRecord[]
      summary?: ExpenseSummary
      error?: string
    }

    if (!response.ok) throw new Error(result.error || 'Catatan pengeluaran belum dapat dimuat.')

    setExpenseRecords(result.withdrawals ?? [])
    setExpenseSummary(result.summary ?? null)
  }, [start, end, expenseCategoryFilter])

  useEffect(() => {
    let cancelled = false
    async function fetchData() {
      setLoading(true)
      try {
        await Promise.all([loadFinanceReport(), loadExpenseReport()])
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Laporan belum dapat dimuat.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void fetchData()
    return () => { cancelled = true }
  }, [loadFinanceReport, loadExpenseReport])

  async function exportCsv() {
    const params = new URLSearchParams({ format: 'csv' })
    if (start) params.set('start', start)
    if (end) params.set('end', end)
    if (status) params.set('status', status)
    if (selectedPlan) params.set('plan', selectedPlan)
    if (searchTerm) params.set('search', searchTerm)

    try {
      const response = await fetch(`/api/super-admin/finance?${params}`, { cache: 'no-store' })
      if (!response.ok) {
        const result = await response.json() as { error?: string }
        throw new Error(result.error || 'Ekspor CSV gagal.')
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `laporan-keuangan-fluxa-${new Date().toISOString().slice(0, 10)}.csv`
      link.click()
      URL.revokeObjectURL(url)
    } catch (exportErr) {
      setError(exportErr instanceof Error ? exportErr.message : 'Ekspor CSV gagal.')
    }
  }

  async function handleAddExpenseRecord(e: React.FormEvent) {
    e.preventDefault()
    setExpenseModalError('')
    setExpenseSubmitting(true)

    const cleanAmount = Number.parseInt(expAmount.replace(/\D/g, ''), 10)
    if (!cleanAmount || cleanAmount <= 0) {
      setExpenseModalError('Masukkan nominal pengeluaran yang valid.')
      setExpenseSubmitting(false)
      return
    }

    try {
      const response = await fetch('/api/super-admin/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: cleanAmount,
          destination: expDestination,
          category: expCategory,
          transaction_date: expDate,
          reference_number: expRefNumber,
          notes: expNotes,
          status: 'completed',
        }),
      })
      const result = await response.json() as { error?: string }
      if (!response.ok) throw new Error(result.error || 'Catatan belum dapat disimpan.')

      setShowAddExpenseModal(false)
      setExpAmount('')
      setExpDestination('')
      setExpRefNumber('')
      setExpNotes('')
      await Promise.all([loadFinanceReport(), loadExpenseReport()])
    } catch (saveErr) {
      setExpenseModalError(saveErr instanceof Error ? saveErr.message : 'Gagal menyimpan catatan.')
    } finally {
      setExpenseSubmitting(false)
    }
  }

  const refreshAll = () => {
    setLoading(true)
    Promise.all([loadFinanceReport(), loadExpenseReport()]).finally(() => setLoading(false))
  }

  const totalPages = Math.max(1, Math.ceil(totalTransactions / pageSize))
  const maxDailyRevenue = Math.max(1, ...dailyAnalytics.map((d) => d.revenue))
  const maxMonthlyRevenue = Math.max(1, ...monthlyAnalytics.map((m) => m.revenue))

  return (
    <section className={styles.page}>
      {/* Dashboard Header */}
      <div className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>FINANCIAL REPORTING & ANALYTICS</span>
          <h1>Laporan Keuangan Platform</h1>
          <p>
            Pantau arus kas pendapatan subscription, analitik transaksi harian, dan rekonsiliasi beban pengeluaran eksternal.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className={styles.secondaryButton} type="button" disabled={loading} onClick={refreshAll}>
            <RefreshCw size={14} className={loading ? styles.spin : ''} /> Muat Ulang
          </button>
          <button className={styles.secondaryButton} type="button" onClick={() => void exportCsv()}>
            <FileSpreadsheet size={14} /> Ekspor CSV Laporan
          </button>
          {activeTab === 'expenses' && (
            <button className={styles.primaryButton} type="button" onClick={() => setShowAddExpenseModal(true)}>
              <Plus size={14} /> Catat Pengeluaran Eksternal
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '10px', borderBottom: '1px solid var(--line)', paddingBottom: '10px' }}>
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 700,
            background: activeTab === 'overview' ? 'var(--role-acc, var(--acc))' : 'transparent',
            color: activeTab === 'overview' ? 'white' : 'var(--mute)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <BarChart3 size={14} /> Ikhtisar & Laporan Pendapatan
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('daily')}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 700,
            background: activeTab === 'daily' ? 'var(--role-acc, var(--acc))' : 'transparent',
            color: activeTab === 'daily' ? 'white' : 'var(--mute)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <TrendingUp size={14} /> Analitik Transaksi & Tren Waktu
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('expenses')}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 700,
            background: activeTab === 'expenses' ? 'var(--role-acc, var(--acc))' : 'transparent',
            color: activeTab === 'expenses' ? 'white' : 'var(--mute)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <Wallet size={14} /> Rekonsiliasi Pengeluaran & Withdraw (Reporting Only)
        </button>
      </div>

      {error && <ErrorBox message={error} retry={refreshAll} />}

      {/* 1. PRIMARY METRICS: REVENUE, EXPENSES & NET BALANCE */}
      <div className={styles.statsGrid}>
        {/* Total Subscription Revenue */}
        <article className={`${styles.statCard} ${styles.tone_success}`}>
          <span className={styles.statIcon}><DollarSign size={20} /></span>
          <div>
            <strong>{loading ? '—' : money.format(summary?.grossRevenue ?? 0)}</strong>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ArrowUpRight size={13} color="var(--ok)" /> Total Pendapatan Subscription
            </span>
          </div>
        </article>

        {/* Total Recorded External Expenses */}
        <article className={`${styles.statCard} ${styles.tone_warning}`}>
          <span className={styles.statIcon}><Wallet size={20} /></span>
          <div>
            <strong>{loading ? '—' : money.format(summary?.totalExpenses ?? 0)}</strong>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ArrowDownRight size={13} color="var(--warn)" /> Beban / Withdraw Tercatat ({summary?.expensesCount ?? 0} trx)
            </span>
          </div>
        </article>

        {/* Net Financial Balance */}
        <article
          className={styles.statCard}
          style={{
            borderLeft: `4px solid ${(summary?.netBalance ?? 0) >= 0 ? 'var(--ok)' : 'var(--bad)'}`,
            background: (summary?.netBalance ?? 0) >= 0 ? 'var(--oks)' : 'var(--bads)',
          }}
        >
          <span className={styles.statIcon}><CheckCircle2 size={20} /></span>
          <div>
            <strong style={{ color: (summary?.netBalance ?? 0) >= 0 ? 'var(--ok)' : 'var(--bad)' }}>
              {loading ? '—' : money.format(summary?.netBalance ?? 0)}
            </strong>
            <span style={{ fontWeight: 600 }}>Saldo Keuangan Bersih (Net Balance)</span>
          </div>
        </article>

        {/* Payment Success Rate */}
        <article className={styles.statCard}>
          <span className={styles.statIcon}><Percent size={20} /></span>
          <div>
            <strong>{loading ? '—' : `${summary?.successRate ?? 0}%`}</strong>
            <span>Rasio Pembayaran Sukses ({summary?.successCount ?? 0} dari {summary?.totalPayments ?? 0})</span>
          </div>
        </article>
      </div>

      {/* TAB 1: OVERVIEW & DETAILED REPORT */}
      {activeTab === 'overview' && (
        <>
          {/* Payment Status Breakdown */}
          <div className={styles.statsGrid}>
            <article className={styles.statCard}>
              <span className={styles.statIcon}><CheckCircle2 size={16} /></span>
              <div>
                <strong>{loading ? '—' : money.format(summary?.grossRevenue ?? 0)}</strong>
                <span>{summary?.successCount ?? 0} Pembayaran Berhasil</span>
              </div>
            </article>

            <article className={`${styles.statCard} ${styles.tone_warning}`}>
              <span className={styles.statIcon}><Clock3 size={16} /></span>
              <div>
                <strong>{loading ? '—' : money.format(summary?.pendingAmount ?? 0)}</strong>
                <span>{summary?.pendingCount ?? 0} Transaksi Pending</span>
              </div>
            </article>

            <article className={`${styles.statCard} ${styles.tone_danger}`}>
              <span className={styles.statIcon}><XCircle size={16} /></span>
              <div>
                <strong>{loading ? '—' : money.format(summary?.failedAmount ?? 0)}</strong>
                <span>{summary?.failedCount ?? 0} Transaksi Gagal / Expired</span>
              </div>
            </article>

            <article className={styles.statCard}>
              <span className={styles.statIcon}><RefreshCw size={16} /></span>
              <div>
                <strong>{loading ? '—' : money.format(summary?.refundedAmount ?? 0)}</strong>
                <span>{summary?.refundedCount ?? 0} Refund / Dibatalkan</span>
              </div>
            </article>
          </div>

          {/* Revenue Distribution by Package */}
          <section className={styles.panel}>
            <div className={styles.panelHeading}>
              <div>
                <h2>Kontribusi Pendapatan Menurut Paket</h2>
                <p>Pembagian total nominal dan volume pembayaran berdasarkan tier paket subscription.</p>
              </div>
              <Layers size={16} color="var(--mute)" />
            </div>
            {loading ? (
              <Loading />
            ) : !summary?.byPlan.length ? (
              <Empty text="Belum ada data pembayaran paket." />
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Nama Paket</th>
                      <th>Total Pendapatan Bruto</th>
                      <th>Jumlah Transaksi</th>
                      <th>Rata-rata Nilai Transaksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.byPlan.map((item) => (
                      <tr key={item.plan}>
                        <td><strong>{item.plan}</strong></td>
                        <td><strong style={{ color: 'var(--ok)' }}>{money.format(item.grossRevenue)}</strong></td>
                        <td>{item.payments} transaksi</td>
                        <td>{money.format(item.payments > 0 ? item.grossRevenue / item.payments : 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Detailed Transaction History Table with Multi-Filter */}
          <section className={styles.panel}>
            <div className={styles.panelHeading}>
              <div>
                <h2>Riwayat Transaksi Langganan Detail</h2>
                <p>Data lengkap transaksi pelanggan, nama pemilik bisnis, nominal, dan status verifikasi server.</p>
              </div>
            </div>

            {/* Filter Bar */}
            <div className={styles.filters} style={{ marginBottom: '16px' }}>
              <div style={{ position: 'relative', flex: '1 1 240px' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--mute)' }} />
                <input
                  placeholder="Cari Order ID, Nama Bisnis, atau Email..."
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setPage(1) }}
                  style={{ paddingLeft: '32px', width: '100%' }}
                />
              </div>

              <select
                aria-label="Filter status transaksi"
                value={status}
                onChange={(e) => { setStatus(e.target.value); setPage(1) }}
              >
                <option value="">Semua Status Pembayaran</option>
                <option value="success">Berhasil (Success)</option>
                <option value="pending">Menunggu (Pending)</option>
                <option value="failed">Gagal (Failed)</option>
                <option value="expired">Kedaluwarsa (Expired)</option>
                <option value="refunded">Direfund</option>
              </select>

              <select
                aria-label="Filter paket langganan"
                value={selectedPlan}
                onChange={(e) => { setSelectedPlan(e.target.value); setPage(1) }}
              >
                <option value="">Semua Paket Subscription</option>
                {availablePlans.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>

              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--mute)' }}>
                Dari
                <input
                  type="date"
                  value={start}
                  onChange={(e) => { setStart(e.target.value); setPage(1) }}
                  style={{ minWidth: '130px' }}
                />
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--mute)' }}>
                Sampai
                <input
                  type="date"
                  value={end}
                  onChange={(e) => { setEnd(e.target.value); setPage(1) }}
                  style={{ minWidth: '130px' }}
                />
              </label>
            </div>

            {loading ? (
              <Loading />
            ) : transactions.length === 0 ? (
              <Empty text="Tidak ada transaksi yang sesuai dengan filter yang dipilih." />
            ) : (
              <>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Order ID / ID Gateway</th>
                        <th>Customer / Bisnis</th>
                        <th>Paket</th>
                        <th>Nominal</th>
                        <th>Tanggal Transaksi</th>
                        <th>Waktu Konfirmasi Bayar</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((t) => {
                        const statusConfig = statusBadgeLabel[t.status] ?? { label: t.status, tone: '' }
                        return (
                          <tr key={t.id}>
                            <td>
                              <strong>{t.order_id}</strong>
                              <small style={{ color: 'var(--mute)' }}>{t.gateway_transaction_id || 'Belum ada ref ID'}</small>
                            </td>
                            <td>
                              <strong>{t.customerName}</strong>
                              <small>{t.customerEmail || t.customerPhone || 'Owner Bisnis'}</small>
                            </td>
                            <td>
                              <span style={{ fontWeight: 600 }}>{t.plan_name}</span>
                            </td>
                            <td>
                              <strong style={{ color: 'var(--ink)' }}>{money.format(t.amount)}</strong>
                            </td>
                            <td>{dateTime.format(new Date(t.created_at))}</td>
                            <td>{t.paid_at ? dateTime.format(new Date(t.paid_at)) : '—'}</td>
                            <td>
                              <span className={`${styles.badge} ${styles[statusConfig.tone] ?? ''}`}>
                                {statusConfig.label}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className={styles.pager} style={{ marginTop: '16px' }}>
                  <span>
                    Menampilkan {totalTransactions ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, totalTransactions)} dari {totalTransactions} transaksi
                  </span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      disabled={page <= 1 || loading}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      Sebelumnya
                    </button>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      disabled={page >= totalPages || loading}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Berikutnya
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
        </>
      )}

      {/* TAB 2: DAILY TRANSACTIONS & REVENUE TREND ANALYTICS */}
      {activeTab === 'daily' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                className={trendView === 'daily' ? styles.primaryButton : styles.secondaryButton}
                onClick={() => setTrendView('daily')}
                style={{ minHeight: '32px', fontSize: '11px' }}
              >
                Grafik Harian (Daily Transactions)
              </button>
              <button
                type="button"
                className={trendView === 'monthly' ? styles.primaryButton : styles.secondaryButton}
                onClick={() => setTrendView('monthly')}
                style={{ minHeight: '32px', fontSize: '11px' }}
              >
                Grafik Bulanan (Monthly Trend)
              </button>
            </div>
          </div>

          {/* Interactive Chart Panel */}
          <section className={styles.panel}>
            <div className={styles.panelHeading}>
              <div>
                <h2>
                  {trendView === 'daily'
                    ? 'Volume & Nilai Transaksi Platform Harian'
                    : 'Tren Akumulasi Pendapatan Bulanan (12 Bulan Terakhir)'}
                </h2>
                <p>
                  Visualisasi arus pembayaran langganan terverifikasi yang diterima oleh platform.
                </p>
              </div>
              <TrendingUp size={16} color="var(--role-acc, var(--acc))" />
            </div>

            {loading ? (
              <Loading />
            ) : trendView === 'daily' ? (
              dailyAnalytics.length === 0 ? (
                <Empty text="Belum ada transaksi harian pada rentang waktu ini." />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div className={styles.chart} style={{ height: '220px', gridTemplateColumns: `repeat(${Math.min(dailyAnalytics.length, 31)}, minmax(0, 1fr))` }}>
                    {dailyAnalytics.slice(-31).map((item) => (
                      <div className={styles.chartColumn} key={item.date} title={`${item.formattedDate}: ${money.format(item.revenue)} (${item.successfulTransactions} trx)`}>
                        <span style={{ fontSize: '9px' }}>
                          {item.revenue > 0 ? `${(item.revenue / 1000).toFixed(0)}k` : '0'}
                        </span>
                        <div className={styles.chartTrack}>
                          <div
                            className={styles.chartBar}
                            style={{
                              height: `${Math.max(item.revenue ? 8 : 2, (item.revenue / maxDailyRevenue) * 100)}%`,
                              background: item.revenue > 0 ? 'var(--ok)' : 'var(--line)',
                            }}
                          />
                        </div>
                        <small style={{ fontSize: '9px' }}>{item.formattedDate}</small>
                      </div>
                    ))}
                  </div>

                  {/* Daily Summary Table */}
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Tanggal</th>
                          <th>Total Transaksi Diterima</th>
                          <th>Transaksi Berhasil</th>
                          <th>Transaksi Gagal / Pending</th>
                          <th>Total Nilai Pendapatan (IDR)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...dailyAnalytics].reverse().map((d) => (
                          <tr key={d.date}>
                            <td><strong>{dateOnly.format(new Date(d.date))}</strong></td>
                            <td>{d.totalTransactions} transaksi</td>
                            <td><span style={{ color: 'var(--ok)', fontWeight: 600 }}>{d.successfulTransactions}</span></td>
                            <td><span style={{ color: d.failedCount > 0 ? 'var(--bad)' : 'var(--mute)' }}>{d.totalTransactions - d.successfulTransactions}</span></td>
                            <td><strong style={{ color: 'var(--ink)' }}>{money.format(d.revenue)}</strong></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            ) : (
              // Monthly Trend View
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className={styles.chart} style={{ height: '220px', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))' }}>
                  {monthlyAnalytics.map((item) => (
                    <div className={styles.chartColumn} key={item.month} title={`${item.formattedMonth}: ${money.format(item.revenue)} (${item.count} trx)`}>
                      <span style={{ fontSize: '9px' }}>
                        {item.revenue > 0 ? `${(item.revenue / 1000000).toFixed(1)}M` : '0'}
                      </span>
                      <div className={styles.chartTrack}>
                        <div
                          className={styles.chartBar}
                          style={{
                            height: `${Math.max(item.revenue ? 8 : 2, (item.revenue / maxMonthlyRevenue) * 100)}%`,
                            background: item.revenue > 0 ? 'var(--role-acc, var(--acc))' : 'var(--line)',
                          }}
                        />
                      </div>
                      <small style={{ fontSize: '9px' }}>{item.formattedMonth}</small>
                    </div>
                  ))}
                </div>

                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Bulan</th>
                        <th>Jumlah Transaksi Sukses</th>
                        <th>Total Pendapatan Bruto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...monthlyAnalytics].reverse().map((m) => (
                        <tr key={m.month}>
                          <td><strong>{m.formattedMonth}</strong></td>
                          <td>{m.count} transaksi</td>
                          <td><strong style={{ color: 'var(--role-acc, var(--acc))' }}>{money.format(m.revenue)}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        </>
      )}

      {/* TAB 3: EXPENSES & WITHDRAWALS REPORTING (REPORTING ONLY) */}
      {activeTab === 'expenses' && (
        <>
          {/* Explicit Notice Banner for Reporting-Only Feature */}
          <div className={styles.infoBox} style={{ borderLeftColor: 'var(--acc)', background: 'var(--panel)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <Info size={18} color="var(--acc)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>Pemberitahuan Sistem: Modul Pelaporan & Rekonsiliasi Pengeluaran (Reporting-Only)</strong>
                <p style={{ margin: '4px 0 0', fontSize: '11px', lineHeight: 1.6, color: 'var(--mute)' }}>
                  Platform FLUXA tidak memproses pengiriman uang atau penarikan dana secara otomatis melalui website. Seluruh pencairan dividen, transfer vendor, dan pembayaran biaya operasional dilakukan secara eksternal melalui rekening bank atau e-wallet resmi platform. Formulir ini digunakan oleh Super Admin untuk <strong>mencatat dan merekonsiliasi pengeluaran eksternal</strong> tersebut agar pembukuan saldo bersih platform tetap akurat.
                </p>
              </div>
            </div>
          </div>

          {/* Expense Category Breakdown */}
          <div className={styles.statsGrid}>
            <article className={styles.statCard}>
              <span className={styles.statIcon}><Wallet size={16} /></span>
              <div>
                <strong>{money.format(expenseSummary?.totalCompletedAmount ?? 0)}</strong>
                <span>Total Pengeluaran & Withdraw Tercatat</span>
              </div>
            </article>

            <article className={styles.statCard}>
              <span className={styles.statIcon}><Layers size={16} /></span>
              <div>
                <strong>{expenseSummary?.completedCount ?? 0} Transaksi</strong>
                <span>Jumlah Catatan Pengeluaran Selesai</span>
              </div>
            </article>

            <article className={styles.statCard}>
              <span className={styles.statIcon}><Building2 size={16} /></span>
              <div>
                <strong>{money.format(expenseSummary?.byCategory?.['server_infra'] ?? 0)}</strong>
                <span>Beban Server & Cloud Infra</span>
              </div>
            </article>

            <article className={styles.statCard}>
              <span className={styles.statIcon}><DollarSign size={16} /></span>
              <div>
                <strong>{money.format(expenseSummary?.byCategory?.['penarikan_dividen'] ?? 0)}</strong>
                <span>Penarikan Dev / Dividen Tercatat</span>
              </div>
            </article>
          </div>

          {/* Expense Table with Filter */}
          <section className={styles.panel}>
            <div className={styles.panelHeading}>
              <div>
                <h2>Riwayat Pencatatan Beban & Penarikan Eksternal</h2>
                <p>Daftar transaksi pengeluaran eksternal yang telah diverifikasi dan dicatat untuk rekonsiliasi.</p>
              </div>
              <button className={styles.primaryButton} type="button" onClick={() => setShowAddExpenseModal(true)}>
                <Plus size={14} /> Catat Pengeluaran Baru
              </button>
            </div>

            <div className={styles.filters} style={{ marginBottom: '16px' }}>
              <select
                aria-label="Filter kategori beban"
                value={expenseCategoryFilter}
                onChange={(e) => setExpenseCategoryFilter(e.target.value)}
              >
                <option value="">Semua Kategori Pengeluaran</option>
                {Object.entries(categoryLabels).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            {loading ? (
              <Loading />
            ) : expenseRecords.length === 0 ? (
              <Empty text="Belum ada catatan pengeluaran eksternal pada kategori ini." />
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Tanggal Transaksi</th>
                      <th>No. Referensi / Mutasi</th>
                      <th>Kategori</th>
                      <th>Nominal (IDR)</th>
                      <th>Rekening / E-Wallet Tujuan</th>
                      <th>Dicatat Oleh</th>
                      <th>Keterangan / Notes</th>
                      <th>Status Pembukuan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenseRecords.map((r) => (
                      <tr key={r.id}>
                        <td><strong>{dateOnly.format(new Date(r.transaction_date))}</strong></td>
                        <td>
                          <code>{r.reference_number}</code>
                        </td>
                        <td>
                          <span style={{ fontWeight: 600 }}>{categoryLabels[r.category] ?? r.category}</span>
                        </td>
                        <td>
                          <strong style={{ color: 'var(--warn)' }}>{money.format(r.amount)}</strong>
                        </td>
                        <td>{r.destination}</td>
                        <td>{r.created_by_name}</td>
                        <td style={{ maxWidth: '200px', whiteSpace: 'normal' }}>
                          <small>{r.notes || '—'}</small>
                        </td>
                        <td>
                          <span className={`${styles.badge} ${styles.status_active}`}>
                            Tercatat Selesai
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {/* Modal: Catat Pengeluaran / Withdraw Eksternal (Recordkeeping Only) */}
      {showAddExpenseModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
        >
          <div
            style={{
              background: 'var(--panel)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius-card)',
              width: '100%',
              maxWidth: '520px',
              padding: '24px',
              boxShadow: 'var(--shadow-hard)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h2 style={{ margin: 0, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Wallet size={18} color="var(--role-acc, var(--acc))" />
                Catat Pengeluaran / Withdraw Eksternal
              </h2>
              <span className={styles.badge} style={{ background: 'var(--role-accs, var(--accs))', color: 'var(--role-acc, var(--acc))' }}>
                Reporting Only
              </span>
            </div>

            <p style={{ margin: '0 0 16px', fontSize: '12px', color: 'var(--mute)', lineHeight: 1.5 }}>
              Catatan ini untuk pelaporan dan pembukuan internal. Pastikan transfer dana telah selesai dilakukan melalui rekening bank atau e-wallet Anda.
            </p>

            {expenseModalError && (
              <div className={styles.errorBox} style={{ marginBottom: '14px' }}>
                <span>{expenseModalError}</span>
              </div>
            )}

            <form onSubmit={(e) => void handleAddExpenseRecord(e)}>
              <div style={{ display: 'grid', gap: '12px' }}>
                {/* Nominal */}
                <div>
                  <label htmlFor="exp-amount" style={{ display: 'block', fontSize: '12px', fontWeight: 650, marginBottom: '4px' }}>
                    Nominal Transaksi (IDR) *
                  </label>
                  <input
                    id="exp-amount"
                    required
                    type="number"
                    min="1000"
                    placeholder="Contoh: 1500000"
                    value={expAmount}
                    onChange={(e) => setExpAmount(e.target.value)}
                    style={{
                      width: '100%',
                      height: '38px',
                      padding: '0 10px',
                      borderRadius: '8px',
                      border: '1px solid var(--line)',
                      background: 'var(--input-bg)',
                      color: 'var(--ink)',
                    }}
                  />
                </div>

                {/* Tanggal & Kategori (2 Kolom) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label htmlFor="exp-date" style={{ display: 'block', fontSize: '12px', fontWeight: 650, marginBottom: '4px' }}>
                      Tanggal Transaksi Eksternal *
                    </label>
                    <input
                      id="exp-date"
                      required
                      type="date"
                      value={expDate}
                      onChange={(e) => setExpDate(e.target.value)}
                      style={{
                        width: '100%',
                        height: '38px',
                        padding: '0 10px',
                        borderRadius: '8px',
                        border: '1px solid var(--line)',
                        background: 'var(--input-bg)',
                        color: 'var(--ink)',
                      }}
                    />
                  </div>

                  <div>
                    <label htmlFor="exp-category" style={{ display: 'block', fontSize: '12px', fontWeight: 650, marginBottom: '4px' }}>
                      Kategori Pengeluaran *
                    </label>
                    <select
                      id="exp-category"
                      value={expCategory}
                      onChange={(e) => setExpCategory(e.target.value)}
                      style={{
                        width: '100%',
                        height: '38px',
                        padding: '0 10px',
                        borderRadius: '8px',
                        border: '1px solid var(--line)',
                        background: 'var(--input-bg)',
                        color: 'var(--ink)',
                      }}
                    >
                      {Object.entries(categoryLabels).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Rekening Tujuan */}
                <div>
                  <label htmlFor="exp-dest" style={{ display: 'block', fontSize: '12px', fontWeight: 650, marginBottom: '4px' }}>
                    Rekening Bank / E-Wallet Tujuan *
                  </label>
                  <input
                    id="exp-dest"
                    required
                    type="text"
                    placeholder="Contoh: BCA 882910291 a.n. PT Cloud Hosting"
                    value={expDestination}
                    onChange={(e) => setExpDestination(e.target.value)}
                    style={{
                      width: '100%',
                      height: '38px',
                      padding: '0 10px',
                      borderRadius: '8px',
                      border: '1px solid var(--line)',
                      background: 'var(--input-bg)',
                      color: 'var(--ink)',
                    }}
                  />
                </div>

                {/* No Referensi Mutasi */}
                <div>
                  <label htmlFor="exp-ref" style={{ display: 'block', fontSize: '12px', fontWeight: 650, marginBottom: '4px' }}>
                    Nomor Referensi Bank / Mutasi (Opsional)
                  </label>
                  <input
                    id="exp-ref"
                    type="text"
                    placeholder="Contoh: REF-BCA-20261023-00912"
                    value={expRefNumber}
                    onChange={(e) => setExpRefNumber(e.target.value)}
                    style={{
                      width: '100%',
                      height: '38px',
                      padding: '0 10px',
                      borderRadius: '8px',
                      border: '1px solid var(--line)',
                      background: 'var(--input-bg)',
                      color: 'var(--ink)',
                    }}
                  />
                </div>

                {/* Catatan / Keterangan */}
                <div>
                  <label htmlFor="exp-notes" style={{ display: 'block', fontSize: '12px', fontWeight: 650, marginBottom: '4px' }}>
                    Catatan / Alasan Pembukuan
                  </label>
                  <textarea
                    id="exp-notes"
                    rows={2}
                    placeholder="Keterangan keperluan pembayaran..."
                    value={expNotes}
                    onChange={(e) => setExpNotes(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: '1px solid var(--line)',
                      background: 'var(--input-bg)',
                      color: 'var(--ink)',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => setShowAddExpenseModal(false)}
                  disabled={expenseSubmitting}
                >
                  Batal
                </button>
                <button type="submit" className={styles.primaryButton} disabled={expenseSubmitting}>
                  {expenseSubmitting ? 'Menyimpan...' : 'Simpan ke Laporan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}
