'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff, ShoppingCart, BarChart3, Sparkles } from 'lucide-react'

export default function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

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
    { role: 'Admin', email: 'admin@demo.local', color: '#2F6BFF' },
    { role: 'Kasir', email: 'kasir@demo.local', color: '#B26A00' },
  ]

  return (
    <div className="login-bg">
      <div className="login-card">
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: 'linear-gradient(135deg, #2F6BFF, #1636A8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <BarChart3 size={20} color="#fff" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 20, color: '#12141C' }}>Fluxa</div>
            <div style={{ fontSize: 11, color: '#7B8194', marginTop: -2 }}>Kasir + Business Health AI</div>
          </div>
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#12141C', marginBottom: 6 }}>
          Selamat datang 👋
        </h1>
        <p style={{ color: '#7B8194', fontSize: 13.5, marginBottom: 28 }}>
          Masuk ke akun Anda untuk melanjutkan
        </p>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 14 }}>
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
          <div style={{ marginBottom: 20 }}>
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
                  background: 'none', border: 'none', cursor: 'pointer', color: '#7B8194',
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
              background: '#FDE8E8', color: '#E5484D',
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
            style={{ width: '100%', justifyContent: 'center', height: 44, fontSize: 14 }}
            disabled={loading}
          >
            {loading ? 'Memproses...' : 'Masuk'}
          </button>
        </form>

        {/* Demo accounts */}
        <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid #ECEEF4' }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: '#7B8194', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
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
                  background: '#F1F3F7', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  color: acc.color, transition: 'all 0.15s'
                }}
              >
                {acc.role}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: '#7B8194', marginTop: 8 }}>
            Password: <code style={{ background: '#F1F3F7', padding: '1px 5px', borderRadius: 4 }}>Owner123!</code> / <code style={{ background: '#F1F3F7', padding: '1px 5px', borderRadius: 4 }}>Admin123!</code> / <code style={{ background: '#F1F3F7', padding: '1px 5px', borderRadius: 4 }}>Kasir123!</code>
          </div>
        </div>

        {/* Features */}
        <div style={{ marginTop: 24, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {[
            { icon: <ShoppingCart size={14} />, text: 'POS Kasir cepat' },
            { icon: <BarChart3 size={14} />, text: 'Business Health AI' },
            { icon: <Sparkles size={14} />, text: 'Rekomendasi aktif' },
          ].map(f => (
            <div key={f.text} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: '#7B8194' }}>
              <span style={{ color: '#2F6BFF' }}>{f.icon}</span>
              {f.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
