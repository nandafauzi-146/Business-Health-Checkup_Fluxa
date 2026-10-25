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
  ExternalLink,
  HelpCircle,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  XCircle,
} from 'lucide-react'

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

  // Read order_id from various possible Midtrans query parameter names
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
  const retryCountRef = useRef(0)
  const verifyPaymentRef = useRef<((isSilent?: boolean) => Promise<void>) | null>(null)

  const verifyPaymentRef = useRef<(isSilent?: boolean) => Promise<void>>(() => Promise.resolve())

  const verifyPayment = useCallback(async (isSilent = false) => {
    if (!isSilent) setCheckingAgain(true)
    setError('')

    try {
      // Try to get access token from Supabase session (works right after registration)
      let accessToken = ''
      try {
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()
        const { data: sessionData } = await supabase.auth.getSession()
        accessToken = sessionData?.session?.access_token || ''
      } catch {
        // Session fetch failed, will rely on cookie-based auth
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
        // Try to wait for session to propagate, retry up to 3 times with delay
        if (retryCountRef.current < 3) {
          retryCountRef.current++
          setTimeout(() => void verifyPaymentRef.current?.(isSilent), 2000)
          return
        }
        // After retries, redirect to login with return URL
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

  // Auto-polling for pending payments (every 5 seconds)
  useEffect(() => {
    if (!data || data.status !== 'pending') return

    const interval = setInterval(() => {
      void verifyPayment(true)
    }, 5000)

    return () => clearInterval(interval)
  }, [data, verifyPayment])

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
          background: 'rgba(15, 23, 42, 0.82)',
          border: '1px solid rgba(148, 163, 184, 0.18)',
          borderRadius: '24px',
          padding: '36px 28px',
          backdropFilter: 'blur(16px)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(59, 130, 246, 0.1)',
          textAlign: 'center',
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
              <Link
                href="/owner"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  borderRadius: '10px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                Dashboard
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
              Menunggu Konfirmasi Transfer
            </h1>
            <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.6, margin: '0 0 24px' }}>
              Transaksi Anda telah tercatat. Jika Anda telah mentransfer via Virtual Account atau scan QRIS, sistem akan otomatis memperbarui status Anda dalam beberapa saat.
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
              <button
                type="button"
                onClick={() => void verifyPayment(false)}
                disabled={checkingAgain}
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
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <RefreshCw size={16} className={checkingAgain ? 'animate-spin' : ''} />
                {checkingAgain ? 'Memeriksa ke Server...' : 'Cek Status Sekarang'}
              </button>

              {data.snap_url && (
                <a
                  href={data.snap_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '12px 20px',
                    borderRadius: '12px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    color: '#e2e8f0',
                    fontSize: '13px',
                    fontWeight: 600,
                    textDecoration: 'none',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                  }}
                >
                  <ExternalLink size={15} /> Buka Halaman Pembayaran Midtrans
                </a>
              )}

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
                Kembali ke Halaman Langganan
              </Link>
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
              {status === 'expired' ? 'TRANSAKSI KEDALUWARSA' : 'TRANSAKSI DIBATALKAN / GAGAL'}
            </span>
            <h1 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 8px', color: '#ffffff' }}>
              {status === 'expired'
                ? 'Waktu Pembayaran Telah Habis'
                : 'Pembayaran Tidak Berhasil'}
            </h1>
            <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.6, margin: '0 0 24px' }}>
              {status === 'expired'
                ? 'Sesi transaksi ini telah melewati batas waktu pembayaran. Silakan pilih paket kembali untuk membuat tagihan baru.'
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
