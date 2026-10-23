'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, Clock3, LoaderCircle, LogOut, RefreshCw, ShieldCheck, UserRound, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getUserFacingError } from '@/lib/user-facing-error'
import styles from './registration-approvals.module.css'

interface Registration {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  created_at: string
}

export default function RegistrationApprovals() {
  const router = useRouter()
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [processingId, setProcessingId] = useState<string | null>(null)

  const loadRegistrations = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/super-admin/registrations', { cache: 'no-store' })
      const result: { registrations?: Registration[]; error?: string } = await response.json()
      if (!response.ok) throw new Error(result.error || 'Pendaftar belum dapat dimuat.')
      setRegistrations(result.registrations || [])
    } catch (loadError) {
      console.error('Unable to load approval queue.', loadError)
      setError(getUserFacingError(loadError, 'Daftar pendaftar belum dapat dimuat. Silakan coba lagi.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadInitialRegistrations() {
      try {
        const response = await fetch('/api/super-admin/registrations', { cache: 'no-store' })
        const result: { registrations?: Registration[]; error?: string } = await response.json()
        if (!response.ok) throw new Error(result.error || 'Pendaftar belum dapat dimuat.')
        if (!cancelled) setRegistrations(result.registrations || [])
      } catch (loadError) {
        console.error('Unable to load approval queue.', loadError)
        if (!cancelled) setError(getUserFacingError(loadError, 'Daftar pendaftar belum dapat dimuat. Silakan coba lagi.'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadInitialRegistrations()
    return () => { cancelled = true }
  }, [])

  async function processRegistration(registration: Registration, action: 'approve' | 'reject') {
    const confirmation = action === 'approve'
      ? `Setujui ${registration.full_name}? Trial 7 hari dimulai saat persetujuan.`
      : `Tolak pendaftaran ${registration.full_name}?`
    if (!window.confirm(confirmation)) return

    setProcessingId(registration.id)
    setError('')
    try {
      const response = await fetch('/api/super-admin/registrations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: registration.id, action }),
      })
      const result: { error?: string } = await response.json()
      if (!response.ok) throw new Error(result.error || 'Tindakan belum dapat diproses.')
      setRegistrations((current) => current.filter((item) => item.id !== registration.id))
    } catch (processError) {
      console.error('Unable to process registration.', processError)
      setError(getUserFacingError(processError, 'Persetujuan pendaftaran belum dapat diproses. Silakan coba lagi.'))
    } finally {
      setProcessingId(null)
    }
  }

  async function handleSignOut() {
    const { error: signOutError } = await createClient().auth.signOut()
    if (signOutError) {
      console.error('Unable to sign out Super Admin.', signOutError)
      setError('Gagal keluar. Silakan coba lagi.')
      return
    }
    router.replace('/login')
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}><span className={styles.brandIcon}><ShieldCheck size={18} /></span><span>Fluxa <small>Super Admin</small></span></div>
        <button className={styles.signOut} onClick={handleSignOut} type="button"><LogOut size={16} /> Keluar</button>
      </header>
      <section className={styles.content}>
        <div className={styles.heading}>
          <div><span className={styles.eyebrow}>MANAJEMEN AKUN</span><h1>Persetujuan pendaftaran</h1><p>Setujui akun bisnis baru. Masa trial 7 hari dimulai otomatis saat Anda menyetujui pendaftar.</p></div>
          <button className={styles.refresh} onClick={() => void loadRegistrations()} type="button" disabled={loading}><RefreshCw size={15} className={loading ? styles.spin : ''} /> Muat ulang</button>
        </div>
        <div className={styles.stats}><span className={styles.statsIcon}><Clock3 size={18} /></span><div><strong>{loading ? '—' : registrations.length}</strong><span>Pendaftaran menunggu persetujuan</span></div></div>
        {error && <p className={styles.error} role="alert">{error}</p>}
        {loading ? <div className={styles.empty}><LoaderCircle className={styles.spin} size={23} /> Memuat pendaftaran...</div>
          : registrations.length === 0 ? <div className={styles.empty}><Check size={22} /><strong>Semua sudah ditinjau</strong><span>Belum ada pendaftaran yang menunggu persetujuan.</span></div>
            : <div className={styles.list}>{registrations.map((registration) => <article className={styles.card} key={registration.id}>
              <div className={styles.personIcon}><UserRound size={19} /></div>
              <div className={styles.details}><h2>{registration.full_name}</h2><a href={`mailto:${registration.email || ''}`}>{registration.email || 'Email tidak tersedia'}</a><div className={styles.meta}>{registration.phone && <span>{registration.phone}</span>}<span>Daftar {new Date(registration.created_at).toLocaleDateString('id-ID', { dateStyle: 'medium' })}</span></div></div>
              <div className={styles.actions}>
                <button className={styles.reject} disabled={processingId !== null} onClick={() => void processRegistration(registration, 'reject')} type="button"><X size={16} /> Tolak</button>
                <button className={styles.approve} disabled={processingId !== null} onClick={() => void processRegistration(registration, 'approve')} type="button">{processingId === registration.id ? <LoaderCircle size={16} className={styles.spin} /> : <Check size={16} />} Setujui & mulai trial</button>
              </div>
            </article>)}</div>}
        <p className={styles.note}><ShieldCheck size={15} /> Akun belum memiliki akses operasional sampai disetujui. Persetujuan mengaktifkan role Owner dan memulai trial 7 hari.</p>
      </section>
    </main>
  )
}
