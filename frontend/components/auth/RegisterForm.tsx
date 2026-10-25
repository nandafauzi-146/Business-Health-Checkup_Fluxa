'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useEffect, type FormEvent } from 'react'
import Image from 'next/image'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
  Phone,
  Rocket,
  ShieldCheck,
  Sparkles,
  UserRound,
  Zap,
} from 'lucide-react'
import { getUserFacingError } from '@/lib/user-facing-error'
import { createClient } from '@/lib/supabase/client'
import { getAbsoluteUrl } from '@/lib/site-url'
import { AnimatedBackground, AuthIntro, useAuthIntro } from './AuthVisuals'

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

type RegisterStep = 'form' | 'choice' | 'plans' | 'trial_submitted'

type PlanItem = {
  id: string
  name: string
  description: string
  price: number
  duration_days: number
  max_users: number
  features: string[]
}

const DEFAULT_PLANS: PlanItem[] = [
  {
    id: '96b79b9e-4408-4e0a-b934-51fe349c421f',
    name: 'Starter',
    description: 'Untuk usaha rintisan yang ingin pencatatan rapi dan tertata.',
    price: 49000,
    duration_days: 30,
    max_users: 1,
    features: ['Kasir praktis & pencatatan transaksi', 'Manajemen produk & stok persediaan', 'Ringkasan laporan penjualan harian'],
  },
  {
    id: '2a325a98-0b1d-42e4-ac1a-15fd13793e77',
    name: 'Growth',
    description: 'Untuk bisnis berkembang dengan insight diagnosis kesehatan AI.',
    price: 99000,
    duration_days: 30,
    max_users: 3,
    features: ['Semua fitur Starter', 'Diagnosis Kesehatan Bisnis berbantu AI', 'FluxAI Chat Assistant', 'Analisis arus kas & piutang'],
  },
  {
    id: '0596ced8-c02c-4707-bdae-3cf680be6d17',
    name: 'Pro Business',
    description: 'Untuk operasional lengkap dengan multi-user dan prioritas.',
    price: 199000,
    duration_days: 30,
    max_users: 10,
    features: ['Semua fitur Growth', 'Dukungan hingga 10 pengguna tim', 'Laporan keuangan terperinci', 'Prioritas dukungan pelanggan'],
  },
]

const money = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })

interface RegisterFormProps {
  initialStep?: RegisterStep
  initialEmail?: string
  initialName?: string
  initialPhone?: string
  initialError?: string
  isGoogleUser?: boolean
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  )
}

export default function RegisterForm({
  initialStep = 'form',
  initialEmail = '',
  initialName = '',
  initialPhone = '',
  initialError = '',
  isGoogleUser = false,
}: RegisterFormProps) {
  const router = useRouter()
  const { phase, introSymbolRef, introNameRef, brandLogoRef, brandNameRef } = useAuthIntro()
  const [fullName, setFullName] = useState(initialName)
  const [email, setEmail] = useState(initialEmail)
  const [phone, setPhone] = useState(initialPhone)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState(initialError)
  const [step, setStep] = useState<RegisterStep>(initialStep)
  const [plans, setPlans] = useState<PlanItem[]>([])
  const [loadingPlans, setLoadingPlans] = useState(false)
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)

  // Load Midtrans Snap script dynamically for direct popup during registration
  useEffect(() => {
    const clientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || 'SB-Mid-client-Mid-client-Y0m-zSVhzrH2fZwg'
    const snapScriptUrl = 'https://app.sandbox.midtrans.com/snap/snap.js'
    const scriptId = 'midtrans-snap-script'
    let script = document.getElementById(scriptId) as HTMLScriptElement | null
    if (!script) {
      script = document.createElement('script')
      script.id = scriptId
      script.src = snapScriptUrl
      script.setAttribute('data-client-key', clientKey)
      script.async = true
      document.body.appendChild(script)
    }
  }, [])

  const clearError = () => setError('')

  async function handleGoogleSignUp() {
    clearError()
    setGoogleLoading(true)

    try {
      const supabase = createClient()
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: getAbsoluteUrl('/auth/callback?source=register&role=owner'),
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      })

      if (oauthError) {
        throw oauthError
      }
    } catch (err: any) {
      console.error('Google sign-up error:', err)
      const rawMsg = err?.message || err?.msg || String(err || '')
      if (/provider is not enabled|unsupported provider/i.test(rawMsg)) {
        setError('Autentikasi Google belum diaktifkan di Supabase Dashboard. Buka menu Authentication > Providers > Google untuk mengaktifkannya.')
      } else {
        setError(getUserFacingError(err, 'Pendaftaran dengan akun Google belum dapat diproses. Coba lagi.'))
      }
      setGoogleLoading(false)
    }
  }

  const validateForm = () => {
    if (fullName.trim().length < 2) {
      setError('Nama lengkap minimal 2 karakter.')
      return false
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Masukkan alamat email yang valid.')
      return false
    }

    if (password.length < 8 || password.length > 72) {
      setError('Kata sandi harus terdiri dari 8–72 karakter.')
      return false
    }

    return true
  }

  function handleFormContinue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    clearError()

    if (!validateForm()) {
      return
    }

    // Move to choice screen
    setStep('choice')
  }

  async function loadPlans() {
    setLoadingPlans(true)
    try {
      const res = await fetch('/api/subscription/plans')
      const json = await res.json() as { plans?: PlanItem[] }
      if (json.plans && json.plans.length > 0) {
        setPlans(json.plans)
      } else {
        setPlans(DEFAULT_PLANS)
      }
    } catch {
      setPlans(DEFAULT_PLANS)
    } finally {
      setLoadingPlans(false)
    }
  }

  function handleOpenPlans() {
    clearError()
    setStep('plans')
    if (plans.length === 0) {
      void loadPlans()
    }
  }

  async function handleSelectPlanAndPay(plan: PlanItem) {
    clearError()

    if (!phone || phone.trim().length < 8) {
      setError('Mohon masukkan nomor handphone / WhatsApp yang valid untuk penerbitan tagihan pembayaran Midtrans.')
      return
    }

    setLoading(true)
    setSelectedPlanId(plan.id)

    try {
      let accessToken = ''

      // 1. If not a Google OAuth user, register the account and log in
      if (!isGoogleUser) {
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            full_name: fullName.trim(),
            email: email.trim().toLowerCase(),
            phone: phone.trim() || null,
            password,
            registration_path: 'subscribe',
          }),
        })

        const result: { error?: string; success?: boolean; registrationPath?: string } =
          await response.json().catch(() => ({}))

        if (!response.ok) {
          const errMsg = String(result?.error || '').toLowerCase()
          if (!errMsg.includes('terdaftar') && !errMsg.includes('already registered')) {
            throw new Error(result.error || 'Pendaftaran belum dapat diproses.')
          }
        }

        const supabase = createClient()
        if (password) {
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: email.trim().toLowerCase(),
            password,
          })
          if (signInError) {
            throw new Error(signInError.message || 'Gagal masuk ke akun pendaftaran.')
          }
          if (signInData?.session?.access_token) {
            accessToken = signInData.session.access_token
          }
        }
      } else {
        const supabase = createClient()
        const { data: sessionData } = await supabase.auth.getSession()
        if (sessionData?.session?.access_token) {
          accessToken = sessionData.session.access_token
        }
      }

      // 2. Create Midtrans Snap transaction with customer details (Nama, Email, No HP)
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`
      }

      const subRes = await fetch('/api/subscription', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          planId: plan.id,
          name: fullName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
        }),
      })

      const subData = (await subRes.json()) as {
        orderId?: string
        snapToken?: string
        paymentUrl?: string
        error?: string
      }

      if (!subRes.ok) {
        throw new Error(subData.error || 'Transaksi pembayaran belum dapat dibuat oleh Midtrans.')
      }

      // 3. Open Midtrans Snap popup directly!
      const snapPay = typeof window !== 'undefined' ? window.snap?.pay : undefined
      if (subData.snapToken && snapPay) {
        snapPay(subData.snapToken, {
          onSuccess: (res: unknown) => {
            const resObj = res as Record<string, unknown> | undefined
            const oid = typeof resObj?.order_id === 'string' ? resObj.order_id : subData.orderId
            router.push(`/payment/finish?order_id=${encodeURIComponent(oid || '')}&status=success`)
          },
          onPending: (res: unknown) => {
            const resObj = res as Record<string, unknown> | undefined
            const oid = typeof resObj?.order_id === 'string' ? resObj.order_id : subData.orderId
            router.push(`/payment/finish?order_id=${encodeURIComponent(oid || '')}&status=pending`)
          },
          onError: (res: unknown) => {
            const resObj = res as Record<string, unknown> | undefined
            const oid = typeof resObj?.order_id === 'string' ? resObj.order_id : subData.orderId
            router.push(`/payment/finish?order_id=${encodeURIComponent(oid || '')}&status=failed`)
          },
          onClose: () => {
            if (subData.orderId) {
              router.push(`/payment/finish?order_id=${encodeURIComponent(subData.orderId)}`)
            } else {
              router.push(`/owner/langganan?onboard=1&planId=${plan.id}`)
            }
          },
        })
      } else if (subData.paymentUrl) {
        window.location.assign(subData.paymentUrl)
      } else {
        router.push(`/owner/langganan?onboard=1&planId=${plan.id}`)
      }
    } catch (registrationError) {
      console.error('Registration and checkout processing failed.', registrationError)
      setError(getUserFacingError(registrationError, 'Pendaftaran belum dapat diproses. Silakan periksa data dan coba lagi.'))
    } finally {
      setLoading(false)
      setSelectedPlanId(null)
    }
  }

  async function handleSelectPath(path: 'subscribe' | 'trial') {
    clearError()

    if (path === 'subscribe') {
      handleOpenPlans()
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || null,
          password,
          registration_path: path,
        }),
      })

      const result: { error?: string; success?: boolean; registrationPath?: string } =
        await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(result.error || 'Pendaftaran belum dapat diproses.')
      }

      setStep('trial_submitted')
    } catch (registrationError) {
      console.error('Registration processing failed.', registrationError)
      setError(getUserFacingError(registrationError, 'Pendaftaran belum dapat diproses. Silakan periksa data dan coba lagi.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login-bg register-page">
      <AnimatedBackground />
      {phase !== 'login' && (
        <AuthIntro phase={phase} symbolRef={introSymbolRef} nameRef={introNameRef} />
      )}

      {/* Screen 3: Free Trial Request Submitted */}
      {step === 'trial_submitted' && (
        <section
          className={`login-card register-card is-${phase}`}
          aria-live="polite"
          aria-hidden={phase !== 'login'}
          inert={phase !== 'login'}
        >
          <header className="login-brand login-stagger">
            <div className="login-brand-logo" ref={brandLogoRef}>
              <Image src="/Fluxa-Logo.webp" alt="" aria-hidden="true" width={42} height={42} priority />
            </div>
            <div>
              <p className="login-brand-name" ref={brandNameRef}>Fluxa</p>
              <p className="login-brand-tagline">Kasir + Business Health AI</p>
            </div>
          </header>
          <div className="login-welcome register-welcome">
            <span className="register-eyebrow">PENGAJUAN TRIAL DITERIMA</span>
            <h1>Terima kasih, {fullName.trim()}.</h1>
            <p>Pengajuan akun Free Trial Anda sedang menunggu persetujuan Super Admin. Masa trial 7 hari akan dimulai setelah akun disetujui.</p>
          </div>
          <div className="register-notice login-stagger">
            <ShieldCheck size={17} aria-hidden="true" />
            <span>Informasi persetujuan akan kami kirimkan ke <strong>{email}</strong>.</span>
          </div>
          <Link className="login-submit register-back-link login-stagger" href="/">
            Kembali ke Beranda <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </section>
      )}

      {/* Screen 2: Choice between Subscribe Now and Free Trial */}
      {step === 'choice' && (
        <section
          className={`login-card register-card is-${phase}`}
          aria-labelledby="choice-title"
          aria-hidden={phase !== 'login'}
          inert={phase !== 'login'}
          style={{ width: 'min(100%, 520px)' }}
        >
          <header className="login-brand login-stagger">
            <div className="login-brand-logo" ref={brandLogoRef}>
              <Image src="/fluxa-logo-glass.png" alt="" aria-hidden="true" width={42} height={42} priority />
            </div>
            <div>
              <p className="login-brand-name" ref={brandNameRef}>Fluxa</p>
              <p className="login-brand-tagline">Kasir + Business Health AI</p>
            </div>
          </header>

          <div className="login-welcome register-welcome">
            <span className="register-eyebrow">PILIH JALUR AKSES</span>
            <h1 id="choice-title">Bagaimana Anda ingin memulai?</h1>
            <p>Pilih jalur akses yang paling sesuai untuk bisnis Anda, {fullName.trim()}.</p>
          </div>

          {error && <p className="login-feedback login-feedback-error" role="alert">{error}</p>}

          <div className="register-choice-wrap">
            {/* Card 1: Subscribe Now */}
            <div
              className="register-choice-card is-featured"
              onClick={() => !loading && handleOpenPlans()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  if (!loading) handleOpenPlans()
                }
              }}
            >
              <div className="register-choice-header">
                <div className="register-choice-title">
                  <Rocket size={18} color="#818cf8" />
                  <span>Langganan Sekarang</span>
                </div>
                <span className="register-choice-badge badge-instant">
                  <Zap size={11} /> Instan & Otomatis
                </span>
              </div>
              <p className="register-choice-desc">
                Langsung pilih paket langganan dan selesaikan pembayaran. Akun Anda langsung aktif otomatis tanpa antrean verifikasi manual.
              </p>
              <ul className="register-choice-features">
                <li><Check size={13} /> Akses penuh instan setelah pembayaran terkonfirmasi</li>
                <li><Check size={13} /> Pembayaran aman via Midtrans (QRIS, VA Bank, dsb)</li>
                <li><Check size={13} /> Tanpa menunggu persetujuan manual Super Admin</li>
              </ul>
              <div className="register-choice-action action-instant">
                Pilih Paket & Bayar Sekarang <ArrowRight size={15} />
              </div>
            </div>

            {/* Card 2: Use Free Trial */}
            <div
              className="register-choice-card"
              onClick={() => !loading && void handleSelectPath('trial')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  if (!loading) void handleSelectPath('trial')
                }
              }}
            >
              <div className="register-choice-header">
                <div className="register-choice-title">
                  <Sparkles size={18} color="#69dfff" />
                  <span>Gunakan Free Trial</span>
                </div>
                <span className="register-choice-badge badge-trial">
                  <Clock size={11} /> Gratis 7 Hari
                </span>
              </div>
              <p className="register-choice-desc">
                Ajukan masa uji coba gratis selama 7 hari. Permohonan Anda akan ditinjau dan diverifikasi terlebih dahulu oleh Super Admin.
              </p>
              <ul className="register-choice-features">
                <li><Check size={13} /> Gratis seluruh fitur operasional selama 7 hari</li>
                <li><Clock size={13} /> Memerlukan verifikasi & persetujuan Super Admin</li>
                <li><ShieldCheck size={13} /> Masa trial dimulai setelah disetujui</li>
              </ul>
              <div className="register-choice-action action-trial">
                {loading ? (
                  <><LoaderCircle size={15} className="login-spinner" /> Memproses...</>
                ) : (
                  <>Ajukan Free Trial 7 Hari <ArrowRight size={15} /></>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            className="auth-back-link"
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', margin: '18px auto 0' }}
            onClick={() => {
              clearError()
              setStep('form')
            }}
            disabled={loading}
          >
            <ArrowLeft size={15} aria-hidden="true" />
            Ubah data pendaftaran
          </button>
        </section>
      )}

      {/* Screen 2.5: Select Available Subscription Plans */}
      {step === 'plans' && (
        <section
          className={`login-card register-card is-${phase}`}
          aria-labelledby="plans-title"
          aria-hidden={phase !== 'login'}
          inert={phase !== 'login'}
          style={{ width: 'min(100%, 880px)' }}
        >
          <header className="login-brand login-stagger">
            <div className="login-brand-logo" ref={brandLogoRef}>
              <Image src="/Fluxa-Logo.webp" alt="" aria-hidden="true" width={42} height={42} priority />
            </div>
            <div>
              <p className="login-brand-name" ref={brandNameRef}>Fluxa</p>
              <p className="login-brand-tagline">Kasir + Business Health AI</p>
            </div>
          </header>

          <div className="login-welcome register-welcome">
            <span className="register-eyebrow">PILIH PAKET LANGGANAN</span>
            <h1 id="plans-title">Pilih Paket Terbaik untuk Usaha Anda</h1>
            <p>Pilih paket langganan untuk bisnis Anda, {fullName.trim()}. Setelah memilih paket, pop-up pembayaran Midtrans Sandbox akan langsung terbuka.</p>
          </div>

          {error && <p className="login-feedback login-feedback-error" role="alert">{error}</p>}

          {/* Customer Contact Details (Sent to Midtrans API) */}
          <div style={{
            background: 'rgba(18, 29, 49, 0.75)',
            border: '1px solid rgba(116, 151, 226, 0.18)',
            borderRadius: 14,
            padding: '14px 18px',
            marginBottom: 16,
            textAlign: 'left',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#f8fafc' }}>
                Data Pemesan untuk Tagihan Midtrans
              </span>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                Nama, Email &amp; WhatsApp
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: 4 }}>
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nama Lengkap"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    background: 'rgba(255, 255, 255, 0.06)',
                    color: '#ffffff',
                    fontSize: '13px',
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: 4 }}>
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@email.com"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    background: 'rgba(255, 255, 255, 0.06)',
                    color: '#ffffff',
                    fontSize: '13px',
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: 4 }}>
                  No. WhatsApp / HP {(!phone || phone.trim() === '') && <span style={{ color: '#f87171' }}>* (Wajib)</span>}
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="08xxxxxxxxxx"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: (!phone || phone.trim() === '') ? '1.5px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.12)',
                    background: 'rgba(255, 255, 255, 0.06)',
                    color: '#ffffff',
                    fontSize: '13px',
                  }}
                />
              </div>
            </div>
          </div>

          {loadingPlans ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0', gap: 10, color: '#94a3b8' }}>
              <LoaderCircle size={22} className="login-spinner" />
              <span>Memuat paket langganan aktif...</span>
            </div>
          ) : (
            <div className="register-plans-grid">
              {(plans.length > 0 ? plans : DEFAULT_PLANS).map((plan) => {
                const isGrowth = plan.name.toLowerCase().includes('growth')
                const isThisLoading = loading && selectedPlanId === plan.id
                return (
                  <div
                    key={plan.id}
                    className={`register-plan-card ${isGrowth ? 'is-featured' : ''}`}
                  >
                    {isGrowth && <span className="register-plan-badge">Rekomendasi</span>}
                    <div>
                      <h3 className="register-plan-name">{plan.name}</h3>
                      <p className="register-plan-desc">{plan.description}</p>
                      <div className="register-plan-price-wrap">
                        <span className="register-plan-price">{money.format(plan.price)}</span>
                        <span className="register-plan-duration">/ {plan.duration_days} hari</span>
                      </div>
                      <div className="register-plan-meta">
                        <UserRound size={13} />
                        <span>Kapasitas {plan.max_users} pengguna tim</span>
                      </div>
                      <ul className="register-plan-features">
                        {(plan.features || []).map((feat, idx) => (
                          <li key={idx}>
                            <Check size={13} />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <button
                      type="button"
                      className="register-plan-btn"
                      onClick={() => void handleSelectPlanAndPay(plan)}
                      disabled={loading}
                    >
                      {isThisLoading ? (
                        <><LoaderCircle size={15} className="login-spinner" /> Memproses...</>
                      ) : (
                        <>Pilih & Bayar Paket Ini <ArrowRight size={14} /></>
                      )}
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          <button
            type="button"
            className="register-plans-back"
            onClick={() => {
              clearError()
              setStep('choice')
            }}
            disabled={loading}
          >
            <ArrowLeft size={15} /> Kembali ke Pilihan Akses
          </button>
        </section>
      )}

      {/* Screen 1: Registration Input Form */}
      {step === 'form' && (
        <section
          className={`login-card register-card is-${phase}`}
          aria-labelledby="register-title"
          aria-hidden={phase !== 'login'}
          inert={phase !== 'login'}
        >
          <header className="login-brand login-stagger">
            <div className="login-brand-logo" ref={brandLogoRef}>
              <Image src="/Fluxa-Logo.webp" alt="" aria-hidden="true" width={42} height={42} priority />
            </div>
            <div>
              <p className="login-brand-name" ref={brandNameRef}>Fluxa</p>
              <p className="login-brand-tagline">Kasir + Business Health AI</p>
            </div>
          </header>

          <div className="login-welcome register-welcome">
            <span className="register-eyebrow">MULAI BERSAMA FLUXA</span>
            <h1 id="register-title">Buat akun bisnis Anda.</h1>
            <p>Daftar sekarang untuk memilih paket langganan instan atau ajukan free trial 7 hari.</p>
          </div>

          <form className="login-form register-form" onSubmit={handleFormContinue}>
            <div className="login-field login-stagger">
              <label htmlFor="register-name">Nama lengkap</label>
              <div className="login-input-wrap">
                <UserRound size={17} aria-hidden="true" />
                <input
                  id="register-name"
                  autoCapitalize="words"
                  autoComplete="name"
                  maxLength={120}
                  required
                  value={fullName}
                  onChange={(event) => {
                    setFullName(event.target.value)
                    clearError()
                  }}
                  placeholder="Nama Anda"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="login-field login-stagger">
              <label htmlFor="register-email">Alamat email</label>
              <div className="login-input-wrap">
                <Mail size={17} aria-hidden="true" />
                <input
                  id="register-email"
                  type="email"
                  autoCapitalize="none"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value)
                    clearError()
                  }}
                  placeholder="nama@email.com"
                  spellCheck={false}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="login-field login-stagger">
              <label htmlFor="register-phone">Nomor telepon <span className="register-optional">(opsional)</span></label>
              <div className="login-input-wrap">
                <Phone size={17} aria-hidden="true" />
                <input
                  id="register-phone"
                  type="tel"
                  autoComplete="tel"
                  maxLength={32}
                  value={phone}
                  onChange={(event) => {
                    setPhone(event.target.value)
                    clearError()
                  }}
                  placeholder="08xxxxxxxxxx"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="login-field login-stagger">
              <label htmlFor="register-password">Kata sandi</label>
              <div className="login-input-wrap">
                <LockKeyhole size={17} aria-hidden="true" />
                <input
                  id="register-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={72}
                  required
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value)
                    clearError()
                  }}
                  placeholder="Minimal 8 karakter"
                  disabled={loading}
                />
                <button
                  className="login-password-toggle"
                  type="button"
                  onClick={(event) => {
                    event.preventDefault()
                    setShowPassword((visible) => !visible)
                  }}
                  aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                  disabled={loading}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <div className="register-divider login-stagger" role="separator" aria-label="atau daftar dengan akun Google">
              <span className="register-divider-line" />
              <span className="register-divider-text">atau</span>
              <span className="register-divider-line" />
            </div>

            <button
              type="button"
              className="register-google-btn login-stagger"
              onClick={handleGoogleSignUp}
              disabled={loading || googleLoading}
              aria-label="Daftar dengan akun Google"
            >
              {googleLoading ? (
                <>
                  <LoaderCircle size={17} className="login-spinner" aria-hidden="true" />
                  <span>Menghubungkan ke Google...</span>
                </>
              ) : (
                <>
                  <GoogleIcon />
                  <span>Daftar dengan Akun Google</span>
                </>
              )}
            </button>

            {error && <p className="login-feedback login-feedback-error" role="alert">{error}</p>}
            <button className="login-submit register-submit login-stagger" type="submit" disabled={loading}>
              Lanjutkan ke Pilihan Akses <ArrowRight size={17} />
            </button>
          </form>

          <div className="register-notice login-stagger">
            <ShieldCheck size={16} aria-hidden="true" />
            <p>Tersedia pilihan Langganan Langsung (langsung aktif) atau Free Trial 7 Hari (verifikasi Super Admin).</p>
          </div>
          <p className="login-register-prompt login-stagger">Sudah punya akun? <Link href="/login">Masuk di sini</Link></p>
          <Link className="auth-back-link login-stagger" href="/">
            <ArrowLeft size={15} aria-hidden="true" />
            Beranda
          </Link>
        </section>
      )}
      <p className={`register-legal${phase === 'login' ? ' is-visible' : ''}`}>Dengan mendaftar, Anda meminta akses untuk mengelola bisnis menggunakan Fluxa.</p>
    </main>
  )
}
