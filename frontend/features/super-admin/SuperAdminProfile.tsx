'use client'

import { useEffect, useState, type FormEvent } from 'react'
import styles from './super-admin-content.module.css'

type Profile = { full_name: string; email: string; phone: string | null; created_at: string }

export default function SuperAdminProfile() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', currentPassword: '', newPassword: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let cancelled = false
    async function loadProfile() {
      try {
        const response = await fetch('/api/super-admin/profile', { cache: 'no-store' })
        const result = await response.json() as { profile?: Profile; error?: string }
        if (!response.ok || !result.profile) throw new Error(result.error || 'Profil belum dapat dimuat.')
        if (!cancelled) {
          setProfile(result.profile)
          setForm({ full_name: result.profile.full_name, email: result.profile.email, phone: result.profile.phone ?? '', currentPassword: '', newPassword: '' })
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Profil belum dapat dimuat.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void loadProfile()
    return () => { cancelled = true }
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const response = await fetch('/api/super-admin/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: form.full_name,
          email: form.email,
          phone: form.phone,
          currentPassword: form.currentPassword || undefined,
          newPassword: form.newPassword || undefined,
        }),
      })
      const result = await response.json() as { error?: string; message?: string }
      if (!response.ok) throw new Error(result.error || 'Perubahan profil gagal.')
      setNotice(result.message || 'Profil berhasil diperbarui.')
      setProfile((current) => current ? { ...current, full_name: form.full_name, phone: form.phone || null } : current)
      setForm((current) => ({ ...current, currentPassword: '', newPassword: '' }))
    } catch (saveError) {
      console.error('Unable to update Super Admin profile.', saveError)
      setError(saveError instanceof Error ? saveError.message : 'Perubahan profil gagal.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className={styles.page}>
      <div className={styles.heading}><div><span className={styles.eyebrow}>AKUN OPERATOR</span><h1>Profil Super Admin</h1><p>Perubahan email menunggu konfirmasi. Kata sandi tidak pernah dibaca kembali atau disimpan dalam audit log.</p></div></div>
      {error && <p className={styles.errorBox} role="alert">{error}</p>}
      {notice && <p className={styles.infoBox} role="status">{notice}</p>}
      {loading ? <div className={styles.loading} role="status">Memuat profil...</div> : profile && (
        <form className={`${styles.panel} ${styles.profileForm}`} onSubmit={submit}>
          <div className={styles.panelHeading}><div><h2>Informasi pribadi</h2><p>Terdaftar {new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeZone: 'Asia/Jakarta' }).format(new Date(profile.created_at))}</p></div></div>
          <label>Nama lengkap<input required minLength={2} maxLength={120} value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} /></label>
          <label>Email<input required type="email" maxLength={254} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
          <label>Nomor telepon<input type="tel" maxLength={32} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
          <hr />
          <label>Kata sandi saat ini <span>(wajib untuk perubahan kredensial)</span><input type="password" autoComplete="current-password" value={form.currentPassword} onChange={(event) => setForm({ ...form, currentPassword: event.target.value })} /></label>
          <label>Kata sandi baru <span>(opsional, minimal 12 karakter)</span><input type="password" autoComplete="new-password" minLength={12} maxLength={72} value={form.newPassword} onChange={(event) => setForm({ ...form, newPassword: event.target.value })} /></label>
          <button className={styles.primaryButton} type="submit" disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan profil'}</button>
        </form>
      )}
    </section>
  )
}
