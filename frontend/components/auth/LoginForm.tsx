'use client'

import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type RefObject } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  ArrowLeft,
  BarChart3,
  Check,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { UserRole } from '@/lib/supabase/types'

const demoAccounts = [
  { role: 'Owner', email: 'owner@demo.local', password: 'Owner123!', color: 'owner' },
  { role: 'Admin', email: 'admin@demo.local', password: 'Admin123!', color: 'admin' },
  { role: 'Kasir', email: 'kasir@demo.local', password: 'Kasir123!', color: 'kasir' },
] as const

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
            <Image src="/fluxa-logo-glass.png" alt="" aria-hidden="true" width={140} height={140} priority />
          </div>
        </div>
        <div className="login-intro-copy">
          <p className="login-brand-name" ref={nameRef}>Fluxa</p>
        </div>
      </div>
    </div>
  )
}

function DemoAccounts({
  selectedDemo,
  onSelect,
  onSelectSuperAdmin,
}: {
  selectedDemo: string
  onSelect: (account: (typeof demoAccounts)[number]) => void
  onSelectSuperAdmin: () => void
}) {
  return (
    <section className="login-demo login-stagger" aria-label="Akun demo">
      <div className="login-demo-heading">
        <Sparkles size={13} aria-hidden="true" />
        <span>AKUN DEMO</span>
        <span className="login-demo-hint">— pilih akun</span>
      </div>
      <div className="login-demo-buttons">
        {demoAccounts.map((account) => (
          <button
            className={`login-demo-button login-demo-${account.color}${selectedDemo === account.role ? ' is-selected' : ''}`}
            key={account.role}
            onClick={() => onSelect(account)}
            type="button"
            aria-pressed={selectedDemo === account.role}
          >
            {selectedDemo === account.role && <Check size={13} aria-hidden="true" />}
            {account.role}
          </button>
        ))}
        <button
          className={`login-demo-button login-demo-super-admin${selectedDemo === 'Super Admin' ? ' is-selected' : ''}`}
          onClick={onSelectSuperAdmin}
          type="button"
          aria-pressed={selectedDemo === 'Super Admin'}
        >
          {selectedDemo === 'Super Admin' ? <Check size={13} aria-hidden="true" /> : <ShieldCheck size={13} aria-hidden="true" />}
          Super Admin
        </button>
      </div>
      {selectedDemo === 'Super Admin' && (
        <p className="login-demo-super-admin-hint" role="status">
          Masukkan email dan kata sandi akun Super Admin yang sudah terdaftar.
        </p>
      )}
      <p className="login-demo-passwords">
        <span>Password:</span>
        {demoAccounts.map((account) => (
          <code key={account.role}>{account.password}</code>
        ))}
      </p>
    </section>
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
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [errorField, setErrorField] = useState<'email' | 'password' | 'credentials' | null>(null)
  const [success, setSuccess] = useState('')
  const [selectedDemo, setSelectedDemo] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const reducedMotionTimer = window.setTimeout(() => setPhase('login'), 0)
      return () => window.clearTimeout(reducedMotionTimer)
    }

    const introTimer = window.setTimeout(() => setPhase('transition'), 1950)
    return () => window.clearTimeout(introTimer)
  }, [])

  useEffect(() => {
    if (phase !== 'transition') return

    const introSymbol = introSymbolRef.current?.querySelector('img')
    const introName = introNameRef.current
    const loginLogo = loginLogoRef.current?.querySelector('img')
    const loginName = loginNameRef.current
    const loginBrand = loginLogo?.closest<HTMLElement>('.login-brand')
    const card = loginLogo?.closest<HTMLElement>('.login-card')
    const transitionAnimations: Animation[] = []
    const finishTimer = window.setTimeout(() => setPhase('login'), 1050)

    if (introSymbol && introName && loginLogo && loginName && loginBrand && card) {
      const frame = window.requestAnimationFrame(() => {
        const cardStyles = getComputedStyle(card)
        const transform = cardStyles.transform === 'none' ? new DOMMatrix() : new DOMMatrix(cardStyles.transform)
        const transformOrigin = cardStyles.transformOrigin.split(' ')
        const scaleOriginX = Number.parseFloat(transformOrigin[0])
        const scaleOriginY = Number.parseFloat(transformOrigin[1])
        const scaleX = Math.hypot(transform.a, transform.b)
        const scaleY = Math.hypot(transform.c, transform.d)
        const cardRect = card.getBoundingClientRect()
        const layoutLeft = cardRect.left - scaleOriginX - transform.e + scaleX * scaleOriginX
        const layoutTop = cardRect.top - scaleOriginY - transform.f + scaleY * scaleOriginY

        const animateSymbolTo = (source: HTMLElement, target: HTMLElement) => {
          const from = source.getBoundingClientRect()
          const targetRect = target.getBoundingClientRect()
          const targetX = layoutLeft + scaleOriginX
            + (targetRect.left + targetRect.width / 2 - layoutLeft - scaleOriginX - transform.e) / scaleX
          const targetY = layoutTop + scaleOriginY
            + (targetRect.top + targetRect.height / 2 - layoutTop - scaleOriginY - transform.f) / scaleY
          const targetScaleX = targetRect.width / scaleX / from.width
          const targetScaleY = targetRect.height / scaleY / from.height
          const x = targetX - (from.left + from.width / 2)
          const y = targetY - (from.top + from.height / 2)
          const destination = `translate(${x}px, ${y}px) scale(${targetScaleX}, ${targetScaleY})`

          transitionAnimations.push(source.animate(
            [
              { transform: 'translate(0, 0) scale(1)', opacity: 1, offset: 0 },
              { transform: destination, opacity: 1, offset: 0.82 },
              { transform: destination, opacity: 0, offset: 1 },
            ],
            { duration: 1000, easing: 'cubic-bezier(.2, .75, .25, 1)', fill: 'forwards' },
          ))
        }

        animateSymbolTo(introSymbol, loginLogo)
        transitionAnimations.push(introName.animate(
          [
            { opacity: 1, transform: 'translateY(0)' },
            { opacity: 0, transform: 'translateY(-4px)' },
          ],
          { duration: 320, easing: 'ease-out', fill: 'forwards' },
        ))
        transitionAnimations.push(loginLogo.animate(
          [
            { opacity: 0, offset: 0 },
            { opacity: 0, offset: 0.8 },
            { opacity: 1, offset: 1 },
          ],
          { duration: 1000, easing: 'ease-out', fill: 'forwards' },
        ))
      })

      return () => {
        window.cancelAnimationFrame(frame)
        transitionAnimations.forEach((animation) => animation.cancel())
        window.clearTimeout(finishTimer)
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
      return
    }
    if (!password) {
      setError('Masukkan kata sandi Anda.')
      setErrorField('password')
      setSuccess('')
      return
    }

    setLoading(true)
    setError('')
    setErrorField(null)
    setSuccess('')

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
        .select('role, approval_status')
        .eq('id', user.id)
        .single()

      if (profileError || !profile) {
        const { error: signOutError } = await supabase.auth.signOut()
        if (signOutError) console.error('Unable to sign out an account without a readable profile.', signOutError)

        if (profileError?.message.includes('approval_status')) {
          setError('Sistem persetujuan belum siap. Minta administrator menerapkan migrasi database terbaru, lalu coba masuk kembali.')
        } else {
          setError('Profil akses akun tidak dapat dibaca. Pastikan profil akun tersedia dan hubungi administrator.')
        }
        return
      }

      if (profile.approval_status === 'pending' || profile.approval_status === 'rejected') {
        const { error: signOutError } = await supabase.auth.signOut()
        if (signOutError) console.error('Unable to sign out an unapproved account.', signOutError)
        setError(profile.approval_status === 'pending'
          ? 'Pendaftaran Anda masih menunggu persetujuan Super Admin. Trial 7 hari dimulai setelah akun disetujui.'
          : 'Pendaftaran Anda belum disetujui. Hubungi tim Fluxa untuk informasi lebih lanjut.')
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

  const selectDemoAccount = (account: (typeof demoAccounts)[number]) => {
    setEmail(account.email)
    setPassword(account.password)
    setSelectedDemo(account.role)
    setError('')
    setErrorField(null)
    setSuccess('')
  }

  const selectSuperAdmin = () => {
    setEmail('')
    setPassword('')
    setSelectedDemo('Super Admin')
    setError('')
    setErrorField(null)
    setSuccess('')
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
            <Image src="/fluxa-logo-glass.png" alt="" aria-hidden="true" width={42} height={42} priority />
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
                autoComplete="email"
                id="email-input"
                onChange={(event) => {
                  setEmail(event.target.value)
                  setSelectedDemo('')
                  setError('')
                  setErrorField(null)
                  setSuccess('')
                }}
                placeholder="nama@email.com"
                type="email"
                value={email}
                aria-describedby={error ? 'login-error' : undefined}
                aria-invalid={errorField === 'email' || errorField === 'credentials'}
              />
            </div>
          </div>

          <div className="login-field login-stagger">
            <label htmlFor="password-input">Kata sandi</label>
            <div className="login-input-wrap">
              <LockKeyhole size={17} aria-hidden="true" />
              <input
                autoComplete="current-password"
                id="password-input"
                onChange={(event) => {
                  setPassword(event.target.value)
                  setSelectedDemo('')
                  setError('')
                  setErrorField(null)
                  setSuccess('')
                }}
                placeholder="Kata sandi Anda"
                type={showPassword ? 'text' : 'password'}
                value={password}
                aria-describedby={error ? 'login-error' : undefined}
                aria-invalid={errorField === 'password' || errorField === 'credentials'}
              />
              <button
                aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                className="login-password-toggle"
                onClick={() => setShowPassword((visible) => !visible)}
                type="button"
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          {error && (
            <p className="login-feedback login-feedback-error" id="login-error" role="alert">
              {error}
            </p>
          )}
          {success && (
            <p className="login-feedback login-feedback-success" role="status">
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
        <Link className="auth-back-link" href="/landingpage">
          <ArrowLeft size={15} aria-hidden="true" />
          Kembali ke landing page
        </Link>
        <DemoAccounts
          selectedDemo={selectedDemo}
          onSelect={selectDemoAccount}
          onSelectSuperAdmin={selectSuperAdmin}
        />
        <FeatureHighlights />
      </section>
    </main>
  )
}
