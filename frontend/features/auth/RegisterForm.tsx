'use client'

import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import Image from 'next/image'
import { ArrowLeft, ArrowRight, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail, Phone, ShieldCheck, UserRound } from 'lucide-react'
import { AnimatedBackground, AuthIntro, useAuthIntro } from '@/components/auth/AuthVisuals'

export default function RegisterForm() {
  const { phase, introSymbolRef, introNameRef, brandLogoRef, brandNameRef } = useAuthIntro()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullName, email, phone, password }),
      })
      const result: { error?: string; success?: boolean } = await response.json()
      if (!response.ok) throw new Error(result.error || 'Pendaftaran belum dapat diproses.')
      setSubmitted(true)
    } catch (registrationError) {
      console.error('Registration form submission failed.', registrationError)
      setError(registrationError instanceof Error ? registrationError.message : 'Terjadi kendala. Silakan coba lagi.')
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

      {submitted ? (
        <section
          className={`login-card register-card is-${phase}`}
          aria-live="polite"
          aria-hidden={phase !== 'login'}
          inert={phase !== 'login'}
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
            <span className="register-eyebrow">PENDAFTARAN TERCATAT</span>
            <h1>Terima kasih, {fullName.trim()}.</h1>
            <p>Akun Anda menunggu persetujuan Super Admin. Trial 7 hari dimulai setelah akun disetujui.</p>
          </div>
          <div className="register-notice login-stagger">
            <ShieldCheck size={17} aria-hidden="true" />
            <span>Kami akan mengirimkan informasi persetujuan ke <strong>{email}</strong>.</span>
          </div>
          <Link className="login-submit register-back-link login-stagger" href="/landingpage">
            Kembali ke landing page <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </section>
      ) : (
        <section
          className={`login-card register-card is-${phase}`}
          aria-labelledby="register-title"
          aria-hidden={phase !== 'login'}
          inert={phase !== 'login'}
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
            <span className="register-eyebrow">MULAI BERSAMA FLUXA</span>
            <h1 id="register-title">Buat akun bisnis Anda.</h1>
            <p>Trial gratis 7 hari akan aktif setelah pendaftaran Anda disetujui.</p>
          </div>

          <form className="login-form register-form" onSubmit={handleSubmit}>
            <div className="login-field login-stagger">
              <label htmlFor="register-name">Nama lengkap</label>
              <div className="login-input-wrap">
                <UserRound size={17} aria-hidden="true" />
                <input id="register-name" autoComplete="name" maxLength={120} required value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Nama Anda" />
              </div>
            </div>

            <div className="login-field login-stagger">
              <label htmlFor="register-email">Alamat email</label>
              <div className="login-input-wrap">
                <Mail size={17} aria-hidden="true" />
                <input id="register-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nama@email.com" />
              </div>
            </div>

            <div className="login-field login-stagger">
              <label htmlFor="register-phone">Nomor telepon <span className="register-optional">(opsional)</span></label>
              <div className="login-input-wrap">
                <Phone size={17} aria-hidden="true" />
                <input id="register-phone" type="tel" autoComplete="tel" maxLength={32} value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="08xxxxxxxxxx" />
              </div>
            </div>

            <div className="login-field login-stagger">
              <label htmlFor="register-password">Kata sandi</label>
              <div className="login-input-wrap">
                <LockKeyhole size={17} aria-hidden="true" />
                <input id="register-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={8} maxLength={72} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Minimal 8 karakter" />
                <button className="login-password-toggle" type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
              </div>
            </div>

            {error && <p className="login-feedback login-feedback-error" role="alert">{error}</p>}
            <button className="login-submit register-submit login-stagger" type="submit" disabled={loading}>
              {loading ? <><LoaderCircle size={17} className="login-spinner" /> Mengirim pendaftaran...</> : <>Daftar & ajukan trial <ArrowRight size={17} /></>}
            </button>
          </form>

          <div className="register-notice login-stagger">
            <ShieldCheck size={16} aria-hidden="true" />
            <p>Akun ditinjau Super Admin. Trial 7 hari dimulai setelah persetujuan.</p>
          </div>
          <p className="login-register-prompt login-stagger">Sudah punya akun? <Link href="/login">Masuk di sini</Link></p>
          <Link className="auth-back-link login-stagger" href="/landingpage">
            <ArrowLeft size={15} aria-hidden="true" />
            Kembali ke landing page
          </Link>
        </section>
      )}
      <p className={`register-legal${phase === 'login' ? ' is-visible' : ''}`}>Dengan mendaftar, Anda meminta akses untuk mengelola bisnis menggunakan Fluxa.</p>
    </main>
  )
}
