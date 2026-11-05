'use client'

import { useRef, useState, type FormEvent } from 'react'
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
import { AnimatedBackground, AuthIntro, useAuthIntro } from './AuthVisuals'

function isUserRole(role: unknown): role is UserRole {
  return role === 'kasir' || role === 'admin' || role === 'owner' || role === 'super_admin'
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
  const { phase, introSymbolRef, introNameRef, brandLogoRef, brandNameRef } = useAuthIntro()
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
        <AuthIntro phase={phase} symbolRef={introSymbolRef} nameRef={introNameRef} />
      )}
      <section
        className={`login-card is-${phase}`}
        aria-labelledby="login-title"
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
