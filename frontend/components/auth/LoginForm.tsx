'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff, ShoppingCart, BarChart3, Sparkles } from 'lucide-react'
import BrandLogo from '@/components/ui/BrandLogo'

let hasPlayedLoginOpening = false

export default function LoginForm() {
  const [openingPhase, setOpeningPhase] = useState<'opening' | 'transitioning' | 'ready'>(
    () => hasPlayedLoginOpening ? 'ready' : 'opening'
  )
  const shouldPlayOpening = useRef(openingPhase === 'opening')
  const openingLogoRef = useRef<HTMLDivElement>(null)
  const loginLogoRef = useRef<HTMLDivElement>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (!shouldPlayOpening.current) return
    hasPlayedLoginOpening = true

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) {
      const readyTimeout = window.setTimeout(() => setOpeningPhase('ready'), 0)
      return () => window.clearTimeout(readyTimeout)
    }

    const transitionTimeout = window.setTimeout(() => {
      const openingLogo = openingLogoRef.current
      const loginLogo = loginLogoRef.current

      setOpeningPhase('transitioning')

      if (openingLogo && loginLogo) {
        const openingRect = openingLogo.getBoundingClientRect()
        const loginRect = loginLogo.getBoundingClientRect()
        const deltaX = loginRect.left + loginRect.width / 2 - (openingRect.left + openingRect.width / 2)
        const deltaY = loginRect.top + loginRect.height / 2 - (openingRect.top + openingRect.height / 2)
        const scale = loginRect.width / openingRect.width

        openingLogo.animate(
          [
            { transform: 'translate(0, 0) scale(1)' },
            { transform: `translate(${deltaX}px, ${deltaY}px) scale(${scale})` },
          ],
          { duration: 560, easing: 'cubic-bezier(0.2, 0.75, 0.25, 1)', fill: 'forwards' }
        )
      }
    }, 1120)
    const finishTimeout = window.setTimeout(() => setOpeningPhase('ready'), 1740)

    return () => {
      window.clearTimeout(transitionTimeout)
      window.clearTimeout(finishTimeout)
    }
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Email atau kata sandi tidak valid. Coba lagi.')
      setLoading(false)
      return
    }

    // Get role then redirect
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role === 'kasir') router.push('/kasir')
    else if (profile?.role === 'admin') router.push('/admin')
    else if (profile?.role === 'owner') router.push('/owner')
    else router.push('/kasir')
  }

  const demoAccounts = [
    { role: 'Owner', email: 'owner@demo.local', color: '#1F9D63' },
    { role: 'Admin', email: 'admin@demo.local', color: 'var(--acc)' },
    { role: 'Kasir', email: 'kasir@demo.local', color: '#B26A00' },
  ]

  return (
    <div className="login-bg">
      {openingPhase !== 'ready' && (
        <div
          className={`login-intro${openingPhase === 'transitioning' ? ' login-intro-transitioning' : ''}`}
          role="status"
          aria-label="FLUXA"
        >
          <div className="login-intro-brand">
            <div className="login-intro-logo" ref={openingLogoRef}>
              <BrandLogo size={132} />
            </div>
            <span className="login-intro-name">FLUXA</span>
          </div>
        </div>
      )}
      <div
        className={`login-card${openingPhase !== 'opening' ? ' login-card-enter' : ' login-card-opening'}`}
        aria-hidden={openingPhase === 'opening'}
        inert={openingPhase === 'opening'}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
          <div className="login-card-logo" ref={loginLogoRef}>
            <BrandLogo size={40} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 20, color: 'var(--ink)' }}>Fluxa</div>
            <div style={{ fontSize: 11, color: 'var(--mute)', marginTop: -2 }}>Kasir + Business Health AI</div>
          </div>
        </div>

        <h1 className="login-stagger login-title" style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>
          Selamat datang 👋
        </h1>
        <p className="login-stagger login-description" style={{ color: 'var(--mute)', fontSize: 13.5, marginBottom: 28 }}>
          Masuk ke akun Anda untuk melanjutkan
        </p>

        <form className="login-stagger login-form" onSubmit={handleLogin}>
          <div className="login-field login-field-email" style={{ marginBottom: 14 }}>
            <label className="label" htmlFor="email-input">Alamat email</label>
            <input
              id="email-input"
              type="email"
              className="input"
              placeholder="nama@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="login-field login-field-password" style={{ marginBottom: 20 }}>
            <label className="label" htmlFor="password-input">Kata sandi</label>
            <div style={{ position: 'relative' }}>
              <input
                id="password-input"
                type={showPass ? 'text' : 'password'}
                className="input"
                placeholder="Kata sandi Anda"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                style={{ paddingRight: 44 }}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mute)',
                  display: 'flex', alignItems: 'center'
                }}
                aria-label={showPass ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <div style={{
              background: 'var(--bads)', color: 'var(--bad)',
              padding: '10px 14px', borderRadius: 10, marginBottom: 16,
              fontSize: 13, fontWeight: 500
            }}>
              {error}
            </div>
          )}

          <button
            id="login-btn"
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', height: 44, fontSize: 14, animationDelay: '0.34s' }}
            disabled={loading}
          >
            {loading ? 'Memproses...' : 'Masuk'}
          </button>
        </form>

        {/* Demo accounts */}
        <div className="login-stagger" style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid #ECEEF4', animationDelay: '0.42s' }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--mute)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
            <Sparkles size={12} />
            AKUN DEMO — klik untuk mengisi otomatis
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {demoAccounts.map(acc => (
              <button
                key={acc.role}
                id={`demo-${acc.role.toLowerCase()}`}
                type="button"
                onClick={() => { setEmail(acc.email); setPassword(acc.role + '123!') }}
                style={{
                  padding: '5px 12px', borderRadius: 8, border: '1px solid #ECEEF4',
                  background: 'var(--bg)', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  color: acc.color, transition: 'all 0.15s'
                }}
              >
                {acc.role}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: 'var(--mute)', marginTop: 8 }}>
            Password: <code style={{ background: 'var(--bg)', padding: '1px 5px', borderRadius: 4 }}>Owner123!</code> / <code style={{ background: 'var(--bg)', padding: '1px 5px', borderRadius: 4 }}>Admin123!</code> / <code style={{ background: 'var(--bg)', padding: '1px 5px', borderRadius: 4 }}>Kasir123!</code>
          </div>
        </div>

        {/* Features */}
        <div className="login-stagger" style={{ marginTop: 24, display: 'flex', gap: 16, flexWrap: 'wrap', animationDelay: '0.5s' }}>
          {[
            { icon: <ShoppingCart size={14} />, text: 'POS Kasir cepat' },
            { icon: <BarChart3 size={14} />, text: 'Business Health AI' },
            { icon: <Sparkles size={14} />, text: 'Rekomendasi aktif' },
          ].map(f => (
            <div key={f.text} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--mute)' }}>
              <span style={{ color: 'var(--acc)' }}>{f.icon}</span>
              {f.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
