'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { Empty, ErrorBox, Loading } from './SuperAdminOverview'
import styles from './super-admin-content.module.css'

type TrialRow = {
  id: string
  full_name: string
  email: string | null
  approval_status: string
  trial_started_at: string | null
  trial_ends_at: string | null
}
type TrialResponse = { trials: TrialRow[]; total: number; page: number; pageSize: number; serverNow: string }
const dateFormat = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeZone: 'Asia/Jakarta' })

export default function SuperAdminTrials() {
  const [trials, setTrials] = useState<TrialRow[]>([])
  const [state, setState] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [serverNow, setServerNow] = useState(new Date().toISOString())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [processing, setProcessing] = useState<string | null>(null)

  const fetchTrials = useCallback(async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' })
      if (state) params.set('state', state)
      const response = await fetch(`/api/super-admin/trials?${params}`, { cache: 'no-store' })
      const result = await response.json() as TrialResponse & { error?: string }
      if (!response.ok) throw new Error(result.error || 'Daftar trial belum dapat dimuat.')
      return result
  }, [page, state])

  useEffect(() => {
    let cancelled = false
    async function loadTrials() {
      try {
        const result = await fetchTrials()
        if (cancelled) return
        setTrials(result.trials)
        setTotal(result.total)
        setServerNow(result.serverNow)
        setError('')
      } catch (loadError) {
        console.error('Unable to load Super Admin trials.', loadError)
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Daftar trial belum dapat dimuat.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void loadTrials()
    return () => { cancelled = true }
  }, [fetchTrials])

  const load = async () => {
    setLoading(true)
    try {
      const result = await fetchTrials()
      setTrials(result.trials)
      setTotal(result.total)
      setServerNow(result.serverNow)
      setError('')
    } catch (loadError) {
      console.error('Unable to load Super Admin trials.', loadError)
      setError(loadError instanceof Error ? loadError.message : 'Daftar trial belum dapat dimuat.')
    } finally {
      setLoading(false)
    }
  }

  async function updateTrial(trial: TrialRow, action: 'extend' | 'end') {
    const message = action === 'extend'
      ? `Perpanjang trial ${trial.full_name} selama 7 hari?`
      : `Akhiri trial ${trial.full_name} sekarang?`
    if (!window.confirm(message)) return
    setProcessing(trial.id)
    setError('')
    try {
      const response = await fetch('/api/super-admin/trials', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: trial.id, action }),
      })
      const result = await response.json() as { error?: string; auditRecorded?: boolean }
      if (!response.ok) throw new Error(result.error || 'Perubahan trial gagal.')
      setNotice(result.auditRecorded === false ? 'Trial berhasil diperbarui, tetapi belum tercatat di audit log.' : 'Masa trial berhasil diperbarui dan dicatat.')
      await load()
    } catch (updateError) {
      console.error('Unable to update trial.', updateError)
      setError(updateError instanceof Error ? updateError.message : 'Perubahan trial gagal.')
    } finally {
      setProcessing(null)
    }
  }

  const now = new Date(serverNow).getTime()
  const soon = now + 3 * 24 * 60 * 60 * 1000
  const totalPages = Math.max(1, Math.ceil(total / 20))

  return (
    <section className={styles.page}>
      <div className={styles.heading}><div><span className={styles.eyebrow}>AKSES UJI COBA</span><h1>Trial & Langganan</h1><p>Trial awal tetap tujuh hari sejak persetujuan. Perpanjangan dilakukan bertahap tujuh hari dan tercatat di audit log.</p></div><button className={styles.secondaryButton} type="button" onClick={() => void load()} disabled={loading}><RefreshCw size={14} /> Muat ulang</button></div>
      <div className={styles.filters}>
        <select aria-label="Filter status trial" value={state} onChange={(event) => { setState(event.target.value); setPage(1); setLoading(true) }}>
          <option value="">Semua akun Owner</option><option value="active">Aktif lebih dari 3 hari</option><option value="expiring">Segera berakhir (≤ 3 hari)</option><option value="expired">Kedaluwarsa</option><option value="not-started">Belum dimulai</option>
        </select>
      </div>
      {notice && <p className={styles.infoBox} role="status">{notice}</p>}
      {error && <ErrorBox message={error} retry={() => void load()} />}
      {loading ? <Loading /> : trials.length === 0 ? <Empty text="Tidak ada trial pada status ini." /> : (
        <>
          <div className={styles.tableWrap}><table className={styles.table}>
            <thead><tr><th>Pemilik akun</th><th>Mulai trial</th><th>Berakhir</th><th>Status trial</th><th>Sisa hari</th><th>Aksi</th></tr></thead>
            <tbody>{trials.map((trial) => {
              const end = trial.trial_ends_at ? new Date(trial.trial_ends_at).getTime() : null
              const start = trial.trial_started_at ? new Date(trial.trial_started_at).getTime() : null
              const trialStatus = start === null || end === null ? 'Belum dimulai' : end <= now ? 'Kedaluwarsa' : end <= soon ? 'Segera berakhir' : 'Aktif'
              const statusClass = trialStatus === 'Aktif' ? 'status_active' : trialStatus === 'Segera berakhir' ? 'status_expiring' : trialStatus === 'Kedaluwarsa' ? 'status_expired' : ''
              const daysLeft = end === null ? null : Math.max(0, Math.ceil((end - now) / (24 * 60 * 60 * 1000)))
              return <tr key={trial.id}>
                <td><strong>{trial.full_name}</strong><small>{trial.email || 'Email tidak tersedia'}</small></td>
                <td>{trial.trial_started_at ? dateFormat.format(new Date(trial.trial_started_at)) : '—'}</td>
                <td>{trial.trial_ends_at ? dateFormat.format(new Date(trial.trial_ends_at)) : '—'}</td>
                <td><span className={`${styles.badge} ${statusClass ? styles[statusClass] : ''}`}>{trialStatus}</span></td>
                <td>{daysLeft === null ? '—' : daysLeft === 0 && end && end > now ? '< 1 hari' : `${daysLeft} hari`}</td>
                <td><div className={styles.filters}><button className={styles.primaryButton} type="button" disabled={processing === trial.id} onClick={() => void updateTrial(trial, 'extend')}>{processing === trial.id ? 'Menyimpan...' : 'Tambah 7 hari'}</button>{trialStatus !== 'Kedaluwarsa' && trialStatus !== 'Belum dimulai' && <button className={styles.dangerButton} type="button" disabled={processing === trial.id} onClick={() => void updateTrial(trial, 'end')}>Akhiri trial</button>}</div></td>
              </tr>
            })}</tbody>
          </table></div>
          <div className={styles.pager}><span>{total} akun Owner · waktu evaluasi server {dateFormat.format(new Date(serverNow))}</span><div><button className={styles.secondaryButton} disabled={page <= 1 || loading} onClick={() => { setLoading(true); setPage((current) => current - 1) }} type="button"><ChevronLeft size={14} /> Sebelumnya</button><button className={styles.secondaryButton} disabled={page >= totalPages || loading} onClick={() => { setLoading(true); setPage((current) => current + 1) }} type="button">Berikutnya <ChevronRight size={14} /></button></div></div>
        </>
      )}
    </section>
  )
}
