'use client'

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type FormEvent, type RefObject } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  ArrowLeft,
  BarChart3,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
  ShoppingCart,
  Sparkles,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { UserRole } from '@/lib/supabase/types'

function isUserRole(role: unknown): role is UserRole {
  return role === 'kasir' || role === 'admin' || role === 'owner' || role === 'super_admin'
}

const particles = [
  { x: '12%', y: '23%', delay: '-2s', size: 4 },
  { x: '21%', y: '69%', delay: '-7s', size: 3 },
  { x: '32%', y: '15%', delay: '-4s', size: 2 },
  { x: '38%', y: '83%', delay: '-9s', size: 4 },
  { x: '62%', y: '12%', delay: '-5s', size: 3 },
  { x: '72%', y: '79%', delay: '-3s', size: 2 },
  { x: '84%', y: '25%', delay: '-8s', size: 4 },
  { x: '91%', y: '59%', delay: '-6s', size: 3 },
  { x: '8%', y: '52%', delay: '-1s', size: 2 },
  { x: '78%', y: '47%', delay: '-10s', size: 2 },
  { x: '53%', y: '91%', delay: '-4s', size: 3 },
  { x: '94%', y: '82%', delay: '-7s', size: 2 },
]

function AnimatedBackground() {
  return (
    <div className="login-ambient" aria-hidden="true">
      <div className="login-light login-light-cyan" />
      <div className="login-light login-light-violet" />
      <div className="login-orb login-orb-large" />
      <div className="login-orb login-orb-left" />
      <div className="login-orb login-orb-small" />
      <div className="login-wave login-wave-back" />
      <div className="login-wave login-wave-front" />
      {particles.map((particle, index) => (
        <span
          className="login-particle"
          key={index}
          style={{
            left: particle.x,
            top: particle.y,
            width: particle.size,
            height: particle.size,
            animationDelay: particle.delay,
          }}
        />
      ))}
      <svg className="login-orbit" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="fluxa-orbit-gradient" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#13dfff" stopOpacity=".08" />
            <stop offset="48%" stopColor="#20bcff" stopOpacity=".7" />
            <stop offset="100%" stopColor="#a855f7" stopOpacity=".45" />
          </linearGradient>
          <filter id="fluxa-orbit-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <path id="fluxa-orbit-path" d="M 284 520 C 390 250, 1038 190, 1164 380 C 1280 554, 608 759, 368 578 C 267 502, 359 387, 539 320" />
        </defs>
        <use href="#fluxa-orbit-path" fill="none" stroke="url(#fluxa-orbit-gradient)" strokeWidth="1.2" />
        <circle r="5" fill="#62e9ff" filter="url(#fluxa-orbit-glow)">
          <animateMotion dur="22s" repeatCount="indefinite" rotate="auto">
            <mpath href="#fluxa-orbit-path" />
          </animateMotion>
        </circle>
        <circle r="3" fill="#b98aff" opacity=".9" filter="url(#fluxa-orbit-glow)">
          <animateMotion dur="22s" begin="-11s" repeatCount="indefinite" rotate="auto">
            <mpath href="#fluxa-orbit-path" />
          </animateMotion>
        </circle>
      </svg>
    </div>
  )
}

function LoginIntro({
  phase,
  symbolRef,
  nameRef,
}: {
  phase: 'intro' | 'transition'
  symbolRef: RefObject<HTMLDivElement | null>
  nameRef: RefObject<HTMLParagraphElement | null>
}) {
  return (
    <div className={`login-intro-overlay${phase === 'transition' ? ' is-transitioning' : ''}`} aria-hidden="true">
      <div className="login-intro-particles">
        {Array.from({ length: 8 }, (_, index) => (
          <span
            className="login-intro-particle"
            key={index}
            style={{ '--particle-index': index } as CSSProperties & { '--particle-index': number }}
          />
        ))}
      </div>
      <div className="login-intro-brand">
        <div className="login-intro-mark">
          <div className="login-intro-symbol" ref={symbolRef}>
            <Image src="/Fluxa-Logo.webp" alt="" aria-hidden="true" width={140} height={140} priority />
          </div>
        </div>
        <div className="login-intro-copy">
          <p className="login-brand-name" ref={nameRef}>Fluxa</p>
        </div>
      </div>
    </div>
  )
}

function FeatureHighlights() {
  const features = [
    { icon: ShoppingCart, text: 'POS Kasir cepat' },
    { icon: BarChart3, text: 'Business Health AI' },
    { icon: Sparkles, text: 'Rekomendasi aktif' },
  ]

  return (
    <div className="login-features login-stagger" aria-label="Fitur Fluxa">
      {features.map(({ icon: Icon, text }) => (
        <div className="login-feature" key={text}>
          <Icon size={15} aria-hidden="true" />
          <span>{text}</span>
        </div>
      ))}
    </div>
  )
}

export default function LoginForm({ registrationStatus }: { registrationStatus?: 'pending' | 'rejected' | null }) {
  const [phase, setPhase] = useState<'intro' | 'transition' | 'login'>('intro')
  const introSymbolRef = useRef<HTMLDivElement>(null)
  const introNameRef = useRef<HTMLParagraphElement>(null)
  const loginLogoRef = useRef<HTMLDivElement>(null)
  const loginNameRef = useRef<HTMLParagraphElement>(null)
  const emailInputRef = useRef<HTMLInputElement>(null)
  const passwordInputRef = useRef<HTMLInputElement>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [errorField, setErrorField] = useState<'email' | 'password' | 'credentials' | null>(null)
  const [success, setSuccess] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const clearFeedback = () => {
    setError('')
    setErrorField(null)
    setSuccess('')
  }

  const focusField = (field: 'email' | 'password') => {
    if (field === 'email') {
      emailInputRef.current?.focus()
      emailInputRef.current?.select()
      return
    }

    passwordInputRef.current?.focus()
    passwordInputRef.current?.select()
  }

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const reducedMotionTimer = window.setTimeout(() => setPhase('login'), 0)
      return () => window.clearTimeout(reducedMotionTimer)
    }

    const introTimer = window.setTimeout(() => setPhase('transition'), 1950)
    return () => window.clearTimeout(introTimer)
  }, [])

  useLayoutEffect(() => {
    if (phase !== 'transition') return

    const introSymbol = introSymbolRef.current?.querySelector('img')
    const introMark = introSymbolRef.current
    const introName = introNameRef.current
    const loginLogo = loginLogoRef.current?.querySelector('img')
    const card = loginLogo?.closest<HTMLElement>('.login-card')
    const transitionAnimations: Animation[] = []
    const finishTimer = window.setTimeout(() => setPhase('login'), 1000)

    if (introSymbol && introMark && introName && loginLogo && card) {
      const cardRect = card.getBoundingClientRect()
      const targetRect = loginLogo.getBoundingClientRect()
      const cardTransform = getComputedStyle(card).transform
      const matrix = cardTransform === 'none' ? new DOMMatrix() : new DOMMatrix(cardTransform)
      const [originX, originY] = getComputedStyle(card).transformOrigin
        .split(' ')
        .map((value) => Number.parseFloat(value))
      const scaleX = Math.hypot(matrix.a, matrix.b) || 1
      const scaleY = Math.hypot(matrix.c, matrix.d) || 1
      const layoutLeft = cardRect.left - originX - matrix.e + scaleX * originX
      const layoutTop = cardRect.top - originY - matrix.f + scaleY * originY
      const targetCenterX = targetRect.left + targetRect.width / 2
      const targetCenterY = targetRect.top + targetRect.height / 2
      const finalCenterX = layoutLeft + originX
        + (targetCenterX - layoutLeft - originX - matrix.e) / scaleX
      const finalCenterY = layoutTop + originY
        + (targetCenterY - layoutTop - originY - matrix.f) / scaleY
      const sourceRect = introSymbol.getBoundingClientRect()
      const x = finalCenterX - sourceRect.left - sourceRect.width / 2
      const y = finalCenterY - sourceRect.top - sourceRect.height / 2
      const targetWidth = targetRect.width / scaleX
      const targetHeight = targetRect.height / scaleY
      const angle = Math.atan2(y, x)
      const destination = `translate(${x}px, ${y}px) scale(${targetWidth / sourceRect.width}, ${targetHeight / sourceRect.height})`

      introMark.style.setProperty('--login-logo-trail-angle', `${angle}rad`)
      introMark.classList.add('is-trailing')
      const logoAnimation = introSymbol.animate(
        [
          { transform: 'translate(0, 0) scale(1)', opacity: 1 },
          { transform: destination, opacity: 1 },
        ],
        { duration: 800, easing: 'cubic-bezier(.2, .75, .25, 1)', fill: 'forwards' },
      )
      transitionAnimations.push(logoAnimation)
      logoAnimation.onfinish = () => setPhase('login')
      transitionAnimations.push(introName.animate(
        [
          { opacity: 1, transform: 'translateY(0)' },
          { opacity: 0, transform: 'translateY(-4px)' },
        ],
        { duration: 320, easing: 'ease-out', fill: 'forwards' },
      ))

      return () => {
        window.clearTimeout(finishTimer)
        transitionAnimations.forEach((animation) => animation.cancel())
        introMark.classList.remove('is-trailing')
        introMark.style.removeProperty('--login-logo-trail-angle')
      }
    }

    return () => window.clearTimeout(finishTimer)
  }, [phase])

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalizedEmail = email.trim()

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Masukkan alamat email yang valid.')
      setErrorField('email')
      setSuccess('')
      focusField('email')
      return
    }
    if (!password) {
      setError('Masukkan kata sandi Anda.')
      setErrorField('password')
      setSuccess('')
      focusField('password')
      return
    }

    setLoading(true)
    clearFeedback()

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      })

      if (signInError) {
        setError('Email atau kata sandi tidak valid. Coba lagi.')
        setErrorField('credentials')
        return
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        setError('Sesi login tidak dapat diverifikasi. Silakan coba lagi.')
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, approval_status, registration_path')
        .eq('id', user.id)
        .single()

      if (profileError || !profile) {
        console.error('Profile query error:', profileError)
        console.error('User ID:', user.id)
        console.error('Profile data:', profile)

        await supabase.auth.signOut()

        if (profileError?.message?.includes('approval_status')) {
          setError('Sistem persetujuan belum siap. Minta administrator menerapkan migrasi database terbaru, lalu coba masuk kembali.')
        } else {
          setError('Profil akses akun tidak dapat dibaca. Pastikan profil akun tersedia dan hubungi administrator.')
        }

        return
      }

      if (
        profile.role === 'owner' &&
        profile.approval_status === 'pending' &&
        profile.registration_path === 'subscribe'
      ) {
        setSuccess('Login berhasil. Mengarahkan Anda ke pembayaran langganan...')
        router.replace('/owner/langganan?onboard=1')
        router.refresh()
        return
      }

      if (profile.approval_status !== 'approved') {
        await supabase.auth.signOut()

        if (profile.approval_status === 'pending') {
          setError('Akun kamu masih menunggu persetujuan Super Admin. Trial 7 hari dimulai setelah akun disetujui.')
        } else if (profile.approval_status === 'rejected') {
          setError('Pendaftaran akun kamu ditolak. Hubungi administrator.')
        } else {
          setError('Status persetujuan akun tidak valid. Hubungi administrator.')
        }

        return
      }


      const destinations: Record<UserRole, string> = {
        kasir: '/kasir',
        admin: '/admin',
        owner: '/owner',
        super_admin: '/super-admin',
      }

      if (!isUserRole(profile.role)) {
        const { error: signOutError } = await supabase.auth.signOut()
        if (signOutError) console.error('Unable to sign out an account with an unsupported role.', signOutError)
        setError('Peran akun belum dikenali. Hubungi administrator.')
        return
      }

      const destination = destinations[profile.role]
      setSuccess('Login berhasil. Mengarahkan Anda ke Fluxa...')
      router.replace(destination)
      router.refresh()
    } catch {
      setError('Terjadi kendala saat menghubungkan ke layanan login. Coba lagi.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login-bg">
      <AnimatedBackground />
      {phase !== 'login' && (
        <LoginIntro phase={phase} symbolRef={introSymbolRef} nameRef={introNameRef} />
      )}
      <section
        className={`login-card is-${phase}`}
        aria-labelledby="login-title"
        aria-hidden={phase !== 'login'}
        inert={phase !== 'login'}
      >
        <header className="login-brand login-stagger">
          <div className="login-brand-logo" ref={loginLogoRef}>
            <Image src="/Fluxa-Logo.webp" alt="" aria-hidden="true" width={42} height={42} priority />
          </div>
          <div>
            <p className="login-brand-name" ref={loginNameRef}>Fluxa</p>
            <p className="login-brand-tagline">Kasir + Business Health AI</p>
          </div>
        </header>

        <div className="login-welcome login-stagger">
          <h1 id="login-title">Selamat datang <span aria-hidden="true">👋</span></h1>
          <p>Masuk ke akun Anda untuk melanjutkan</p>
        </div>

        {registrationStatus && (
          <p className={`login-feedback ${registrationStatus === 'pending' ? 'login-feedback-success' : 'login-feedback-error'}`} role="status">
            {registrationStatus === 'pending'
              ? 'Pendaftaran menunggu persetujuan Super Admin. Trial 7 hari dimulai setelah akun disetujui.'
              : 'Pendaftaran belum disetujui. Hubungi tim Fluxa untuk informasi lebih lanjut.'}
          </p>
        )}

        <form className="login-form" onSubmit={handleLogin} noValidate>
          <div className="login-field login-stagger">
            <label htmlFor="email-input">Alamat email</label>
            <div className="login-input-wrap">
              <Mail size={17} aria-hidden="true" />
              <input
                ref={emailInputRef}
                autoCapitalize="none"
                autoComplete="email"
                id="email-input"
                name="email"
                onChange={(event) => {
                  setEmail(event.target.value)
                  clearFeedback()
                }}
                placeholder="nama@email.com"
                spellCheck={false}
                type="email"
                value={email}
                aria-describedby={error ? 'login-error' : undefined}
                aria-invalid={errorField === 'email' || errorField === 'credentials'}
                disabled={loading}
              />
            </div>
          </div>

          <div className="login-field login-stagger">
            <label htmlFor="password-input">Kata sandi</label>
            <div className="login-input-wrap">
              <LockKeyhole size={17} aria-hidden="true" />
              <input
                ref={passwordInputRef}
                autoComplete="current-password"
                id="password-input"
                name="password"
                onChange={(event) => {
                  setPassword(event.target.value)
                  clearFeedback()
                }}
                placeholder="Kata sandi Anda"
                type={showPassword ? 'text' : 'password'}
                value={password}
                aria-describedby={error ? 'login-error' : undefined}
                aria-invalid={errorField === 'password' || errorField === 'credentials'}
                disabled={loading}
              />
              <button
                aria-controls="password-input"
                aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                className="login-password-toggle"
                onClick={(event) => {
                  event.preventDefault()
                  setShowPassword((visible) => !visible)
                }}
                type="button"
                disabled={loading}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          {error && (
            <p className="login-feedback login-feedback-error" id="login-error" role="alert" aria-live="assertive">
              {error}
            </p>
          )}
          {success && (
            <p className="login-feedback login-feedback-success" role="status" aria-live="polite">
              {success}
            </p>
          )}

          <button className="login-submit login-stagger" disabled={loading} type="submit">
            {loading ? (
              <>
                <LoaderCircle className="login-spinner" size={18} aria-hidden="true" />
                Memproses...
              </>
            ) : (
              <>
                <ArrowRight size={18} aria-hidden="true" />
                Masuk
              </>
            )}
          </button>
        </form>

        <p className="login-register-prompt">Belum punya akun? <Link href="/register">Daftar & ajukan trial 7 hari</Link></p>
        <Link className="auth-back-link" href="/">
          <ArrowLeft size={15} aria-hidden="true" />
          Beranda
        </Link>
        <FeatureHighlights />
      </section>
    </main>
  )
}
