'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Download,
  RefreshCw,
  Shield,
} from 'lucide-react'
import { Empty, ErrorBox, humanize, Loading } from './SuperAdminOverview'
import styles from './super-admin-content.module.css'

type AuditEntry = {
  id: string
  action: string
  table_name: string
  record_id: string | null
  old_data: unknown
  new_data: unknown
  created_at: string
  actorName: string
  actorRole: string | null
}

type AuditResponse = { entries: AuditEntry[]; total: number; page: number; pageSize: number }
const dateTime = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' })

function summarize(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '—'
  const entries = Object.entries(value).slice(0, 4)
  return entries.map(([key, item]) => `${key}: ${String(item)}`).join(' · ') || '—'
}

export default function SuperAdminAuditLog() {
  const [category, setCategory] = useState<'activity' | 'finance'>('activity')
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [action, setAction] = useState('')
  const [actor, setActor] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const pageSize = 25

  const fetchEntries = useCallback(async () => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      category,
    })
    if (action) params.set('action', action)
    if (actor) params.set('actor', actor)
    if (start) params.set('start', start)
    if (end) params.set('end', end)
    const response = await fetch(`/api/super-admin/audit-log?${params}`, { cache: 'no-store' })
    const result = await response.json() as AuditResponse & { error?: string }
    if (!response.ok) throw new Error(result.error || 'Audit log belum dapat dimuat.')
    return result
  }, [category, page, action, actor, start, end])

  useEffect(() => {
    let cancelled = false
    async function loadEntries() {
      try {
        const result = await fetchEntries()
        if (cancelled) return
        setEntries(result.entries)
        setTotal(result.total)
        setError('')
      } catch (loadError) {
        console.error('Unable to load Super Admin audit log.', loadError)
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Audit log belum dapat dimuat.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void loadEntries()
    return () => { cancelled = true }
  }, [fetchEntries])

  const load = async () => {
    setLoading(true)
    try {
      const result = await fetchEntries()
      setEntries(result.entries)
      setTotal(result.total)
      setError('')
    } catch (loadError) {
      console.error('Unable to load Super Admin audit log.', loadError)
      setError(loadError instanceof Error ? loadError.message : 'Audit log belum dapat dimuat.')
    } finally {
      setLoading(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  async function exportCsv() {
    const params = new URLSearchParams({ format: 'csv', category })
    if (action) params.set('action', action)
    if (actor) params.set('actor', actor)
    if (start) params.set('start', start)
    if (end) params.set('end', end)
    try {
      const response = await fetch(`/api/super-admin/audit-log?${params}`, { cache: 'no-store' })
      if (!response.ok) {
        const result = await response.json() as { error?: string }
        throw new Error(result.error || 'Ekspor audit log gagal.')
      }
      const url = URL.createObjectURL(await response.blob())
      const link = document.createElement('a')
      link.href = url
      link.download = `audit-${category}-log.csv`
      link.click()
      URL.revokeObjectURL(url)
    } catch (exportError) {
      console.error('Unable to export Super Admin audit log.', exportError)
      setError(exportError instanceof Error ? exportError.message : 'Ekspor audit log gagal.')
    }
  }

  return (
    <section className={styles.page}>
      <div className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>AUDIT KEAMANAN & COMPLIANCE</span>
          <h1>Audit Log Platform</h1>
          <p>
            {category === 'activity'
              ? 'Mencatat aktivitas Owner dan Super Admin (FR-05). Aktivitas transaksi kasir tidak dimuat di sini.'
              : 'Mencatat pembuatan tagihan, konfirmasi notifikasi Midtrans, aktivasi paket, dan pencatatan withdraw (FR-06).'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className={styles.secondaryButton} type="button" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={14} className={loading ? styles.spin : ''} /> Muat ulang
          </button>
          <button className={styles.secondaryButton} type="button" onClick={() => void exportCsv()}>
            <Download size={14} /> Ekspor CSV
          </button>
        </div>
      </div>

      {/* Category Tabs (FR-05 & FR-06) */}
      <div style={{ display: 'flex', gap: '10px', borderBottom: '1px solid var(--line)', paddingBottom: '10px' }}>
        <button
          type="button"
          onClick={() => { setCategory('activity'); setPage(1); setLoading(true) }}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 700,
            background: category === 'activity' ? 'var(--role-acc, var(--acc))' : 'transparent',
            color: category === 'activity' ? 'white' : 'var(--mute)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <Shield size={14} /> Aktivitas Owner & Super Admin (FR-05)
        </button>
        <button
          type="button"
          onClick={() => { setCategory('finance'); setPage(1); setLoading(true) }}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 700,
            background: category === 'finance' ? 'var(--role-acc, var(--acc))' : 'transparent',
            color: category === 'finance' ? 'white' : 'var(--mute)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <CreditCard size={14} /> Audit Log Keuangan & Webhook (FR-06)
        </button>
      </div>

      <div className={styles.infoBox}>
        <strong>
          {category === 'activity'
            ? 'Spesialisasi Log Aktivitas Platform (FR-05)'
            : 'Jejak Audit Transaksi & Keuangan Platform (FR-06)'}
        </strong>
        <span>
          {category === 'activity'
            ? 'Sesuai spesifikasi FR-05, audit log umum ini secara ketat hanya menyajikan jejak aksi administratif dari Owner dan Super Admin (approval akun, edit profil, kelola staf/toko). Aktivitas kasir/admin operasional sehari-hari disimpan terpisah.'
            : 'Audit log keuangan merekam setiap perubahan siklus transaksi: pembuatan tagihan, penerimaan webhook Midtrans Sandbox, perubahan status pembayaran, perpanjangan subscription, dan pencatatan withdraw internal.'}
        </span>
      </div>

      <div className={styles.filters}>
        <input
          aria-label="Filter tindakan"
          placeholder="Tindakan (mis: USER_CREATED, PAYMENT)"
          value={action}
          onChange={(event) => { setAction(event.target.value); setPage(1); setLoading(true) }}
        />
        <input
          aria-label="Cari aktor"
          placeholder="Nama aktor / email"
          value={actor}
          onChange={(event) => { setActor(event.target.value); setPage(1); setLoading(true) }}
        />
        <label>Dari <input type="date" value={start} onChange={(event) => { setStart(event.target.value); setPage(1); setLoading(true) }} /></label>
        <label>Sampai <input type="date" value={end} onChange={(event) => { setEnd(event.target.value); setPage(1); setLoading(true) }} /></label>
      </div>

      {error && <ErrorBox message={error} retry={() => void load()} />}

      {loading ? <Loading /> : entries.length === 0 ? <Empty text="Belum ada aktivitas yang terekam pada kategori ini." /> : (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Waktu (WIB)</th>
                  <th>Aktor</th>
                  <th>Tindakan</th>
                  <th>Target Entitas</th>
                  <th>Perubahan Aman</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td>{dateTime.format(new Date(entry.created_at))}</td>
                    <td>
                      <strong>{entry.actorName}</strong>
                      <small>{entry.actorRole || 'System / Webhook'}</small>
                    </td>
                    <td>
                      <span className={styles.badge}>{humanize(entry.action)}</span>
                    </td>
                    <td>
                      <strong>{entry.table_name}</strong>
                      <small>{entry.record_id || '—'}</small>
                    </td>
                    <td>
                      <div className={styles.activityDetails}>
                        <div>Sebelum: {summarize(entry.old_data)}</div>
                        <div>Sesudah: {summarize(entry.new_data)}</div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.pager}>
            <span>Menampilkan {total ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, total)} dari {total} catatan</span>
            <div>
              <button
                className={styles.secondaryButton}
                disabled={page <= 1 || loading}
                onClick={() => { setLoading(true); setPage((current) => current - 1) }}
                type="button"
              >
                <ChevronLeft size={14} /> Sebelumnya
              </button>
              <button
                className={styles.secondaryButton}
                disabled={page >= totalPages || loading}
                onClick={() => { setLoading(true); setPage((current) => current + 1) }}
                type="button"
              >
                Berikutnya <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  )
}
