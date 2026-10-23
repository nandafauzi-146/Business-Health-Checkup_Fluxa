'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock3,
  CreditCard,
  Filter,
  LoaderCircle,
  LogOut,
  RefreshCw,
  Rocket,
  ShieldCheck,
  Sparkles,
  UserRound,
  X,
  XCircle,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getUserFacingError } from '@/lib/user-facing-error'
import styles from './registration-approvals.module.css'

interface PaymentInfo {
  status: string
  plan_name: string
  amount: number
  paid_at: string | null
  created_at: string
}

interface Registration {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  created_at: string
  registration_path: 'subscribe' | 'trial'
  approval_status: 'pending' | 'approved' | 'rejected'
  approved_at: string | null
  reviewed_at: string | null
  rejection_reason: string | null
  trial_started_at: string | null
  trial_ends_at: string | null
  latest_payment: PaymentInfo | null
}

const formatMoney = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(iso))

const paymentStatusLabels: Record<string, { label: string; color: string }> = {
  success: { label: 'Lunas / Berhasil', color: 'var(--ok)' },
  pending: { label: 'Menunggu Pembayaran', color: 'var(--warn)' },
  failed: { label: 'Gagal', color: 'var(--bad)' },
  expired: { label: 'Kedaluwarsa', color: 'var(--mute)' },
  cancelled: { label: 'Dibatalkan', color: 'var(--mute)' },
}

export default function RegistrationApprovals() {
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [processingId, setProcessingId] = useState<string | null>(null)

  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [pathFilter, setPathFilter] = useState<'all' | 'subscribe' | 'trial'>('all')

  // Rejection modal state
  const [rejectingItem, setRejectingItem] = useState<Registration | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')

  const loadRegistrations = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (pathFilter !== 'all') params.set('path', pathFilter)

      const response = await fetch(`/api/super-admin/registrations?${params.toString()}`, {
        cache: 'no-store',
      })
      const result: { registrations?: Registration[]; error?: string } = await response.json()
      if (!response.ok) throw new Error(result.error || 'Pendaftar belum dapat dimuat.')
      setRegistrations(result.registrations || [])
    } catch (loadError) {
      console.error('Unable to load approval queue.', loadError)
      setError(getUserFacingError(loadError, 'Daftar pendaftar belum dapat dimuat. Silakan coba lagi.'))
    } finally {
      setLoading(false)
    }
  }, [statusFilter, pathFilter])

  useEffect(() => {
    let cancelled = false
    async function fetchQueue() {
      try {
        const params = new URLSearchParams()
        if (statusFilter !== 'all') params.set('status', statusFilter)
        if (pathFilter !== 'all') params.set('path', pathFilter)

        const response = await fetch(`/api/super-admin/registrations?${params.toString()}`, {
          cache: 'no-store',
        })
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

    void fetchQueue()
    return () => {
      cancelled = true
    }
  }, [statusFilter, pathFilter])

  async function handleApprove(registration: Registration) {
    if (!window.confirm(`Setujui pendaftaran ${registration.full_name}? Trial 7 hari akan diaktifkan.`)) {
      return
    }

    setProcessingId(registration.id)
    setError('')
    setNotice('')
    try {
      const response = await fetch('/api/super-admin/registrations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: registration.id, action: 'approve' }),
      })
      const result: { error?: string; auditRecorded?: boolean } = await response.json()
      if (!response.ok) throw new Error(result.error || 'Tindakan belum dapat diproses.')

      setNotice(`Pendaftaran ${registration.full_name} berhasil disetujui.`)
      await loadRegistrations()
    } catch (processError) {
      console.error('Unable to approve registration.', processError)
      setError(getUserFacingError(processError, 'Persetujuan pendaftaran belum dapat diproses. Silakan coba lagi.'))
    } finally {
      setProcessingId(null)
    }
  }

  function openRejectModal(registration: Registration) {
    setRejectingItem(registration)
    setRejectionReason('')
  }

  async function submitReject() {
    if (!rejectingItem) return
    setProcessingId(rejectingItem.id)
    setError('')
    setNotice('')
    try {
      const response = await fetch('/api/super-admin/registrations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: rejectingItem.id,
          action: 'reject',
          rejection_reason: rejectionReason.trim() || 'Pendaftaran tidak memenuhi kriteria verifikasi.',
        }),
      })
      const result: { error?: string; auditRecorded?: boolean } = await response.json()
      if (!response.ok) throw new Error(result.error || 'Tindakan penolakan gagal.')

      setNotice(`Pendaftaran ${rejectingItem.full_name} telah ditolak.`)
      setRejectingItem(null)
      await loadRegistrations()
    } catch (processError) {
      console.error('Unable to reject registration.', processError)
      setError(processError instanceof Error ? processError.message : 'Gagal memproses penolakan.')
    } finally {
      setProcessingId(null)
    }
  }

  // Calculate statistics from current dataset
  const pendingCount = registrations.filter((r) => r.approval_status === 'pending').length
  const subscribeCount = registrations.filter((r) => r.registration_path === 'subscribe').length
  const approvedCount = registrations.filter((r) => r.approval_status === 'approved').length

  return (
    <main className={styles.page}>
      <section className={styles.content}>
        <div className={styles.heading}>
          <div>
            <span className={styles.eyebrow}>MANAJEMEN PENDAFTARAN</span>
            <h1>Persetujuan & Jalur Pendaftaran</h1>
            <p>
              Kelola pendaftar baru dari jalur <strong>Langganan Langsung</strong> (auto-approved via pembayaran) dan <strong>Free Trial 7 Hari</strong> (verifikasi manual).
            </p>
          </div>
          <button
            className={styles.refresh}
            onClick={() => void loadRegistrations()}
            type="button"
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? styles.spin : ''} /> Muat ulang
          </button>
        </div>

        {/* Stats summary cards */}
        <div className={styles.statsRow}>
          <div className={styles.statsCard}>
            <span className={styles.statsIconPending}>
              <Clock3 size={18} />
            </span>
            <div>
              <strong>{loading ? '—' : pendingCount}</strong>
              <span>Menunggu Peninjauan</span>
            </div>
          </div>
          <div className={styles.statsCard}>
            <span className={styles.statsIconSubscribe}>
              <Rocket size={18} />
            </span>
            <div>
              <strong>{loading ? '—' : subscribeCount}</strong>
              <span>Jalur Langganan Langsung</span>
            </div>
          </div>
          <div className={styles.statsCard}>
            <span className={styles.statsIconApproved}>
              <CheckCircle2 size={18} />
            </span>
            <div>
              <strong>{loading ? '—' : approvedCount}</strong>
              <span>Total Disetujui / Aktif</span>
            </div>
          </div>
        </div>

        {/* Filter bar */}
        <div className={styles.filterBar}>
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>Status:</span>
            <button
              type="button"
              className={`${styles.filterBtn} ${statusFilter === 'all' ? styles.filterBtnActive : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              Semua
            </button>
            <button
              type="button"
              className={`${styles.filterBtn} ${statusFilter === 'pending' ? styles.filterBtnActive : ''}`}
              onClick={() => setStatusFilter('pending')}
            >
              Menunggu ({pendingCount})
            </button>
            <button
              type="button"
              className={`${styles.filterBtn} ${statusFilter === 'approved' ? styles.filterBtnActive : ''}`}
              onClick={() => setStatusFilter('approved')}
            >
              Disetujui
            </button>
            <button
              type="button"
              className={`${styles.filterBtn} ${statusFilter === 'rejected' ? styles.filterBtnActive : ''}`}
              onClick={() => setStatusFilter('rejected')}
            >
              Ditolak
            </button>
          </div>

          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>Jalur:</span>
            <button
              type="button"
              className={`${styles.filterBtn} ${pathFilter === 'all' ? styles.filterBtnActive : ''}`}
              onClick={() => setPathFilter('all')}
            >
              Semua Jalur
            </button>
            <button
              type="button"
              className={`${styles.filterBtn} ${pathFilter === 'subscribe' ? styles.filterBtnActive : ''}`}
              onClick={() => setPathFilter('subscribe')}
            >
              🚀 Langganan Langsung
            </button>
            <button
              type="button"
              className={`${styles.filterBtn} ${pathFilter === 'trial' ? styles.filterBtnActive : ''}`}
              onClick={() => setPathFilter('trial')}
            >
              🆓 Free Trial
            </button>
          </div>
        </div>

        {notice && <p className={styles.success} role="status">{notice}</p>}
        {error && <p className={styles.error} role="alert">{error}</p>}

        {loading ? (
          <div className={styles.empty}>
            <LoaderCircle className={styles.spin} size={23} /> Memuat data pendaftaran...
          </div>
        ) : registrations.length === 0 ? (
          <div className={styles.empty}>
            <Check size={22} />
            <strong>Tidak ada data pendaftaran</strong>
            <span>Tidak ada pendaftar yang sesuai dengan filter yang dipilih.</span>
          </div>
        ) : (
          <div className={styles.list}>
            {registrations.map((item) => {
              const isDirectSubscribe = item.registration_path === 'subscribe'
              const isPaid = item.approval_status === 'approved' && isDirectSubscribe
              const payment = item.latest_payment
              const paymentStatusInfo = payment
                ? paymentStatusLabels[payment.status] || { label: payment.status, color: 'var(--mute)' }
                : null

              return (
                <article className={styles.card} key={item.id}>
                  <div className={styles.personIcon}>
                    <UserRound size={19} />
                  </div>

                  <div className={styles.details}>
                    <div className={styles.detailsHeader}>
                      <h2>{item.full_name}</h2>

                      {/* Registration path badge */}
                      {isDirectSubscribe ? (
                        <span className={`${styles.badge} ${styles.badgeSubscribe}`}>
                          <Rocket size={11} /> Langganan Langsung
                        </span>
                      ) : (
                        <span className={`${styles.badge} ${styles.badgeTrial}`}>
                          <Sparkles size={11} /> Free Trial (7 Hari)
                        </span>
                      )}

                      {/* Status badge */}
                      {item.approval_status === 'approved' ? (
                        <span className={`${styles.badge} ${styles.badgeApproved}`}>
                          <CheckCircle2 size={11} />
                          {isDirectSubscribe ? 'Auto-Approved (Lunas)' : 'Disetujui Super Admin'}
                        </span>
                      ) : item.approval_status === 'rejected' ? (
                        <span className={`${styles.badge} ${styles.badgeRejected}`}>
                          <XCircle size={11} /> Ditolak
                        </span>
                      ) : (
                        <span className={`${styles.badge} ${styles.badgePending}`}>
                          <Clock3 size={11} /> Menunggu Peninjauan
                        </span>
                      )}
                    </div>

                    <a href={`mailto:${item.email || ''}`}>{item.email || 'Email tidak tersedia'}</a>

                    {/* Meta contacts and dates */}
                    <div className={styles.meta}>
                      {item.phone && <span>📞 {item.phone}</span>}
                      <span>📅 Mendaftar: {formatDate(item.created_at)}</span>
                      {item.trial_ends_at && (
                        <span>⏳ Trial Berakhir: {formatDate(item.trial_ends_at)}</span>
                      )}
                    </div>

                    {/* Subscription & Payment details for direct subscribers */}
                    {isDirectSubscribe && (
                      <div className={styles.paymentBox}>
                        <CreditCard size={14} />
                        {payment ? (
                          <>
                            <span>Paket: <strong>{payment.plan_name}</strong></span>
                            <span>Nominal: <strong>{formatMoney.format(payment.amount)}</strong></span>
                            <span>
                              Status Pembayaran:{' '}
                              <strong style={{ color: paymentStatusInfo?.color }}>
                                {paymentStatusInfo?.label}
                              </strong>
                            </span>
                            {payment.paid_at && (
                              <span>Waktu Bayar: {formatDate(payment.paid_at)}</span>
                            )}
                          </>
                        ) : (
                          <span>Belum ada transaksi pembayaran yang tercatat di Midtrans.</span>
                        )}
                      </div>
                    )}

                    {/* Rejection reason box if rejected */}
                    {item.approval_status === 'rejected' && item.rejection_reason && (
                      <div className={styles.rejectionBox}>
                        <strong>Alasan Penolakan:</strong> {item.rejection_reason}
                      </div>
                    )}
                  </div>

                  {/* Actions column */}
                  <div className={styles.actions}>
                    {isPaid ? (
                      <span className={styles.autoApprovedBadge}>
                        <Check size={14} /> Otomatis Aktif
                      </span>
                    ) : item.approval_status === 'pending' ? (
                      <>
                        <button
                          className={styles.reject}
                          disabled={processingId !== null}
                          onClick={() => openRejectModal(item)}
                          type="button"
                        >
                          <X size={15} /> Tolak
                        </button>
                        <button
                          className={styles.approve}
                          disabled={processingId !== null}
                          onClick={() => void handleApprove(item)}
                          type="button"
                        >
                          {processingId === item.id ? (
                            <LoaderCircle size={15} className={styles.spin} />
                          ) : (
                            <Check size={15} />
                          )}
                          Setujui & Beri Akses
                        </button>
                      </>
                    ) : (
                      <span style={{ fontSize: '11px', color: 'var(--mute)' }}>
                        Sudah ditinjau
                      </span>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}

        <p className={styles.note}>
          <ShieldCheck size={15} /> Pengguna yang memilih <strong>Langganan Langsung</strong> akan diaktifkan secara otomatis setelah pembayaran terverifikasi oleh webhook Midtrans tanpa perlu persetujuan manual. Pengajuan <strong>Free Trial</strong> memerlukan verifikasi Super Admin.
        </p>
      </section>

      {/* Modal for inputting rejection reason */}
      {rejectingItem && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalCard} role="dialog" aria-modal="true">
            <h3>Tolak Pendaftaran</h3>
            <p>
              Berikan alasan penolakan untuk pendaftar <strong>{rejectingItem.full_name}</strong> ({rejectingItem.email}). Alasan ini akan ditampilkan ke pengguna jika mereka mencoba masuk.
            </p>
            <textarea
              className={styles.modalTextarea}
              placeholder="Contoh: Nomor kontak tidak dapat dihubungi atau profil usaha belum lengkap."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              disabled={processingId !== null}
            />
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.modalCancel}
                onClick={() => setRejectingItem(null)}
                disabled={processingId !== null}
              >
                Batal
              </button>
              <button
                type="button"
                className={styles.modalSubmit}
                onClick={() => void submitReject()}
                disabled={processingId !== null}
              >
                {processingId !== null ? 'Memproses...' : 'Konfirmasi Tolak'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
