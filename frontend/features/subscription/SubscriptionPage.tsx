'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, CheckCircle2, Sparkles } from 'lucide-react'
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
  amount: number
  status: string
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
}

const money = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })
const date = new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeZone: 'Asia/Jakarta' })

const paymentStatus: Record<string, string> = {
  pending: 'Menunggu pembayaran',
  success: 'Berhasil (Aktif)',
  failed: 'Gagal',
  expired: 'Kedaluwarsa',
  cancelled: 'Dibatalkan',
  refunded: 'Direfund',
}

export default function SubscriptionPage() {
  const [data, setData] = useState<SubscriptionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [isOnboarding, setIsOnboarding] = useState(false)
  const [checkoutPlan, setCheckoutPlan] = useState<string | null>(null)

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
    setError('')
  }, [])

  useEffect(() => {
    let cancelled = false
    async function fetchData() {
      try {
        await load()
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Informasi subscription belum dapat dimuat.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void fetchData()
    return () => { cancelled = true }
  }, [load])

  // Load Midtrans Snap Sandbox script
  useEffect(() => {
    const existingScript = document.getElementById('midtrans-snap-script')
    if (!existingScript) {
      const script = document.createElement('script')
      script.id = 'midtrans-snap-script'
      script.src = 'https://app.sandbox.midtrans.com/snap/snap.js'
      script.setAttribute('data-client-key', process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || '')
      script.async = true
      document.body.appendChild(script)
    }
  }, [])

  const hasPending = data?.payments.some((payment) => payment.status === 'pending')
  useEffect(() => {
    if (!hasPending) return
    const interval = window.setInterval(() => {
      void load().catch((loadError: unknown) => {
        console.error('Unable to refresh subscription payment status.', loadError)
      })
    }, 6000)
    return () => window.clearInterval(interval)
  }, [hasPending, load])

  async function checkout(planId: string) {
    setCheckoutPlan(planId)
    setError('')
    setNotice('')
    try {
      const response = await fetch('/api/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      })
      const result = await response.json() as {
        paymentUrl?: string
        snapToken?: string
        error?: string
      }
      if (!response.ok) throw new Error(result.error || 'Transaksi belum dapat dibuat.')

      // Prefer Snap Popup if available
      if (result.snapToken && typeof window !== 'undefined' && window.snap?.pay) {
        window.snap.pay(result.snapToken, {
          onSuccess: () => {
            setNotice('Pembayaran berhasil diverifikasi! Akun Anda aktif secara otomatis.')
            void load()
            setCheckoutPlan(null)
          },
          onPending: () => {
            setNotice('Transaksi Anda sedang diproses. Silakan selesaikan pembayaran sesuai petunjuk Midtrans.')
            void load()
            setCheckoutPlan(null)
          },
          onError: () => {
            setError('Pembayaran dibatalkan atau gagal.')
            setCheckoutPlan(null)
          },
          onClose: () => {
            void load()
            setCheckoutPlan(null)
          },
        })
      } else if (result.paymentUrl) {
        // Fallback to Midtrans Snap redirect URL
        window.location.assign(result.paymentUrl)
      } else {
        throw new Error('Midtrans tidak mengembalikan tautan atau token pembayaran.')
      }
    } catch (checkoutError) {
      console.error('Unable to start subscription checkout.', checkoutError)
      setError(checkoutError instanceof Error ? checkoutError.message : 'Transaksi belum dapat dibuat.')
      setCheckoutPlan(null)
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <span className={styles.eyebrow}>LANGGANAN FLUXA</span>
        <h1>Paket dan Pembayaran</h1>
        <p>Pilih paket untuk mengaktifkan akses operasional. Pembayaran diproses dengan aman via Midtrans Sandbox.</p>
      </header>

      {isOnboarding && !data?.subscription && (
        <div className={styles.onboardBanner}>
          <Sparkles size={24} color="#6366f1" />
          <div>
            <strong>Selamat datang di Fluxa!</strong>
            <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#475569' }}>
              Pilih paket langganan Anda di bawah dan selesaikan pembayaran. Akun bisnis Anda akan langsung diaktifkan secara otomatis tanpa antrean verifikasi manual.
            </p>
          </div>
        </div>
      )}

      {notice && (
        <div className={styles.notice} role="status">
          <span>{notice}</span>
          <Link href="/owner" className={styles.dashboardLink}>
            Buka Dashboard Bisnis <ArrowRight size={14} />
          </Link>
        </div>
      )}
      {error && <p className={styles.error} role="alert">{error}</p>}
      {loading ? <p className={styles.state}>Memuat paket...</p> : data && (
        <>
          <section className={styles.current}>
            <div>
              <span className={styles.eyebrow}>STATUS SAAT INI</span>
              <h2>{data.subscription?.plan?.name ?? 'Belum berlangganan'}</h2>
              <p>
                {data.subscription
                  ? `Status: ${data.subscription.status.toUpperCase()} · Akses aktif hingga ${date.format(new Date(data.subscription.current_period_end))}`
                  : data.trialEndsAt
                    ? `Masa trial aktif hingga ${date.format(new Date(data.trialEndsAt))}`
                    : 'Belum ada paket aktif. Pilih paket di bawah untuk mengaktifkan akses operasional.'}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              {data.subscription && (
                <span className={styles.status}>
                  {data.subscription.status === 'active' ? 'Aktif' : data.subscription.status}
                </span>
              )}
              {data.subscription?.status === 'active' && (
                <Link href="/owner" className={styles.dashboardLink}>
                  Buka Dashboard <ArrowRight size={14} />
                </Link>
              )}
            </div>
          </section>

          <section className={styles.plans} aria-label="Paket subscription">
            {data.plans.length === 0 ? (
              <p className={styles.state}>Belum ada paket aktif. Hubungi administrator.</p>
            ) : (
              data.plans.map((plan) => (
                <article className={styles.plan} key={plan.id}>
                  <div>
                    <h2>{plan.name}</h2>
                    <p>{plan.description || 'Akses fitur operasional Fluxa sesuai paket.'}</p>
                  </div>
                  <strong className={styles.price}>
                    {money.format(plan.price)}
                    <small> / {plan.duration_days} hari</small>
                  </strong>
                  <ul>
                    <li>Maksimal {plan.max_users} pengguna</li>
                    {Array.isArray(plan.features) && plan.features.map((feature) => <li key={feature}>{feature}</li>)}
                  </ul>
                  <button
                    type="button"
                    onClick={() => void checkout(plan.id)}
                    disabled={checkoutPlan !== null || plan.price <= 0}
                  >
                    {checkoutPlan === plan.id ? 'Membuka Snap...' : 'Pilih dan Bayar'}
                  </button>
                </article>
              ))
            )}
          </section>

          <section className={styles.history}>
            <h2>Riwayat Pembayaran & Tagihan (FR-15)</h2>
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
                      <th>Status Pembayaran</th>
                      <th>Tanggal Transaksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.payments.map((payment) => (
                      <tr key={payment.id}>
                        <td><strong>{payment.order_id}</strong></td>
                        <td>{payment.plan_name}</td>
                        <td>{money.format(payment.amount)}</td>
                        <td>
                          <span className={styles.badge}>
                            {paymentStatus[payment.status] ?? payment.status}
                          </span>
                        </td>
                        <td>{date.format(new Date(payment.created_at))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  )
}
