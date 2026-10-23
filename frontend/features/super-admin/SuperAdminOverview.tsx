'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Activity,
  ArrowDownToLine,
  Building2,
  CheckCircle2,
  Clock3,
  CreditCard,
  DollarSign,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Users,
  XCircle,
} from 'lucide-react'
import styles from './super-admin-content.module.css'

type ActivityRow = {
  id: string
  action: string
  table_name: string
  created_at: string
  actorName: string
  actorRole: string | null
}

type Overview = {
  stats: {
    totalUsers: number
    totalBusinesses: number
    pending: number
    approved: number
    rejected: number
    activeTrials: number
    expiringTrials: number
    expiredTrials: number
    activeSubscriptions: number
    expiredSubscriptions: number
  }
  finance: {
    grossRevenue: number
    successCount: number
    pendingCount: number
    pendingAmount: number
    failedCount: number
    totalWithdrawn: number
    pendingWithdrawalsCount: number
  }
  growth: { month: string; total: number }[]
  revenueTrend: { month: string; revenue: number }[]
  activity: ActivityRow[]
  businessManagementAvailable: boolean
}

const number = new Intl.NumberFormat('id-ID')
const money = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })
const monthName = new Intl.DateTimeFormat('id-ID', { month: 'short', year: '2-digit', timeZone: 'UTC' })
const dateTime = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' })

async function loadOverview() {
  const response = await fetch('/api/super-admin/overview', { cache: 'no-store' })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Ringkasan belum dapat dimuat.')
  return result as Overview
}

export default function SuperAdminOverview() {
  const [data, setData] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchData = useCallback(async () => {
    try {
      const result = await loadOverview()
      setData(result)
      setError('')
    } catch (loadError) {
      console.error('Unable to fetch Super Admin overview.', loadError)
      setError(loadError instanceof Error ? loadError.message : 'Ringkasan belum dapat dimuat.')
    } finally {
      setLoading(false)
    }
  }, [])

  const refresh = () => {
    setLoading(true)
    void fetchData()
  }

  useEffect(() => {
    let cancelled = false
    loadOverview()
      .then((result) => {
        if (!cancelled) {
          setData(result)
          setError('')
        }
      })
      .catch((loadError: unknown) => {
        console.error('Unable to fetch Super Admin overview.', loadError)
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Ringkasan belum dapat dimuat.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const stats = data?.stats
  const finance = data?.finance
  const maximumRevenue = Math.max(1, ...(data?.revenueTrend.map((item) => item.revenue) ?? []))

  return (
    <section className={styles.page}>
      <div className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>OVERVIEW PLATFORM FLUXA</span>
          <h1>Dashboard Super Admin</h1>
          <p>Pantau pertumbuhan akun, status subscription, pendapatan platform, dan aktivitas sistem.</p>
        </div>
        <button className={styles.secondaryButton} type="button" onClick={refresh} disabled={loading}>
          <RefreshCw size={15} className={loading ? styles.spin : ''} /> Muat ulang
        </button>
      </div>

      {error && <ErrorBox message={error} retry={refresh} />}

      {/* 1. Akun & Usaha Terdaftar (FR-01) */}
      <div className={styles.statsGrid}>
        <Stat icon={<Users size={18} />} label="Total pengguna" value={number.format(stats?.totalUsers ?? 0)} loading={loading} />
        <Stat icon={<Building2 size={18} />} label="Total usaha terdaftar" value={number.format(stats?.totalBusinesses ?? 0)} tone="success" loading={loading} />
        <Stat icon={<Clock3 size={18} />} label="Menunggu persetujuan" value={number.format(stats?.pending ?? 0)} tone="warning" loading={loading} />
        <Stat icon={<ShieldCheck size={18} />} label="Akun disetujui" value={number.format(stats?.approved ?? 0)} tone="success" loading={loading} />
      </div>

      {/* 2. Subscription & Trial (FR-01) */}
      <div className={styles.statsGrid}>
        <Stat icon={<CreditCard size={18} />} label="Subscription aktif" value={number.format(stats?.activeSubscriptions ?? 0)} tone="success" loading={loading} />
        <Stat icon={<Activity size={18} />} label="Usaha dalam trial" value={number.format(stats?.activeTrials ?? 0)} tone="warning" loading={loading} />
        <Stat icon={<Clock3 size={18} />} label="Trial ≤ 3 hari" value={number.format(stats?.expiringTrials ?? 0)} tone="warning" loading={loading} />
        <Stat icon={<XCircle size={18} />} label="Subscription / Trial kedaluwarsa" value={number.format((stats?.expiredTrials ?? 0) + (stats?.expiredSubscriptions ?? 0))} tone="danger" loading={loading} />
      </div>

      {/* 3. Keuangan Platform (FR-01 & FR-03 & FR-04) */}
      <div className={styles.statsGrid}>
        <Stat icon={<DollarSign size={18} />} label="Pendapatan subscription" value={loading ? '—' : money.format(finance?.grossRevenue ?? 0)} tone="success" loading={loading} />
        <Stat icon={<CheckCircle2 size={18} />} label="Pembayaran berhasil" value={number.format(finance?.successCount ?? 0)} tone="success" loading={loading} />
        <Stat icon={<Clock3 size={18} />} label="Transaksi pending" value={`${number.format(finance?.pendingCount ?? 0)} trx`} tone="warning" loading={loading} />
        <Stat icon={<ArrowDownToLine size={18} />} label="Total withdraw internal" value={loading ? '—' : money.format(finance?.totalWithdrawn ?? 0)} tone="default" loading={loading} />
      </div>

      <div className={styles.dashboardGrid}>
        {/* Chart Tren Pendapatan Subscription */}
        <section className={styles.panel}>
          <div className={styles.panelHeading}>
            <div>
              <h2>Tren Pendapatan Platform</h2>
              <p>Pendapatan subscription per bulan (6 bulan terakhir)</p>
            </div>
            <TrendingUp size={16} className={styles.statIcon} />
          </div>
          {loading ? <Loading /> : data?.revenueTrend.length ? (
            <div className={styles.chart} role="img" aria-label="Grafik pendapatan subscription per bulan">
              {data.revenueTrend.map((item) => {
                const date = new Date(`${item.month}-01T00:00:00Z`)
                return (
                  <div className={styles.chartColumn} key={item.month}>
                    <span style={{ fontSize: '9px' }}>{item.revenue > 0 ? `${(item.revenue / 1000).toFixed(0)}k` : '0'}</span>
                    <div className={styles.chartTrack}>
                      <div
                        className={styles.chartBar}
                        style={{ height: `${Math.max(item.revenue ? 8 : 2, (item.revenue / maximumRevenue) * 100)}%` }}
                      />
                    </div>
                    <small>{monthName.format(date)}</small>
                  </div>
                )
              })}
            </div>
          ) : <Empty text="Belum ada data pendapatan." />}
        </section>

        {/* Aktivitas Terbaru (Khusus Owner & Super Admin as per FR-05) */}
        <section className={styles.panel}>
          <div className={styles.panelHeading}>
            <div>
              <h2>Aktivitas Terbaru</h2>
              <p>Log aktivitas Owner & Super Admin (FR-05)</p>
            </div>
            <Activity size={16} className={styles.statIcon} />
          </div>
          {loading ? <Loading /> : data?.activity.length ? (
            <div className={styles.activityList}>
              {data.activity.map((item) => (
                <article className={styles.activityItem} key={item.id}>
                  <span className={styles.activityMark}><Activity size={14} /></span>
                  <div>
                    <strong>{humanize(item.action)}</strong>
                    <p>{item.actorName}{item.actorRole ? ` · ${item.actorRole}` : ''} · {item.table_name}</p>
                    <time>{dateTime.format(new Date(item.created_at))}</time>
                  </div>
                </article>
              ))}
            </div>
          ) : <Empty text="Belum ada aktivitas yang tercatat." />}
        </section>
      </div>
    </section>
  )
}

function Stat({ icon, label, value, loading, tone = 'default' }: { icon: React.ReactNode; label: string; value?: string; loading: boolean; tone?: string }) {
  return (
    <article className={`${styles.statCard} ${styles[`tone_${tone}`]}`}>
      <span className={styles.statIcon}>{icon}</span>
      <div>
        <strong>{loading ? '—' : (value ?? '0')}</strong>
        <span>{label}</span>
      </div>
    </article>
  )
}

export function ErrorBox({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className={styles.errorBox} role="alert">
      <span>{message}</span>
      <button className={styles.secondaryButton} type="button" onClick={retry}>Coba lagi</button>
    </div>
  )
}

export function Loading() {
  return (
    <div className={styles.loading} role="status" aria-label="Memuat data">
      <span /><span /><span /><span />
    </div>
  )
}

export function Empty({ text }: { text: string }) {
  return <div className={styles.empty}>{text}</div>
}

export function humanize(value: string) {
  return value.replaceAll('_', ' ').toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase())
}
