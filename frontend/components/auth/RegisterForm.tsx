'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
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
import { AnimatedBackground, AuthIntro, useAuthIntro } from './AuthVisuals'

type RegisterStep = 'form' | 'choice' | 'trial_submitted'

export default function RegisterForm() {
  const router = useRouter()
  const { phase, introSymbolRef, introNameRef, brandLogoRef, brandNameRef } = useAuthIntro()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState<RegisterStep>('form')

  const clearError = () => setError('')

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

  async function handleSelectPath(path: 'subscribe' | 'trial') {
    clearError()
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

      if (path === 'trial') {
        setStep('trial_submitted')
      } else {
        // Direct subscription: sign in automatically and redirect to subscription checkout
        const supabase = createClient()
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        })

        if (signInError) {
          // If auto sign-in has a minor hiccup, send to login with direct prompt
          router.push('/login?registered=subscribe')
        } else {
          router.push('/langganan?onboard=1')
        }
      }
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
              onClick={() => !loading && void handleSelectPath('subscribe')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  if (!loading) void handleSelectPath('subscribe')
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
                {loading ? (
                  <><LoaderCircle size={15} className="login-spinner" /> Memproses...</>
                ) : (
                  <>Pilih Paket & Bayar Sekarang <ArrowRight size={15} /></>
                )}
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
            Kembali ke landing page
          </Link>
        </section>
      )}
      <p className={`register-legal${phase === 'login' ? ' is-visible' : ''}`}>Dengan mendaftar, Anda meminta akses untuk mengelola bisnis menggunakan Fluxa.</p>
    </main>
  )
}
