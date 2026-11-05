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
import { Empty, ErrorBox, Loading } from './SuperAdminOverview'
import { auditActionLabel, auditTableLabel, summarizeAuditData } from '@/lib/audit-log-format'
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
          <span className={styles.eyebrow}>RIWAYAT AKTIVITAS</span>
          <h1>Aktivitas Platform</h1>
          <p>
            {category === 'activity'
              ? 'Riwayat perubahan akun dan pengelolaan usaha oleh Owner dan Super Admin.'
              : 'Riwayat tagihan, pembayaran langganan, dan penarikan dana platform.'}
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

      {/* Kategori aktivitas */}
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
          <Shield size={14} /> Aktivitas akun & usaha
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
          <CreditCard size={14} /> Pembayaran & langganan
        </button>
      </div>

      <div className={styles.infoBox}>
        <strong>
          {category === 'activity'
            ? 'Aktivitas akun dan usaha'
            : 'Aktivitas pembayaran dan langganan'}
        </strong>
        <span>
          {category === 'activity'
            ? 'Menampilkan perubahan data akun, persetujuan pendaftaran, dan pengelolaan usaha. Aktivitas transaksi harian ditampilkan pada halaman riwayat usaha.'
            : 'Menampilkan pembuatan tagihan, pembaruan status pembayaran, perubahan langganan, dan penarikan dana.'}
        </span>
      </div>

      <div className={styles.filters}>
        <input
          aria-label="Filter tindakan"
          placeholder="Cari jenis aktivitas"
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
                  <th>Tanggal & waktu</th>
                  <th>Dilakukan oleh</th>
                  <th>Aktivitas</th>
                  <th>Bagian terkait</th>
                  <th>Ringkasan perubahan</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td>{dateTime.format(new Date(entry.created_at))}</td>
                    <td>
                      <strong>{entry.actorName}</strong>
                      <small>{entry.actorRole === 'owner' ? 'Pemilik usaha' : entry.actorRole === 'super_admin' ? 'Super Admin' : 'Sistem otomatis'}</small>
                    </td>
                    <td>
                      <span className={styles.badge}>{auditActionLabel(entry.action)}</span>
                    </td>
                    <td>
                      <strong>{auditTableLabel(entry.table_name)}</strong>
                    </td>
                    <td>
                      <div className={styles.activityDetails}>
                        {summarizeAuditData(entry.old_data).length > 0 && (
                          <div>Sebelum: {summarizeAuditData(entry.old_data).join(' · ')}</div>
                        )}
                        {summarizeAuditData(entry.new_data).length > 0 && (
                          <div>Sesudah: {summarizeAuditData(entry.new_data).join(' · ')}</div>
                        )}
                        {summarizeAuditData(entry.old_data).length === 0 && summarizeAuditData(entry.new_data).length === 0 && (
                          <div>Tidak ada rincian perubahan tambahan.</div>
                        )}
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
