'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  HelpCircle,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  X,
  XCircle,
} from 'lucide-react'

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

type PaymentStatusData = {
  order_id: string
  status: 'pending' | 'success' | 'failed' | 'cancelled' | 'expired' | string
  plan_name?: string
  amount?: number
  created_at?: string
  paid_at?: string | null
  expires_at?: string | null
  snap_token?: string | null
  snap_url?: string | null
  verified?: boolean
  error?: string
}

const moneyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

const dateFormatter = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Jakarta',
})

function PaymentFinishContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const rawOrderId =
    searchParams.get('order_id') ||
    searchParams.get('orderId') ||
    searchParams.get('id') ||
    ''

  const orderId = rawOrderId.trim()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<PaymentStatusData | null>(null)
  const [error, setError] = useState('')
  const [checkingAgain, setCheckingAgain] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [snapReady, setSnapReady] = useState(false)

  const retryCountRef = useRef(0)
  const hasAutoOpenedRef = useRef(false)
  const verifyPaymentRef = useRef<((isSilent?: boolean) => Promise<void>) | null>(null)

  // Dynamically load Midtrans snap.js script
  useEffect(() => {
    const clientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || ''
    const isProd = process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === 'true'
    const snapScriptUrl = isProd
      ? 'https://app.midtrans.com/snap/snap.js'
      : 'https://app.sandbox.midtrans.com/snap/snap.js'
    const scriptId = 'midtrans-snap-finish-script'

    let script = document.getElementById(scriptId) as HTMLScriptElement | null
    if (!script) {
      script = document.createElement('script')
      script.id = scriptId
      script.src = snapScriptUrl
      if (clientKey) script.setAttribute('data-client-key', clientKey)
      script.async = true
      script.onload = () => setSnapReady(true)
      document.body.appendChild(script)
    } else {
      if (window.snap) {
        setSnapReady(true)
      } else {
        script.onload = () => setSnapReady(true)
      }
    }
  }, [])

  const verifyPayment = useCallback(async (isSilent = false) => {
    if (!isSilent) setCheckingAgain(true)
    setError('')

    try {
      let accessToken = ''
      try {
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()
        const { data: sessionData } = await supabase.auth.getSession()
        accessToken = sessionData?.session?.access_token || ''
      } catch {
        // Session fetch fallback
      }

      const url = orderId
        ? `/api/payments/status?order_id=${encodeURIComponent(orderId)}`
        : `/api/payments/status`

      const headers: Record<string, string> = { 'Cache-Control': 'no-store' }
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`
      }

      const response = await fetch(url, { cache: 'no-store', headers })

      if (response.status === 401) {
        if (retryCountRef.current < 3) {
          retryCountRef.current++
          setTimeout(() => void verifyPaymentRef.current?.(isSilent), 2000)
          return
        }
        const returnUrl = orderId ? `/payment/finish?order_id=${encodeURIComponent(orderId)}` : '/payment/finish'
        router.replace(`/login?redirect=${encodeURIComponent(returnUrl)}`)
        return
      }

      retryCountRef.current = 0
      const result = (await response.json()) as PaymentStatusData & { error?: string; notFound?: boolean }

      if (!response.ok) {
        setError(result.error || 'Gagal memverifikasi status pembayaran dari server.')
        return
      }

      if (result.notFound || (result.status === 'unknown' && result.error)) {
        setError(result.error || 'Informasi transaksi belum ditemukan.')
        setData(result)
        return
      }

      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kendala saat memeriksa status pembayaran.')
    } finally {
      setLoading(false)
      setCheckingAgain(false)
    }
  }, [orderId, router])

  useEffect(() => {
    verifyPaymentRef.current = verifyPayment
  }, [verifyPayment])

  useEffect(() => {
    void verifyPayment(false)
  }, [verifyPayment])

  // Open Midtrans Snap embedded in the current page
  const openEmbeddedSnap = useCallback((snapToken: string) => {
    if (typeof window !== 'undefined' && window.snap?.pay) {
      window.snap.pay(snapToken, {
        onSuccess: () => {
          void verifyPayment(false)
        },
        onPending: () => {
          void verifyPayment(true)
        },
        onError: () => {
          void verifyPayment(false)
        },
        onClose: () => {
          // Popup closed: perform a silent verification to check if payment actually went through
          // Do NOT mark as cancelled or paid automatically
          void verifyPayment(true)
        },
      })
    }
  }, [verifyPayment])

  // Auto-open Snap once when payment is retrieved and still pending
  useEffect(() => {
    if (!loading && data?.status === 'pending' && data.snap_token && !hasAutoOpenedRef.current) {
      hasAutoOpenedRef.current = true
      // If snap script already ready, open immediately, else wait slightly
      if (typeof window !== 'undefined' && window.snap?.pay) {
        openEmbeddedSnap(data.snap_token)
      } else {
        const timer = setTimeout(() => {
          if (data.snap_token && typeof window !== 'undefined' && window.snap?.pay) {
            openEmbeddedSnap(data.snap_token)
          }
        }, 800)
        return () => clearTimeout(timer)
      }
    }
  }, [loading, data, snapReady, openEmbeddedSnap])

  // Auto-polling for pending payments (every 5 seconds)
  useEffect(() => {
    if (!data || data.status !== 'pending') return

    const interval = setInterval(() => {
      void verifyPayment(true)
    }, 5000)

    return () => clearInterval(interval)
  }, [data, verifyPayment])

  // Handle cancellation action
  async function handleCancelPayment() {
    if (!data?.order_id || cancelling) return
    setCancelling(true)
    setError('')

    try {
      const res = await fetch('/api/subscription/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: data.order_id }),
      })
      const result = await res.json() as { success?: boolean; error?: string }

      if (!res.ok) {
        throw new Error(result.error || 'Gagal membatalkan pembayaran.')
      }

      setShowCancelModal(false)
      // Refresh status to reflect cancelled
      await verifyPayment(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kendala saat membatalkan transaksi.')
      setShowCancelModal(false)
    } finally {
      setCancelling(false)
    }
  }

  const status = data?.status || 'unknown'
  const isSuccess = status === 'success'
  const isPending = status === 'pending'
  const isFailed = status === 'failed' || status === 'cancelled' || status === 'expired'

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'radial-gradient(ellipse at 50% -20%, #172554 0%, #030712 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        color: '#f8fafc',
        fontFamily: 'inherit',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '540px',
          background: 'rgba(15, 23, 42, 0.85)',
          border: '1px solid rgba(148, 163, 184, 0.18)',
          borderRadius: '24px',
          padding: '36px 28px',
          backdropFilter: 'blur(16px)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(59, 130, 246, 0.1)',
          textAlign: 'center',
          position: 'relative',
        }}
      >
        {/* Brand Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '28px' }}>
          <Image
            src="/Fluxa-Logo.webp"
            alt="FLUXA"
            width={44}
            height={44}
            style={{ borderRadius: '10px' }}
            priority
          />
          <div style={{ textAlign: 'left' }}>
            <span style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.02em', display: 'block', color: '#ffffff' }}>
              Fluxa
            </span>
            <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 500 }}>
              Kasir &amp; Business Health AI
            </span>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div style={{ padding: '40px 0' }}>
            <Loader2
              size={42}
              color="#38bdf8"
              style={{ animation: 'spin 1s linear infinite', margin: '0 auto 16px' }}
            />
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px' }}>
              Memverifikasi Pembayaran...
            </h2>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>
              Sistem sedang memeriksa status transaksi Anda secara aman ke server Midtrans.
            </p>
          </div>
        )}

        {/* Error / Not Found / Unknown State */}
        {!loading && (error || !data || data.status === 'unknown') && !isSuccess && !isPending && !isFailed && (
          <div style={{ padding: '20px 0' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                border: '1px solid rgba(239, 68, 68, 0.3)',
              }}
            >
              <AlertCircle size={32} color="#ef4444" />
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 8px', color: '#f87171' }}>
              Status Transaksi Belum Terdeteksi
            </h2>
            <p style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: 1.6, margin: '0 0 24px', maxWidth: '440px', marginLeft: 'auto', marginRight: 'auto' }}>
              {error || 'Sistem belum menemukan data pembayaran aktif untuk akun Anda. Jika Anda baru saja menyelesaikan transfer atau scan QRIS, mohon tunggu beberapa detik lalu tekan tombol Coba Periksa Lagi.'}
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => void verifyPayment(false)}
                disabled={checkingAgain}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  borderRadius: '10px',
                  background: '#334155',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <RefreshCw size={14} className={checkingAgain ? 'animate-spin' : ''} />
                {checkingAgain ? 'Memeriksa...' : 'Coba Periksa Lagi'}
              </button>
              <Link
                href="/owner/langganan"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  borderRadius: '10px',
                  background: '#6366f1',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                Ke Halaman Langganan
              </Link>
            </div>
          </div>
        )}

        {/* Successful Payment State */}
        {!loading && data && isSuccess && (
          <div>
            <div
              style={{
                width: '68px',
                height: '68px',
                borderRadius: '50%',
                background: 'rgba(34, 197, 94, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                border: '1px solid rgba(34, 197, 94, 0.4)',
                boxShadow: '0 0 25px rgba(34, 197, 94, 0.25)',
              }}
            >
              <CheckCircle2 size={36} color="#22c55e" />
            </div>

            <span
              style={{
                display: 'inline-block',
                fontSize: '11px',
                fontWeight: 800,
                color: '#4ade80',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                marginBottom: '6px',
              }}
            >
              PEMBAYARAN TERKONFIRMASI
            </span>
            <h1 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 8px', color: '#ffffff' }}>
              Langganan Anda Telah Aktif!
            </h1>
            <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.6, margin: '0 0 24px' }}>
              Terima kasih. Pembayaran Anda telah berhasil diverifikasi oleh server. Seluruh fitur kasir, manajemen stok, dan analisis bisnis kini dapat diakses.
            </p>

            {/* Verified Transaction Details Card */}
            <div
              style={{
                background: 'rgba(30, 41, 59, 0.7)',
                borderRadius: '16px',
                padding: '16px 20px',
                marginBottom: '24px',
                textAlign: 'left',
                border: '1px solid rgba(148, 163, 184, 0.12)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px' }}>
                <span style={{ color: '#94a3b8' }}>Order ID:</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#f1f5f9' }}>{data.order_id}</span>
              </div>
              {data.plan_name && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px' }}>
                  <span style={{ color: '#94a3b8' }}>Paket Langganan:</span>
                  <span style={{ fontWeight: 700, color: '#f1f5f9' }}>{data.plan_name}</span>
                </div>
              )}
              {typeof data.amount === 'number' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px' }}>
                  <span style={{ color: '#94a3b8' }}>Total Nominal:</span>
                  <span style={{ fontWeight: 800, color: '#38bdf8' }}>{moneyFormatter.format(data.amount)}</span>
                </div>
              )}
              {data.paid_at && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px' }}>
                  <span style={{ color: '#94a3b8' }}>Waktu Pembayaran:</span>
                  <span style={{ color: '#f1f5f9' }}>{dateFormatter.format(new Date(data.paid_at))}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', marginTop: '6px', paddingTop: '8px' }}>
                <span style={{ color: '#94a3b8' }}>Status Verifikasi:</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#4ade80', fontWeight: 700 }}>
                  <ShieldCheck size={14} /> Terverifikasi Server
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <Link
                href="/owner"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '13px 20px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
                  color: '#ffffff',
                  fontSize: '14px',
                  fontWeight: 700,
                  textDecoration: 'none',
                  boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
                }}
              >
                Masuk ke Dashboard Owner <ArrowRight size={16} />
              </Link>
              <Link
                href="/owner/langganan"
                style={{
                  display: 'block',
                  fontSize: '12px',
                  color: '#94a3b8',
                  textDecoration: 'none',
                  padding: '6px',
                }}
              >
                Lihat Detail Langganan &amp; Faktur
              </Link>
            </div>
          </div>
        )}

        {/* Pending Payment State */}
        {!loading && data && isPending && (
          <div>
            <div
              style={{
                width: '68px',
                height: '68px',
                borderRadius: '50%',
                background: 'rgba(234, 179, 8, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                border: '1px solid rgba(234, 179, 8, 0.4)',
                boxShadow: '0 0 25px rgba(234, 179, 8, 0.2)',
              }}
            >
              <Clock size={36} color="#eab308" />
            </div>

            <span
              style={{
                display: 'inline-block',
                fontSize: '11px',
                fontWeight: 800,
                color: '#facc15',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                marginBottom: '6px',
              }}
            >
              MENUNGGU PEMBAYARAN
            </span>
            <h1 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 8px', color: '#ffffff' }}>
              Selesaikan Pembayaran
            </h1>
            <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.6, margin: '0 0 24px' }}>
              Jendela pembayaran Midtrans Snap terbuka di layar Anda. Jika popup tertutup, Anda dapat membukanya kembali kapan saja atau memeriksa status transaksi.
            </p>

            {/* Details Card */}
            <div
              style={{
                background: 'rgba(30, 41, 59, 0.7)',
                borderRadius: '16px',
                padding: '16px 20px',
                marginBottom: '24px',
                textAlign: 'left',
                border: '1px solid rgba(148, 163, 184, 0.12)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px' }}>
                <span style={{ color: '#94a3b8' }}>Order ID:</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#f1f5f9' }}>{data.order_id}</span>
              </div>
              {data.plan_name && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px' }}>
                  <span style={{ color: '#94a3b8' }}>Paket Langganan:</span>
                  <span style={{ fontWeight: 700, color: '#f1f5f9' }}>{data.plan_name}</span>
                </div>
              )}
              {typeof data.amount === 'number' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px' }}>
                  <span style={{ color: '#94a3b8' }}>Total yang Harus Dibayar:</span>
                  <span style={{ fontWeight: 800, color: '#eab308' }}>{moneyFormatter.format(data.amount)}</span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {data.snap_token && (
                <button
                  type="button"
                  onClick={() => openEmbeddedSnap(data.snap_token!)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '13px 20px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
                    color: '#ffffff',
                    fontSize: '14px',
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
                  }}
                >
                  <Sparkles size={16} /> Buka Pop-up Midtrans Snap
                </button>
              )}

              <button
                type="button"
                onClick={() => void verifyPayment(false)}
                disabled={checkingAgain}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '12px 20px',
                  borderRadius: '12px',
                  background: '#334155',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <RefreshCw size={15} className={checkingAgain ? 'animate-spin' : ''} />
                {checkingAgain ? 'Memeriksa ke Server...' : 'Cek Status Sekarang'}
              </button>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setShowCancelModal(true)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#f87171',
                    fontSize: '12px',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    padding: '4px',
                  }}
                >
                  Batalkan Pembayaran
                </button>
                <Link
                  href="/owner/langganan"
                  style={{
                    fontSize: '12px',
                    color: '#94a3b8',
                    textDecoration: 'none',
                    padding: '4px',
                  }}
                >
                  Kembali ke Langganan
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Failed / Cancelled / Expired State */}
        {!loading && data && isFailed && (
          <div>
            <div
              style={{
                width: '68px',
                height: '68px',
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                boxShadow: '0 0 25px rgba(239, 68, 68, 0.2)',
              }}
            >
              <XCircle size={36} color="#ef4444" />
            </div>

            <span
              style={{
                display: 'inline-block',
                fontSize: '11px',
                fontWeight: 800,
                color: '#f87171',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                marginBottom: '6px',
              }}
            >
              {status === 'expired'
                ? 'TRANSAKSI KEDALUWARSA'
                : status === 'cancelled'
                  ? 'TRANSAKSI DIBATALKAN'
                  : 'TRANSAKSI TIDAK BERHASIL'}
            </span>
            <h1 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 8px', color: '#ffffff' }}>
              {status === 'expired'
                ? 'Waktu Pembayaran Telah Habis'
                : status === 'cancelled'
                  ? 'Tagihan Pembayaran Dibatalkan'
                  : 'Pembayaran Tidak Berhasil'}
            </h1>
            <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.6, margin: '0 0 24px' }}>
              {status === 'expired'
                ? 'Sesi transaksi ini telah melewati batas waktu pembayaran. Silakan pilih paket kembali untuk membuat tagihan baru.'
                : status === 'cancelled'
                  ? 'Tagihan ini telah dibatalkan atas permintaan Anda. Anda dapat memilih paket langganan kembali kapan saja.'
                  : 'Transaksi dibatalkan atau pembayaran tidak dapat diselesaikan oleh gateway. Jangan khawatir, Anda dapat mencoba kembali dengan metode lain.'}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <Link
                href="/owner/langganan"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '13px 20px',
                  borderRadius: '12px',
                  background: '#6366f1',
                  color: '#ffffff',
                  fontSize: '14px',
                  fontWeight: 700,
                  textDecoration: 'none',
                  boxShadow: '0 4px 14px rgba(99, 102, 241, 0.3)',
                }}
              >
                <RotateCcw size={16} /> Pilih Paket &amp; Buat Tagihan Baru
              </Link>
            </div>
          </div>
        )}

        {/* Other / Unknown State */}
        {!loading && data && !isSuccess && !isPending && !isFailed && (
          <div>
            <div
              style={{
                width: '68px',
                height: '68px',
                borderRadius: '50%',
                background: 'rgba(148, 163, 184, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}
            >
              <HelpCircle size={36} color="#94a3b8" />
            </div>
            <h1 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 8px' }}>
              Status Transaksi: {status}
            </h1>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 20px' }}>
              Status transaksi ini adalah {status}. Silakan periksa kembali beberapa saat lagi.
            </p>
            <Link
              href="/owner/langganan"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                borderRadius: '10px',
                background: '#6366f1',
                color: '#ffffff',
                textDecoration: 'none',
                fontSize: '13px',
                fontWeight: 600,
              }}
            >
              Kembali ke Langganan
            </Link>
          </div>
        )}

        {/* Cancellation Confirmation Dialog */}
        {showCancelModal && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.75)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '16px',
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: '420px',
                background: '#0f172a',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '18px',
                padding: '24px',
                textAlign: 'left',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertCircle size={20} color="#f87171" />
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>
                    Batalkan Tagihan Ini?
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCancelModal(false)}
                  disabled={cancelling}
                  style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
                >
                  <X size={18} />
                </button>
              </div>

              <p style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: 1.6, margin: '0 0 16px' }}>
                Pembatalan ini hanya berlaku untuk sesi pembayaran <strong>{data?.order_id}</strong> yang sedang pending. Tindakan ini tidak membatalkan langganan aktif yang sudah berjalan. Setelah dibatalkan, Anda dapat memilih paket kembali.
              </p>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowCancelModal(false)}
                  disabled={cancelling}
                  style={{
                    padding: '9px 16px',
                    borderRadius: '8px',
                    background: '#334155',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Kembali
                </button>
                <button
                  type="button"
                  onClick={() => void handleCancelPayment()}
                  disabled={cancelling}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '9px 16px',
                    borderRadius: '8px',
                    background: '#dc2626',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {cancelling ? <Loader2 size={14} className="animate-spin" /> : null}
                  {cancelling ? 'Membatalkan...' : 'Ya, Batalkan'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function PaymentFinishPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: '100vh',
            background: '#030712',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#94a3b8',
          }}
        >
          <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      }
    >
      <PaymentFinishContent />
    </Suspense>
  )
}
