'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  Info,
  Loader2,
  LogIn,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  X,
  XCircle,
} from 'lucide-react'
import styles from './subscription.module.css'

declare global {
  interface Window {
    snap?: {
      pay: (
        token: string,
        callbacks?: {
          onSuccess?: (result: unknown) => void
          onPending?: (result: unknown) => void
          onError?: (result: unknown) => void
          onClose?: () => void
        }
      ) => void
    }
  }
}

type Plan = {
  id: string
  name: string
  description: string
  price: number
  duration_days: number
  max_users: number
  features: string[]
}

type Payment = {
  id: string
  order_id: string
  plan_name: string
  plan_id?: string
  amount: number
  status: string
  snap_token?: string | null
  snap_url?: string | null
  created_at: string
  paid_at: string | null
  expires_at: string | null
}

type SubscriptionData = {
  plans: Plan[]
  subscription: null | {
    status: string
    current_period_start: string
    current_period_end: string
    cancel_at_period_end: boolean
    plan: { name: string } | null
  }
  payments: Payment[]
  trialEndsAt: string | null
  approvalStatus?: string
  registrationPath?: string | null
  userProfile?: {
    fullName: string
    email: string
    phone: string
  }
  midtransConfig?: {
    clientKey: string
    snapScriptUrl: string
    isProduction: boolean
  }
}

type ChargeResult = {
  orderId?: string
  paymentMethod?: string
  qrCodeUrl?: string
  vaNumber?: string
  vaBank?: string
  expiryTime?: string
  expiresAt?: string
  error?: string
}

type SelectedMethod = 'qris' | 'bca' | 'bni' | 'bri' | 'permata' | null

const money = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })
const dateFormatter = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Jakarta',
})

const paymentStatusLabels: Record<string, { label: string; class: string }> = {
  pending: { label: 'Menunggu Pembayaran', class: styles.badgePending },
  success: { label: 'Berhasil (Aktif)', class: styles.badgeSuccess },
  failed: { label: 'Gagal', class: styles.badgeFailed },
  expired: { label: 'Kedaluwarsa', class: styles.badgeFailed },
  cancelled: { label: 'Dibatalkan', class: styles.badgeDefault },
  refunded: { label: 'Direfund', class: styles.badgeDefault },
}

const BANK_LABELS: Record<string, string> = { bca: 'BCA', bni: 'BNI', bri: 'BRI', permata: 'Permata' }

const SANDBOX_PAYMENT_LINKS: Record<string, string> = {
  starter: 'https://app.sandbox.midtrans.com/payment-links/587def17-deca-4724-8018-195dd99cb5cd-OfToVzKz',
  growth: 'https://app.sandbox.midtrans.com/payment-links/517b248c-d6ed-4005-bca8-56d9f5d5a03f-0Rmed3dB',
  'pro business': 'https://app.sandbox.midtrans.com/payment-links/d54d39a5-5a8e-4310-b8b3-7b629ccf6e67-qSjFrISu',
}

function useCountdown(expiresAt: string | null) {
  const [timeLeft, setTimeLeft] = useState<{
    hours: number
    minutes: number
    seconds: number
    isExpired: boolean
  }>({
    hours: 24,
    minutes: 0,
    seconds: 0,
    isExpired: false,
  })

  useEffect(() => {
    if (!expiresAt) return

    const updateTimer = () => {
      const target = new Date(expiresAt).getTime()
      const now = Date.now()
      const diffMs = target - now

      if (diffMs <= 0) {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0, isExpired: true })
        return
      }

      const totalSeconds = Math.floor(diffMs / 1000)
      setTimeLeft({
        hours: Math.floor(totalSeconds / 3600),
        minutes: Math.floor((totalSeconds % 3600) / 60),
        seconds: totalSeconds % 60,
        isExpired: false,
      })
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [expiresAt])

  return timeLeft
}

export default function SubscriptionPage() {
  const router = useRouter()
  const [data, setData] = useState<SubscriptionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [isOnboarding, setIsOnboarding] = useState(false)
  const [copiedText, setCopiedText] = useState('')

  // Modals state
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedPlanForCheckout, setSelectedPlanForCheckout] = useState<Plan | null>(null)
  const [initiatingCheckout, setInitiatingCheckout] = useState(false)

  // Customer Contact Details for Midtrans (Nama, Email, No HP)
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')

  // Core API charge state
  const [selectedMethod, setSelectedMethod] = useState<SelectedMethod>(null)
  const [chargeResult, setChargeResult] = useState<ChargeResult | null>(null)
  const [chargingMethod, setChargingMethod] = useState(false)

  // Status refresh loading state
  const [checkingStatus, setCheckingStatus] = useState(false)

  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pollingCountRef = useRef(0)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      setIsOnboarding(params.get('onboard') === '1')
    }
  }, [])

  const load = useCallback(async () => {
    const response = await fetch('/api/subscription', { cache: 'no-store' })
    const result = await response.json() as SubscriptionData & { error?: string }
    if (!response.ok) throw new Error(result.error || 'Informasi subscription belum dapat dimuat.')
    setData(result)
    if (result.userProfile) {
      if (result.userProfile.fullName) setCustomerName(result.userProfile.fullName)
      if (result.userProfile.email) setCustomerEmail(result.userProfile.email)
      if (result.userProfile.phone) setCustomerPhone(result.userProfile.phone)
    }
    setError('')
    return result
  }, [])

  useEffect(() => {
    let cancelled = false
    async function fetchData() {
      try {
        const res = await load()
        const pending = res.payments.find((p) => p.status === 'pending')
        if (pending && !cancelled) {
          setShowPaymentModal(true)
        } else if (res.plans.length > 0 && !cancelled) {
          const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
          const targetPlanId = params?.get('planId')
          const matchedPlan = targetPlanId ? res.plans.find((p) => p.id === targetPlanId) : null
          if (matchedPlan) {
            setSelectedPlanForCheckout(matchedPlan)
          } else if (res.registrationPath === 'subscribe' && !res.subscription) {
            const defaultPlan = res.plans.find((p) => p.price > 0) || res.plans[0]
            if (defaultPlan) setSelectedPlanForCheckout(defaultPlan)
          }
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Informasi subscription belum dapat dimuat.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void fetchData()
    return () => { cancelled = true }
  }, [load])

  // Load Midtrans Snap script dynamically
  useEffect(() => {
    if (!data?.midtransConfig) return
    const { clientKey, snapScriptUrl } = data.midtransConfig
    const scriptId = 'midtrans-snap-script'
    let script = document.getElementById(scriptId) as HTMLScriptElement | null

    if (!script) {
      script = document.createElement('script')
      script.id = scriptId
      script.src = snapScriptUrl
      if (clientKey) script.setAttribute('data-client-key', clientKey)
      script.async = true
      document.body.appendChild(script)
    } else if (script.src !== snapScriptUrl) {
      script.src = snapScriptUrl
      if (clientKey) script.setAttribute('data-client-key', clientKey)
    }
  }, [data?.midtransConfig])

  const activePendingPayment = data?.payments.find((p) => p.status === 'pending') ?? null
  const countdown = useCountdown(activePendingPayment?.expires_at ?? null)

  // Server-side status synchronization
  const syncPaymentStatus = useCallback(async (orderId: string, silent = false) => {
    if (!silent) setCheckingStatus(true)
    try {
      const res = await fetch('/api/subscription/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      })
      const result = await res.json() as { status?: string; verified?: boolean; error?: string }
      if (!res.ok) throw new Error(result.error || 'Gagal memeriksa status pembayaran.')

      await load()

      if (result.status === 'success') {
        setShowPaymentModal(false)
        setChargeResult(null)
        setSelectedMethod(null)
        setNotice('Pembayaran berhasil diverifikasi! Paket langganan Anda aktif secara otomatis. Mengalihkan ke dashboard...')
        setError('')
        setTimeout(() => {
          window.location.assign('/owner')
        }, 1500)
      } else if (result.status === 'expired' || result.status === 'failed' || result.status === 'cancelled') {
        setChargeResult(null)
        setSelectedMethod(null)
        setError(`Status pembayaran: ${paymentStatusLabels[result.status]?.label ?? result.status}. Silakan coba bayar kembali.`)
      }
    } catch (err) {
      if (!silent) {
        setError(err instanceof Error ? err.message : 'Gagal memperbarui status transaksi.')
      }
    } finally {
      if (!silent) setCheckingStatus(false)
    }
  }, [load])

  // Auto-polling for active pending payments (every 5 seconds, up to 36 times = 3 minutes)
  useEffect(() => {
    if (!activePendingPayment) {
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current)
        pollingTimeoutRef.current = null
      }
      pollingCountRef.current = 0
      return
    }

    const poll = async () => {
      if (pollingCountRef.current >= 36) return
      pollingCountRef.current += 1
      await syncPaymentStatus(activePendingPayment.order_id, true)
      pollingTimeoutRef.current = setTimeout(poll, 5000)
    }

    pollingTimeoutRef.current = setTimeout(poll, 5000)

    return () => {
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current)
        pollingTimeoutRef.current = null
      }
    }
  }, [activePendingPayment, syncPaymentStatus])

  // Open Midtrans Snap popup (routes to /payment/finish upon return)
  const openSnapPopup = (token: string, paymentUrl?: string | null, orderId?: string) => {
    if (typeof window !== 'undefined' && window.snap?.pay) {
      window.snap.pay(token, {
        onSuccess: () => {
          if (orderId) {
            router.push(`/payment/finish?order_id=${encodeURIComponent(orderId)}&status=success`)
          } else {
            setNotice('Pembayaran berhasil! Memverifikasi aktivasi akun...')
            void load()
          }
        },
        onPending: () => {
          if (orderId) {
            router.push(`/payment/finish?order_id=${encodeURIComponent(orderId)}&status=pending`)
          } else {
            setNotice('Transaksi Anda sedang diproses. Silakan selesaikan pembayaran.')
            void load()
          }
        },
        onError: () => {
          if (orderId) {
            router.push(`/payment/finish?order_id=${encodeURIComponent(orderId)}&status=failed`)
          } else {
            setError('Pembayaran dibatalkan atau terjadi kendala. Anda dapat mencoba kembali.')
            void load()
          }
        },
        onClose: () => {
          if (orderId) {
            router.push(`/payment/finish?order_id=${encodeURIComponent(orderId)}`)
          } else {
            void load()
          }
        },
      })
    } else if (paymentUrl) {
      window.location.assign(paymentUrl)
    } else {
      setError('Layanan pembayaran Snap belum siap. Silakan muat ulang halaman.')
    }
  }

  // Handle Core API charge for QRIS or Bank Transfer
  async function handleMethodCharge(method: SelectedMethod, planId: string) {
    if (!method || chargingMethod) return
    setChargingMethod(true)
    setError('')
    setChargeResult(null)

    try {
      const body: Record<string, string> = { planId }
      if (method === 'qris') {
        body.paymentMethod = 'qris'
      } else {
        body.paymentMethod = 'bank_transfer'
        body.bank = method
      }
      if (customerName) body.name = customerName
      if (customerEmail) body.email = customerEmail
      if (customerPhone) body.phone = customerPhone

      const res = await fetch('/api/subscription/charge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const result = await res.json() as ChargeResult
      if (!res.ok) throw new Error(result.error || 'Gagal membuat pembayaran.')

      setChargeResult(result)
      setSelectedMethod(method)
      setSelectedPlanForCheckout(null)

      // Reload data to pick up the new payment record
      await load()
      setShowPaymentModal(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membuat pembayaran.')
    } finally {
      setChargingMethod(false)
    }
  }

  // Handle initiating a new payment attempt (Snap-based, as fallback)
  async function handleConfirmCheckout() {
    if (!selectedPlanForCheckout || initiatingCheckout) return

    if (!customerPhone || customerPhone.trim().length < 8) {
      setError('Mohon lengkapi nomor handphone / WhatsApp untuk penerbitan tagihan pembayaran Midtrans.')
      return
    }

    setInitiatingCheckout(true)
    setError('')
    setNotice('')

    try {
      const response = await fetch('/api/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: selectedPlanForCheckout.id,
          name: customerName,
          email: customerEmail,
          phone: customerPhone,
        }),
      })
      const result = await response.json() as {
        orderId?: string
        snapToken?: string
        paymentUrl?: string
        error?: string
      }

      if (!response.ok) throw new Error(result.error || 'Transaksi belum dapat dibuat.')

      setSelectedPlanForCheckout(null)
      await load()
      setShowPaymentModal(true)

      if (result.snapToken) {
        openSnapPopup(result.snapToken, result.paymentUrl, result.orderId)
      } else if (result.paymentUrl) {
        window.location.assign(result.paymentUrl)
      } else {
        throw new Error('Midtrans tidak mengembalikan tautan atau token pembayaran.')
      }
    } catch (checkoutError) {
      console.error('Unable to start subscription checkout.', checkoutError)
      setError(checkoutError instanceof Error ? checkoutError.message : 'Transaksi belum dapat dibuat.')
    } finally {
      setInitiatingCheckout(false)
    }
  }

  // Create a NEW payment (after an expired/failed one)
  function handleNewPaymentAttempt() {
    // Reset charge state and show the plan selector
    setChargeResult(null)
    setSelectedMethod(null)
    setShowPaymentModal(false)
    setError('')
    setNotice('')
    // Data will show updated payments, user can select a plan again
  }

  // Copy to clipboard
  const handleCopy = (text: string, label: string) => {
    void navigator.clipboard.writeText(text)
    setCopiedText(label)
    setTimeout(() => setCopiedText(''), 2000)
  }

  // Determine if trial user or pending subscribe
  const isTrialPending = data?.approvalStatus === 'pending' && data?.registrationPath === 'trial'
  const isRejected = data?.approvalStatus === 'rejected'

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <span className={styles.eyebrow}>LANGGANAN FLUXA</span>
        <h1>Paket dan Pembayaran</h1>
        <p>Pilih paket langganan untuk mengaktifkan akses operasional toko dan fitur AI. Pembayaran diproses dengan aman via Midtrans (QRIS, E-Wallet, VA Bank).</p>
      </header>

      {/* Onboarding Welcome Banner */}
      {isOnboarding && !data?.subscription && (
        <div className={styles.onboardBanner}>
          <Sparkles size={28} color="#6366f1" style={{ flexShrink: 0 }} />
          <div>
            <strong style={{ fontSize: '1rem', color: '#1e1b4b' }}>Selamat datang di Fluxa!</strong>
            <p style={{ margin: '4px 0 0', fontSize: '.88rem', color: '#475569', lineHeight: 1.5 }}>
              Akun Anda telah tersimpan di sistem. Pilih metode pembayaran <strong>QRIS</strong> atau <strong>Virtual Account</strong> di bawah. Sesi pembayaran berlaku selama 24 jam dan akun bisnis Anda aktif otomatis tanpa menunggu verifikasi manual.
            </p>
          </div>
        </div>
      )}

      {/* Awaiting Approval Banner (Trial users) */}
      {isTrialPending && (
        <div className={styles.approvalBanner} role="status">
          <Clock3 size={22} color="#d97706" style={{ flexShrink: 0 }} />
          <div>
            <strong style={{ fontSize: '1rem', color: '#78350f' }}>Menunggu Persetujuan Super Admin</strong>
            <p style={{ margin: '4px 0 0', fontSize: '.88rem', color: '#92400e', lineHeight: 1.5 }}>
              Pendaftaran Free Trial 7 hari Anda sedang menunggu verifikasi dan persetujuan Super Admin. Masa trial dimulai setelah akun disetujui. Anda dapat mengecek status ini dengan login kembali kapan saja.
            </p>
          </div>
        </div>
      )}

      {/* Registration Rejected Banner */}
      {isRejected && (
        <div className={styles.rejectedBanner} role="alert">
          <XCircle size={22} color="#b91c1c" style={{ flexShrink: 0 }} />
          <div>
            <strong style={{ fontSize: '1rem', color: '#7f1d1d' }}>Pendaftaran Ditolak</strong>
            <p style={{ margin: '4px 0 0', fontSize: '.88rem', color: '#991b1b', lineHeight: 1.5 }}>
              Permohonan akun Anda ditolak oleh Super Admin. Jika Anda yakin ini adalah kesalahan, silakan hubungi administrator. Anda juga dapat memilih untuk berlangganan langsung.
            </p>
          </div>
        </div>
      )}

      {/* Success Notice */}
      {notice && (
        <div className={styles.notice} role="status">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CheckCircle2 size={22} color="#059669" />
            <span>{notice}</span>
          </div>
          <Link href="/owner" className={styles.dashboardLink}>
            Buka Dashboard Bisnis <ArrowRight size={15} />
          </Link>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className={styles.error} role="alert">
          <AlertCircle size={20} color="#b91c1c" style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className={styles.state} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Loader2 size={18} className={styles.spinner} />
          <span>Memuat informasi paket dan transaksi...</span>
        </div>
      ) : data && (
        <>
          {/* Current Status Section */}
          <section className={styles.current}>
            <div>
              <span className={styles.eyebrow}>STATUS AKUN & AKSES</span>
              <h2>{data.subscription?.plan?.name ?? (data.trialEndsAt ? 'Masa Percobaan (Free Trial)' : 'Belum Berlangganan')}</h2>
              <p>
                {data.subscription
                  ? `Status: ${data.subscription.status === 'active' ? 'Aktif Penuh' : data.subscription.status.toUpperCase()} · Berlaku hingga ${dateFormatter.format(new Date(data.subscription.current_period_end))}`
                  : data.trialEndsAt
                    ? `Masa trial aktif hingga ${dateFormatter.format(new Date(data.trialEndsAt))}. Fitur AI Agent memerlukan langganan berbayar.`
                    : 'Belum ada paket aktif. Silakan pilih paket di bawah untuk mengaktifkan akses operasional.'}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              {data.subscription ? (
                <span className={`${styles.status} ${data.subscription.status === 'active' ? styles.statusSuccess : styles.statusDefault}`}>
                  {data.subscription.status === 'active' ? 'Aktif' : data.subscription.status}
                </span>
              ) : data.trialEndsAt ? (
                <span className={`${styles.status} ${styles.statusPending}`}>Free Trial</span>
              ) : (
                <span className={`${styles.status} ${styles.statusDefault}`}>Nonaktif</span>
              )}
              {data.subscription?.status === 'active' && (
                <Link href="/owner" className={styles.dashboardLink}>
                  Buka Dashboard <ArrowRight size={14} />
                </Link>
              )}
            </div>
          </section>

          {/* Active Pending Transaction Card */}
          {activePendingPayment && (
            <section className={styles.pendingCard} aria-labelledby="pending-payment-title">
              <div className={styles.pendingCardHeader}>
                <div>
                  <h3 id="pending-payment-title" className={styles.pendingCardTitle}>Tagihan Menunggu Pembayaran</h3>
                  <p className={styles.pendingCardSubtitle}>
                    Sesi pembayaran ini tersimpan di database selama 1 hari (24 jam). Selesaikan via QRIS atau Virtual Account.
                  </p>
                </div>
                <span className={`${styles.badge} ${styles.badgePending}`}>
                  <span className={styles.pulseDot} />
                  Menunggu Pembayaran
                </span>
              </div>

              {/* Countdown Banner */}
              <CountdownDisplay countdown={countdown} expiresAt={activePendingPayment.expires_at} />

              <div className={styles.pendingDetailsGrid}>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Order ID</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className={styles.detailValue} style={{ fontSize: '.88rem', fontFamily: 'monospace' }}>
                      {activePendingPayment.order_id}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(activePendingPayment.order_id, 'orderId')}
                      title="Salin Order ID"
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 2 }}
                    >
                      <Copy size={13} color="#92400e" />
                    </button>
                    {copiedText === 'orderId' && <span style={{ fontSize: '11px', color: '#065f46' }}>Tersalin!</span>}
                  </div>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Paket Dipilih</span>
                  <span className={styles.detailValue}>{activePendingPayment.plan_name}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Total Pembayaran</span>
                  <span className={styles.detailValue} style={{ color: '#065f46' }}>
                    {money.format(activePendingPayment.amount)}
                  </span>
                </div>
              </div>

              {/* Login Recovery Hint */}
              <div className={styles.loginRecoveryHint}>
                <Info size={18} color="#166534" style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <strong>Tidak sengaja menutup halaman?</strong>
                  <p style={{ margin: '2px 0 0' }}>
                    Akun dan sesi transaksi ini sudah tersimpan di database. Anda dapat masuk kembali kapan saja melalui <strong>Login</strong> untuk menyelesaikan pembayaran ini.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className={styles.pendingActions}>
                {!countdown.isExpired && (
                  <button
                    type="button"
                    className={styles.btnPrimary}
                    onClick={() => setShowPaymentModal(true)}
                  >
                    <QrCode size={17} />
                    Buka Pop-up Pembayaran (QRIS & VA)
                  </button>
                )}

                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => void syncPaymentStatus(activePendingPayment.order_id)}
                  disabled={checkingStatus}
                >
                  <RefreshCw size={15} className={checkingStatus ? styles.spinner : ''} />
                  {checkingStatus ? 'Memeriksa ke Midtrans...' : 'Cek Status Sekarang'}
                </button>

                {countdown.isExpired && (
                  <button
                    type="button"
                    className={styles.btnPrimary}
                    onClick={handleNewPaymentAttempt}
                  >
                    <ArrowRight size={15} />
                    Buat Transaksi Baru
                  </button>
                )}

                {activePendingPayment.snap_url && !countdown.isExpired && (
                  <a
                    href={activePendingPayment.snap_url}
                    target="_blank"
                    rel="noreferrer"
                    className={styles.btnSecondary}
                    style={{ textDecoration: 'none' }}
                  >
                    <ExternalLink size={14} />
                    Halaman Pembayaran Midtrans
                  </a>
                )}
              </div>
            </section>
          )}

          {/* Subscription Plans Selection */}
          <section aria-labelledby="plans-section-title">
            <h2 id="plans-section-title" style={{ fontSize: '1.4rem', fontWeight: 800, margin: '8px 0 16px' }}>
              Pilihan Paket Langganan
            </h2>

            {data.plans.length === 0 ? (
              <p className={styles.state}>Belum ada paket aktif yang dikonfigurasi. Hubungi Super Admin.</p>
            ) : (
              <div className={styles.plans}>
                {data.plans.map((plan) => {
                  const isCurrentPlan = data.subscription?.plan?.name === plan.name
                  return (
                    <article
                      className={`${styles.plan} ${isCurrentPlan ? styles.planSelected : ''}`}
                      key={plan.id}
                    >
                      {isCurrentPlan && (
                        <span className={styles.planBadge}>
                          Paket Aktif
                        </span>
                      )}

                      <div>
                        <h2>{plan.name}</h2>
                        <p>{plan.description || 'Akses fitur operasional Fluxa sesuai kebutuhan usaha Anda.'}</p>
                      </div>

                      <strong className={styles.price}>
                        {money.format(plan.price)}
                        <small> / {plan.duration_days} hari</small>
                      </strong>

                      <ul>
                        <li>Kapasitas hingga {plan.max_users} pengguna kasir & staf</li>
                        <li>Sistem Kasir (POS) & manajemen shift kasir</li>
                        <li>Laporan keuangan, stok, hutang & piutang</li>
                        {Array.isArray(plan.features) &&
                          plan.features.map((feature) => <li key={feature}>{feature}</li>)}
                      </ul>

                      <button
                        type="button"
                        onClick={() => setSelectedPlanForCheckout(plan)}
                        disabled={initiatingCheckout || plan.price <= 0}
                      >
                        Pilih & Bayar Paket
                        <ArrowRight size={15} />
                      </button>
                    </article>
                  )
                })}
              </div>
            )}
          </section>

          {/* Payment History */}
          <section className={styles.history} aria-labelledby="history-section-title">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <h2 id="history-section-title">Riwayat Pembayaran & Tagihan</h2>
              <button type="button" className={styles.tableActionBtn} onClick={() => void load()} title="Muat Ulang Riwayat">
                <RefreshCw size={13} style={{ display: 'inline', marginRight: 4 }} />
                Muat Ulang
              </button>
            </div>

            {data.payments.length === 0 ? (
              <p className={styles.state}>Belum ada riwayat transaksi pembayaran.</p>
            ) : (
              <div className={styles.tableWrap}>
                <table>
                  <thead>
                    <tr>
                      <th>Order ID</th>
                      <th>Paket</th>
                      <th>Nominal</th>
                      <th>Status</th>
                      <th>Tanggal Dibuat</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.payments.map((payment) => {
                      const statusInfo = paymentStatusLabels[payment.status] ?? { label: payment.status, class: styles.badgeDefault }
                      return (
                        <tr key={payment.id}>
                          <td><strong style={{ fontFamily: 'monospace' }}>{payment.order_id}</strong></td>
                          <td>{payment.plan_name}</td>
                          <td>{money.format(payment.amount)}</td>
                          <td>
                            <span className={`${styles.badge} ${statusInfo.class}`}>
                              {payment.status === 'pending' && <span className={styles.pulseDot} />}
                              {statusInfo.label}
                            </span>
                          </td>
                          <td>{dateFormatter.format(new Date(payment.created_at))}</td>
                          <td>
                            {payment.status === 'pending' ? (
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button type="button" className={styles.tableActionBtn} onClick={() => void syncPaymentStatus(payment.order_id)}>
                                  Cek Status
                                </button>
                                <button type="button" className={styles.tableActionBtn} style={{ background: 'var(--acc)', color: '#fff', borderColor: 'var(--acc)' }} onClick={() => setShowPaymentModal(true)}>
                                  Bayar
                                </button>
                              </div>
                            ) : payment.status === 'success' ? (
                              <span style={{ fontSize: '.8rem', color: 'var(--ok)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <ShieldCheck size={14} /> Terverifikasi
                              </span>
                            ) : (
                              <span style={{ fontSize: '.8rem', color: 'var(--mute)' }}>Selesai</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {/* ===== POP-UP PEMBAYARAN UTAMA ===== */}
      {showPaymentModal && activePendingPayment && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="modal-payment-title">
          <div className={styles.paymentModalCard}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <span className={styles.eyebrow} style={{ color: 'var(--warn)' }}>SESI PEMBAYARAN AKTIF (1 HARI)</span>
                <h3 id="modal-payment-title" className={styles.modalTitle}>Selesaikan Pembayaran</h3>
                <p className={styles.modalSubtitle}>
                  Pilih metode pembayaran <strong>QRIS</strong> atau <strong>Virtual Account</strong> untuk menyelesaikan transaksi.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                title="Tutup (Sesi tetap tersimpan)"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 8 }}
              >
                <X size={20} color="var(--mute)" />
              </button>
            </div>

            {/* Countdown Timer Display */}
            <CountdownDisplay countdown={countdown} expiresAt={activePendingPayment.expires_at} />

            {/* Tagihan Summary */}
            <div className={styles.summaryBox}>
              <div className={styles.summaryRow}>
                <span style={{ color: 'var(--mute)' }}>Order ID</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <strong style={{ fontFamily: 'monospace' }}>{activePendingPayment.order_id}</strong>
                  <button type="button" onClick={() => handleCopy(activePendingPayment.order_id, 'modalOrderId')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 2 }}>
                    <Copy size={13} color="var(--mute)" />
                  </button>
                  {copiedText === 'modalOrderId' && <span style={{ fontSize: '11px', color: 'var(--ok)' }}>Tersalin!</span>}
                </div>
              </div>
              <div className={styles.summaryRow}>
                <span style={{ color: 'var(--mute)' }}>Paket Langganan</span>
                <strong>{activePendingPayment.plan_name}</strong>
              </div>
              <div className={`${styles.summaryRow} ${styles.summaryTotal}`}>
                <span>Total yang Harus Dibayar</span>
                <span style={{ color: 'var(--acc)', fontWeight: 800 }}>{money.format(activePendingPayment.amount)}</span>
              </div>
            </div>

            {/* === Payment Method Selector & Results === */}
            {!countdown.isExpired ? (
              <>
                {/* QRIS / VA Result Display */}
                {chargeResult && chargeResult.qrCodeUrl && (
                  <div className={styles.qrisResultCard}>
                    <div className={styles.qrisResultHeader}>
                      <QrCode size={20} color="#28765a" />
                      <span>Scan QRIS untuk Membayar</span>
                    </div>
                    <div className={styles.qrCodeContainer}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={chargeResult.qrCodeUrl}
                        alt="QR Code QRIS Pembayaran"
                        className={styles.qrCodeImage}
                        width={220}
                        height={220}
                      />
                    </div>
                    <div className={styles.qrisGuide}>
                      <p className={styles.qrisGuideTitle}>
                        <Info size={15} />
                        Cara Membayar via QRIS:
                      </p>
                      <ol className={styles.qrisGuideList}>
                        <li>Buka aplikasi e-wallet atau mobile banking Anda (GoPay, OVO, DANA, ShopeePay, BCA Mobile, Livin, BRImo, dll)</li>
                        <li>Pilih menu <strong>Scan</strong> atau <strong>Bayar dengan QR</strong></li>
                        <li>Arahkan kamera ke QR code di atas</li>
                        <li>Konfirmasi pembayaran sebesar <strong>{money.format(activePendingPayment.amount)}</strong></li>
                        <li>Status akan otomatis diperbarui setelah pembayaran berhasil</li>
                      </ol>
                    </div>
                  </div>
                )}

                {chargeResult && chargeResult.vaNumber && (
                  <div className={styles.vaResultCard}>
                    <div className={styles.vaResultHeader}>
                      <Building2 size={20} color="#0284c7" />
                      <span>Transfer ke Virtual Account {(chargeResult.vaBank ?? '').toUpperCase()}</span>
                    </div>
                    <div className={styles.vaNumberBox}>
                      <span className={styles.vaNumberLabel}>Nomor Virtual Account:</span>
                      <div className={styles.vaNumberRow}>
                        <span className={styles.vaNumberValue}>{chargeResult.vaNumber}</span>
                        <button
                          type="button"
                          className={styles.vaCopyBtn}
                          onClick={() => handleCopy(chargeResult.vaNumber!, 'vaNumber')}
                        >
                          <Copy size={14} />
                          {copiedText === 'vaNumber' ? 'Tersalin!' : 'Salin'}
                        </button>
                      </div>
                      <span className={styles.vaBankName}>Bank: {BANK_LABELS[chargeResult.vaBank ?? ''] ?? (chargeResult.vaBank ?? '').toUpperCase()}</span>
                    </div>
                    <div className={styles.qrisGuide}>
                      <p className={styles.qrisGuideTitle}>
                        <Info size={15} />
                        Cara Transfer via Virtual Account:
                      </p>
                      <ol className={styles.qrisGuideList}>
                        <li>Buka mobile banking atau ATM bank {BANK_LABELS[chargeResult.vaBank ?? ''] ?? (chargeResult.vaBank ?? '').toUpperCase()}</li>
                        <li>Pilih menu <strong>Transfer &gt; Virtual Account</strong></li>
                        <li>Masukkan nomor VA: <strong>{chargeResult.vaNumber}</strong></li>
                        <li>Konfirmasi nominal <strong>{money.format(activePendingPayment.amount)}</strong></li>
                        <li>Selesaikan transfer. Status otomatis diperbarui.</li>
                      </ol>
                    </div>
                  </div>
                )}

                {/* Method Selection Grid */}
                {!chargeResult && (
                  <div>
                    <p style={{ fontSize: '.88rem', fontWeight: 750, color: 'var(--ink)', margin: '0 0 10px' }}>
                      Pilih Metode Pembayaran:
                    </p>
                    <div className={styles.methodsGrid}>
                      {/* QRIS Card */}
                      <button
                        type="button"
                        className={`${styles.methodCard} ${styles.methodCardClickable} ${selectedMethod === 'qris' ? styles.methodCardSelected : ''}`}
                        onClick={() => {
                          const planId = data?.plans.find(p => p.name === activePendingPayment.plan_name)?.id
                          if (planId) void handleMethodCharge('qris', planId)
                        }}
                        disabled={chargingMethod}
                      >
                        <div className={styles.methodHeader}>
                          <span className={styles.methodTitle}>
                            <QrCode size={18} color="var(--acc)" />
                            QRIS
                          </span>
                          <span className={styles.methodBadge}>Instan</span>
                        </div>
                        <p className={styles.methodDesc}>
                          Scan QR dengan GoPay, OVO, DANA, ShopeePay, BCA Mobile, Livin, BRImo, atau e-wallet lain.
                        </p>
                        {chargingMethod && selectedMethod === 'qris' && (
                          <Loader2 size={16} className={styles.spinner} />
                        )}
                      </button>

                      {/* Virtual Account Cards */}
                      {(['bca', 'bni', 'bri', 'permata'] as const).map((bankCode) => (
                        <button
                          key={bankCode}
                          type="button"
                          className={`${styles.methodCard} ${styles.methodCardClickable} ${selectedMethod === bankCode ? styles.methodCardSelected : ''}`}
                          onClick={() => {
                            const planId = data?.plans.find(p => p.name === activePendingPayment.plan_name)?.id
                            if (planId) void handleMethodCharge(bankCode, planId)
                          }}
                          disabled={chargingMethod}
                        >
                          <div className={styles.methodHeader}>
                            <span className={styles.methodTitle}>
                              <Building2 size={18} color="#0284c7" />
                              VA {BANK_LABELS[bankCode]}
                            </span>
                            <span className={styles.methodBadge}>Transfer</span>
                          </div>
                          <p className={styles.methodDesc}>
                            Transfer via Virtual Account {BANK_LABELS[bankCode]}
                          </p>
                          {chargingMethod && selectedMethod === bankCode && (
                            <Loader2 size={16} className={styles.spinner} />
                          )}
                        </button>
                      ))}
                    </div>

                    {/* Primary: Snap button & Sandbox Link */}
                    {activePendingPayment.snap_token ? (
                      <div style={{ marginTop: 14, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <button
                          type="button"
                          className={styles.btnPrimary}
                          style={{ width: '100%', justifyContent: 'center' }}
                          onClick={() => openSnapPopup(activePendingPayment.snap_token!, activePendingPayment.snap_url, activePendingPayment.order_id)}
                        >
                          <Sparkles size={16} />
                          Lanjutkan Pembayaran via Midtrans Snap
                        </button>
                        {SANDBOX_PAYMENT_LINKS[activePendingPayment.plan_name.toLowerCase()] && (
                          <a
                            href={SANDBOX_PAYMENT_LINKS[activePendingPayment.plan_name.toLowerCase()]}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: '.78rem', color: '#64748b', textDecoration: 'underline' }}
                          >
                            <ExternalLink size={12} /> Atau Buka Sandbox Payment Link ({activePendingPayment.plan_name})
                          </a>
                        )}
                      </div>
                    ) : (
                      SANDBOX_PAYMENT_LINKS[activePendingPayment.plan_name.toLowerCase()] && (
                        <div style={{ marginTop: 14, textAlign: 'center' }}>
                          <a
                            href={SANDBOX_PAYMENT_LINKS[activePendingPayment.plan_name.toLowerCase()]}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.btnSecondary}
                            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', textDecoration: 'none' }}
                          >
                            <ExternalLink size={15} />
                            Buka Sandbox Payment Link ({activePendingPayment.plan_name})
                          </a>
                        </div>
                      )
                    )}
                  </div>
                )}

                {/* Change method after result */}
                {chargeResult && (
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    style={{ width: '100%' }}
                    onClick={() => { setChargeResult(null); setSelectedMethod(null) }}
                  >
                    Ganti Metode Pembayaran
                  </button>
                )}
              </>
            ) : (
              /* Expired State */
              <div className={styles.expiredBox}>
                <XCircle size={32} color="#b91c1c" />
                <strong>Sesi Pembayaran Telah Habis</strong>
                <p>Waktu pembayaran 24 jam telah berakhir. Transaksi ini tidak lagi dapat dibayar. Silakan buat transaksi pembayaran baru.</p>
                <button type="button" className={styles.btnPrimary} onClick={handleNewPaymentAttempt}>
                  <ArrowRight size={15} />
                  Buat Transaksi Baru
                </button>
              </div>
            )}

            {/* Login Recovery Hint */}
            <div className={styles.loginRecoveryHint}>
              <LogIn size={18} color="var(--ok)" style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <strong>Bisa Lanjut Bayar Kapan Saja:</strong>
                <p style={{ margin: '2px 0 0', color: 'var(--ink)', fontSize: '.82rem' }}>
                  Jika pop up ini atau browser tidak sengaja ter-close, akun Anda tetap aman. Login kembali dengan email & password Anda untuk melanjutkan pembayaran.
                </p>
              </div>
            </div>

            {/* Bottom Actions */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => void syncPaymentStatus(activePendingPayment.order_id)}
                disabled={checkingStatus}
              >
                <RefreshCw size={15} className={checkingStatus ? styles.spinner : ''} />
                {checkingStatus ? 'Memeriksa...' : 'Cek Status'}
              </button>
              <button type="button" className={styles.btnSecondary} onClick={() => setShowPaymentModal(false)}>
                Tutup Pop-up
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL PEMILIHAN / KONFIRMASI PAKET ===== */}
      {selectedPlanForCheckout && !activePendingPayment && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="modal-summary-title">
          <div className={styles.paymentModalCard}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <h3 id="modal-summary-title" className={styles.modalTitle}>Pilih Metode Pembayaran</h3>
                <p className={styles.modalSubtitle}>Sesi tagihan 24 jam akan dibuat dan akun Anda langsung diarahkan ke pembayaran.</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPlanForCheckout(null)}
                disabled={chargingMethod || initiatingCheckout}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4 }}
              >
                <X size={20} color="var(--mute)" />
              </button>
            </div>

            <div className={styles.summaryBox}>
              <div className={styles.summaryRow}>
                <span style={{ color: 'var(--mute)' }}>Paket Langganan</span>
                <strong>{selectedPlanForCheckout.name}</strong>
              </div>
              <div className={styles.summaryRow}>
                <span style={{ color: 'var(--mute)' }}>Masa Berlaku</span>
                <span>{selectedPlanForCheckout.duration_days} Hari</span>
              </div>
              <div className={styles.summaryRow}>
                <span style={{ color: 'var(--mute)' }}>Kapasitas Staf</span>
                <span>{selectedPlanForCheckout.max_users} Pengguna</span>
              </div>
              <div className={`${styles.summaryRow} ${styles.summaryTotal}`}>
                <span>Total Tagihan</span>
                <span style={{ color: 'var(--acc)', fontWeight: 800 }}>{money.format(selectedPlanForCheckout.price)}</span>
              </div>
            </div>

            {/* Customer Contact Details (Sent to Midtrans API) */}
            <div style={{
              background: 'var(--bg)',
              border: '1px solid var(--line)',
              borderRadius: 12,
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              textAlign: 'left',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '.82rem', fontWeight: 700, color: 'var(--ink)' }}>
                  Data Kontak Pemesan (Midtrans):
                </span>
                <span style={{ fontSize: '.72rem', color: 'var(--mute)' }}>
                  Kwitansi &amp; Notifikasi
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: '.72rem', fontWeight: 600, color: 'var(--ink)', display: 'block', marginBottom: 3 }}>
                    Nama Pemesan
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Nama Lengkap"
                    style={{
                      width: '100%',
                      padding: '8px 11px',
                      borderRadius: 8,
                      border: '1px solid var(--line)',
                      fontSize: '.84rem',
                      color: 'var(--ink)',
                      background: 'var(--panel)',
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '.72rem', fontWeight: 600, color: 'var(--ink)', display: 'block', marginBottom: 3 }}>
                    Email
                  </label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="nama@email.com"
                    style={{
                      width: '100%',
                      padding: '8px 11px',
                      borderRadius: 8,
                      border: '1px solid var(--line)',
                      fontSize: '.84rem',
                      color: 'var(--ink)',
                      background: 'var(--panel)',
                    }}
                  />
                </div>
              </div>
              <div>
                <label style={{ fontSize: '.72rem', fontWeight: 600, color: 'var(--ink)', display: 'block', marginBottom: 3 }}>
                  No. Handphone / WhatsApp {(!customerPhone || customerPhone.trim() === '') && <span style={{ color: 'var(--bad)' }}>* (Wajib diisi)</span>}
                </label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Contoh: 081234567890"
                  style={{
                    width: '100%',
                    padding: '8px 11px',
                    borderRadius: 8,
                    border: (!customerPhone || customerPhone.trim() === '') ? '1.5px solid var(--bad)' : '1px solid var(--line)',
                    fontSize: '.84rem',
                    color: 'var(--ink)',
                    background: 'var(--panel)',
                  }}
                />
              </div>
            </div>

            {/* Payment Method Selection for New Checkout */}
            <div>
              <p style={{ fontSize: '.85rem', fontWeight: 700, color: '#334155', margin: '0 0 10px' }}>
                Pilih Metode Pembayaran:
              </p>
              <div className={styles.methodsGrid}>
                {/* QRIS */}
                <button
                  type="button"
                  className={`${styles.methodCard} ${styles.methodCardClickable}`}
                  onClick={() => void handleMethodCharge('qris', selectedPlanForCheckout.id)}
                  disabled={chargingMethod || initiatingCheckout}
                >
                  <div className={styles.methodHeader}>
                    <span className={styles.methodTitle}>
                      <QrCode size={18} color="var(--acc)" />
                      QRIS
                    </span>
                    <span className={styles.methodBadge}>Instan</span>
                  </div>
                  <p className={styles.methodDesc}>Scan QR dengan GoPay, OVO, DANA, ShopeePay, BCA Mobile, Livin, BRImo</p>
                  {chargingMethod && selectedMethod === 'qris' && <Loader2 size={16} className={styles.spinner} />}
                </button>

                {/* VA Banks */}
                {(['bca', 'bni', 'bri', 'permata'] as const).map((bankCode) => (
                  <button
                    key={bankCode}
                    type="button"
                    className={`${styles.methodCard} ${styles.methodCardClickable}`}
                    onClick={() => void handleMethodCharge(bankCode, selectedPlanForCheckout.id)}
                    disabled={chargingMethod || initiatingCheckout}
                  >
                    <div className={styles.methodHeader}>
                      <span className={styles.methodTitle}>
                        <Building2 size={18} color="#0284c7" />
                        VA {BANK_LABELS[bankCode]}
                      </span>
                      <span className={styles.methodBadge}>Transfer</span>
                    </div>
                    <p className={styles.methodDesc}>Transfer via Virtual Account {BANK_LABELS[bankCode]}</p>
                    {chargingMethod && selectedMethod === bankCode && <Loader2 size={16} className={styles.spinner} />}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ fontSize: '.82rem', color: 'var(--mute)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShieldCheck size={16} color="var(--acc)" style={{ flexShrink: 0 }} />
              <span>Sesi pembayaran tersimpan selama 1 hari (24 jam) di akun Anda.</span>
            </div>

            {/* Primary: Snap all-methods with Sandbox Payment Link fallback */}
            <div className={styles.modalActions} style={{ flexDirection: 'column', gap: 10 }}>
              <button
                type="button"
                className={styles.btnPrimary}
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => void handleConfirmCheckout()}
                disabled={chargingMethod || initiatingCheckout}
              >
                {initiatingCheckout ? (
                  <><Loader2 size={16} className={styles.spinner} /> Menyiapkan Pembayaran Snap...</>
                ) : (
                  <><Sparkles size={16} /> Bayar Sekarang via Midtrans Snap (Instan)</>
                )}
              </button>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => setSelectedPlanForCheckout(null)}
                  disabled={chargingMethod || initiatingCheckout}
                >
                  Batal
                </button>

                {SANDBOX_PAYMENT_LINKS[selectedPlanForCheckout.name.toLowerCase()] && (
                  <a
                    href={SANDBOX_PAYMENT_LINKS[selectedPlanForCheckout.name.toLowerCase()]}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '.78rem', color: '#64748b', textDecoration: 'underline' }}
                  >
                    <ExternalLink size={12} /> Buka Sandbox Payment Link
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

// Countdown display helper component
function CountdownDisplay({ countdown, expiresAt }: {
  countdown: { hours: number; minutes: number; seconds: number; isExpired: boolean }
  expiresAt: string | null
}) {
  return (
    <div className={styles.countdownBanner}>
      <div className={styles.countdownHeader}>
        <Clock3 size={16} color="#b45309" />
        <span>Sisa Waktu Pembayaran (Sesi 24 Jam)</span>
      </div>
      <div className={styles.countdownTimer}>
        <div className={styles.timerSegment}>
          <span className={styles.timerNumber}>{String(countdown.hours).padStart(2, '0')}</span>
          <span className={styles.timerLabel}>Jam</span>
        </div>
        <span className={styles.timerColon}>:</span>
        <div className={styles.timerSegment}>
          <span className={styles.timerNumber}>{String(countdown.minutes).padStart(2, '0')}</span>
          <span className={styles.timerLabel}>Menit</span>
        </div>
        <span className={styles.timerColon}>:</span>
        <div className={styles.timerSegment}>
          <span className={styles.timerNumber}>{String(countdown.seconds).padStart(2, '0')}</span>
          <span className={styles.timerLabel}>Detik</span>
        </div>
      </div>
      <p className={styles.countdownHint}>
        {countdown.isExpired
          ? 'Waktu pembayaran telah habis. Silakan buat transaksi pembayaran baru.'
          : 'Batas akhir pembayaran: ' + (expiresAt ? dateFormatter.format(new Date(expiresAt)) : '24 Jam')}
      </p>
    </div>
  )
}
