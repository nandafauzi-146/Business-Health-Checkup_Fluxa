'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  Check,
  CheckCircle2,
  Clock,
  DollarSign,
  Edit3,
  Eye,
  HelpCircle,
  Layers,
  Package,
  Plus,
  RefreshCw,
  Sparkles,
  Users,
  X,
} from 'lucide-react'
import { Empty, ErrorBox, Loading } from './SuperAdminOverview'
import styles from './super-admin-content.module.css'

type Plan = {
  id: string
  name: string
  description: string
  price: number
  duration_days: number
  max_users: number
  features: string[]
  is_active: boolean
}

const initialForm = {
  name: '',
  description: '',
  price: '',
  durationDays: '30',
  maxUsers: '1',
  features: '',
}

const money = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })

const durationPresets = [
  { label: '30 Hari (1 Bulan)', days: 30 },
  { label: '90 Hari (3 Bulan)', days: 90 },
  { label: '180 Hari (6 Bulan)', days: 180 },
  { label: '365 Hari (1 Tahun)', days: 365 },
]

export default function SuperAdminPlans() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [form, setForm] = useState(initialForm)
  const [editing, setEditing] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [showPreview, setShowPreview] = useState(true)

  const load = useCallback(async () => {
    const response = await fetch('/api/super-admin/plans', { cache: 'no-store' })
    const result = await response.json() as { plans?: Plan[]; error?: string }
    if (!response.ok) throw new Error(result.error || 'Daftar paket belum dapat dimuat.')
    setPlans(result.plans ?? [])
    setError('')
  }, [])

  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(() => {
      void load().catch((loadError: unknown) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Daftar paket belum dapat dimuat.')
      }).finally(() => {
        if (!cancelled) setLoading(false)
      })
    }, 0)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [load])

  function editPlan(plan: Plan) {
    setEditing(plan.id)
    setForm({
      name: plan.name,
      description: plan.description,
      price: String(plan.price),
      durationDays: String(plan.duration_days),
      maxUsers: String(plan.max_users),
      features: (plan.features ?? []).join('\n'),
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function resetForm() {
    setEditing(null)
    setForm(initialForm)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')

    const cleanPrice = Number.parseInt(String(form.price).replace(/\D/g, ''), 10) || 0
    const cleanDuration = Number.parseInt(form.durationDays, 10) || 0
    const cleanUsers = Number.parseInt(form.maxUsers, 10) || 0
    const featureList = form.features
      .split('\n')
      .map((f) => f.trim())
      .filter(Boolean)

    if (form.name.trim().length < 2) {
      setError('Nama paket minimal 2 karakter.')
      setSaving(false)
      return
    }
    if (cleanDuration < 1) {
      setError('Durasi minimal 1 hari.')
      setSaving(false)
      return
    }
    if (cleanUsers < 1) {
      setError('Batas maksimal pengguna minimal 1.')
      setSaving(false)
      return
    }

    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        price: cleanPrice,
        durationDays: cleanDuration,
        maxUsers: cleanUsers,
        features: featureList,
      }
      const response = await fetch('/api/super-admin/plans', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing ? { ...payload, id: editing } : payload),
      })
      const result = await response.json() as { error?: string; auditRecorded?: boolean }
      if (!response.ok) throw new Error(result.error || 'Paket belum dapat disimpan.')

      setNotice(result.auditRecorded === false
        ? 'Paket tersimpan, namun pencatatan audit log sistem gagal.'
        : `Paket "${payload.name}" berhasil ${editing ? 'diperbarui' : 'dibuat'}.`)
      resetForm()
      await load()
    } catch (saveError) {
      console.error('Unable to save subscription plan.', saveError)
      setError(saveError instanceof Error ? saveError.message : 'Paket belum dapat disimpan.')
    } finally {
      setSaving(false)
    }
  }

  async function togglePlan(plan: Plan) {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const response = await fetch('/api/super-admin/plans', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: plan.id, isActive: !plan.is_active }),
      })
      const result = await response.json() as { error?: string }
      if (!response.ok) throw new Error(result.error || 'Status paket belum dapat diperbarui.')
      setNotice(`Status paket "${plan.name}" berhasil diubah menjadi ${!plan.is_active ? 'Aktif' : 'Nonaktif'}.`)
      await load()
    } catch (updateError) {
      console.error('Unable to change subscription plan status.', updateError)
      setError(updateError instanceof Error ? updateError.message : 'Status paket belum dapat diperbarui.')
    } finally {
      setSaving(false)
    }
  }

  function refresh() {
    setLoading(true)
    void load().catch((loadError: unknown) => {
      setError(loadError instanceof Error ? loadError.message : 'Daftar paket belum dapat dimuat.')
    }).finally(() => setLoading(false))
  }

  const parsedFeatures = form.features
    .split('\n')
    .map((f) => f.trim())
    .filter(Boolean)

  const parsedPrice = Number.parseInt(String(form.price).replace(/\D/g, ''), 10) || 0

  return (
    <section className={styles.page}>
      {/* Page Header */}
      <div className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>MANAJEMEN PAKET LAYANAN</span>
          <h1>Paket Subscription FLUXA</h1>
          <p>Konfigurasikan paket langganan bundel (bulanan/tahunan), kuota kasir/pengguna, dan rincian fitur untuk Owner.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className={styles.secondaryButton} type="button" disabled={loading || saving} onClick={refresh}>
            <RefreshCw size={14} className={loading ? styles.spin : ''} /> Muat ulang
          </button>
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={() => setShowPreview(!showPreview)}
          >
            <Eye size={14} /> {showPreview ? 'Sembunyikan Preview' : 'Tampilkan Preview'}
          </button>
        </div>
      </div>

      {notice && (
        <div className={styles.infoBox} style={{ borderLeftColor: 'var(--ok)' }} role="status">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={16} color="var(--ok)" />
            <strong>Berhasil</strong>
          </div>
          <span>{notice}</span>
        </div>
      )}

      {error && <ErrorBox message={error} retry={refresh} />}

      {/* Main Layout: Form + Live Preview */}
      <div style={{ display: 'grid', gridTemplateColumns: showPreview ? 'minmax(0, 1.4fr) minmax(300px, 0.9fr)' : '1fr', gap: '20px', alignItems: 'start' }}>
        {/* Optimized Subscription Form */}
        <form
          className={styles.panel}
          onSubmit={submit}
          style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--line)', paddingBottom: '12px' }}>
            <div>
              <h2 style={{ fontSize: '15px', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Package size={18} color="var(--role-acc, var(--acc))" />
                {editing ? 'Edit Paket Subscription' : 'Tambah Paket Baru'}
              </h2>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--mute)' }}>
                {editing
                  ? 'Perbarui parameter paket. Riwayat transaksi lama tidak akan terpengaruh.'
                  : 'Lengkapi formulir di bawah untuk mendaftarkan paket bundel baru.'}
              </p>
            </div>
            {editing && (
              <span className={styles.badge} style={{ background: 'var(--role-accs, var(--accs))', color: 'var(--role-acc, var(--acc))' }}>
                Mode Pengeditan
              </span>
            )}
          </div>

          {/* Group 1: Informasi Dasar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
            {/* 1. Package Name */}
            <div>
              <label htmlFor="plan-name" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 650, marginBottom: '6px', color: 'var(--ink)' }}>
                Nama Paket <span style={{ color: 'var(--bad)' }}>*</span>
              </label>
              <input
                id="plan-name"
                required
                type="text"
                minLength={2}
                maxLength={80}
                placeholder="Contoh: Paket Pro UMKM, Starter Bisnis"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                style={{
                  width: '100%',
                  height: '40px',
                  padding: '0 12px',
                  borderRadius: '9px',
                  border: '1px solid var(--line)',
                  background: 'var(--input-bg)',
                  color: 'var(--ink)',
                  fontSize: '13px',
                }}
              />
              <span style={{ fontSize: '11px', color: 'var(--mute)', display: 'block', marginTop: '4px' }}>
                Gunakan nama yang jelas dan mencerminkan tier langganan.
              </span>
            </div>

            {/* 2. Price */}
            <div>
              <label htmlFor="plan-price" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 650, marginBottom: '6px', color: 'var(--ink)' }}>
                Harga Paket (IDR) <span style={{ color: 'var(--bad)' }}>*</span>
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <span style={{ position: 'absolute', left: '12px', fontSize: '12px', fontWeight: 700, color: 'var(--mute)' }}>
                  Rp
                </span>
                <input
                  id="plan-price"
                  required
                  type="number"
                  min="0"
                  step="1000"
                  placeholder="Contoh: 150000"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  style={{
                    width: '100%',
                    height: '40px',
                    padding: '0 12px 0 36px',
                    borderRadius: '9px',
                    border: '1px solid var(--line)',
                    background: 'var(--input-bg)',
                    color: 'var(--ink)',
                    fontSize: '13px',
                    fontWeight: 600,
                  }}
                />
              </div>
              <span style={{ fontSize: '11px', color: 'var(--mute)', display: 'block', marginTop: '4px' }}>
                {parsedPrice > 0 ? money.format(parsedPrice) : 'Isi 0 jika paket gratis atau promosi khusus.'}
              </span>
            </div>
          </div>

          {/* Group 2: Masa Aktif & Kapasitas Pengguna */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
            {/* 3. Duration in Days */}
            <div>
              <label htmlFor="plan-duration" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 650, marginBottom: '6px', color: 'var(--ink)' }}>
                Durasi Masa Aktif (Hari) <span style={{ color: 'var(--bad)' }}>*</span>
              </label>
              <input
                id="plan-duration"
                required
                type="number"
                min="1"
                max="3660"
                step="1"
                placeholder="Contoh: 30"
                value={form.durationDays}
                onChange={(e) => setForm({ ...form, durationDays: e.target.value })}
                style={{
                  width: '100%',
                  height: '40px',
                  padding: '0 12px',
                  borderRadius: '9px',
                  border: '1px solid var(--line)',
                  background: 'var(--input-bg)',
                  color: 'var(--ink)',
                  fontSize: '13px',
                }}
              />
              {/* Presets chips */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                {durationPresets.map((preset) => (
                  <button
                    key={preset.days}
                    type="button"
                    onClick={() => setForm({ ...form, durationDays: String(preset.days) })}
                    style={{
                      fontSize: '10px',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      border: form.durationDays === String(preset.days) ? '1px solid var(--role-acc, var(--acc))' : '1px solid var(--line)',
                      background: form.durationDays === String(preset.days) ? 'var(--role-accs, var(--accs))' : 'transparent',
                      color: form.durationDays === String(preset.days) ? 'var(--role-acc, var(--acc))' : 'var(--mute)',
                      cursor: 'pointer',
                    }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 4. Maximum Number of Users */}
            <div>
              <label htmlFor="plan-max-users" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 650, marginBottom: '6px', color: 'var(--ink)' }}>
                Batas Maksimal Pengguna / Kasir <span style={{ color: 'var(--bad)' }}>*</span>
              </label>
              <input
                id="plan-max-users"
                required
                type="number"
                min="1"
                max="10000"
                step="1"
                placeholder="Contoh: 3"
                value={form.maxUsers}
                onChange={(e) => setForm({ ...form, maxUsers: e.target.value })}
                style={{
                  width: '100%',
                  height: '40px',
                  padding: '0 12px',
                  borderRadius: '9px',
                  border: '1px solid var(--line)',
                  background: 'var(--input-bg)',
                  color: 'var(--ink)',
                  fontSize: '13px',
                }}
              />
              <span style={{ fontSize: '11px', color: 'var(--mute)', display: 'block', marginTop: '4px' }}>
                Jumlah akun kasir & staf operasional yang dapat dibuat oleh Owner.
              </span>
            </div>
          </div>

          {/* Group 3: Deskripsi */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label htmlFor="plan-desc" style={{ fontSize: '12px', fontWeight: 650, color: 'var(--ink)' }}>
                Deskripsi Paket
              </label>
              <span style={{ fontSize: '11px', color: 'var(--mute)' }}>
                {form.description.length} / 500 karakter
              </span>
            </div>
            <textarea
              id="plan-desc"
              maxLength={500}
              rows={2}
              placeholder="Contoh: Paket lengkap untuk toko retail dan F&B yang membutuhkan manajemen stok multi-kasir dan laporan keuangan terpadu."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '9px',
                border: '1px solid var(--line)',
                background: 'var(--input-bg)',
                color: 'var(--ink)',
                fontSize: '12px',
                resize: 'vertical',
                lineHeight: 1.5,
              }}
            />
          </div>

          {/* Group 4: Fitur Paket */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label htmlFor="plan-features" style={{ fontSize: '12px', fontWeight: 650, color: 'var(--ink)' }}>
                Daftar Fitur Paket
              </label>
              <span style={{ fontSize: '11px', color: 'var(--mute)' }}>
                {parsedFeatures.length} fitur terdaftar
              </span>
            </div>
            <textarea
              id="plan-features"
              rows={4}
              placeholder={`Ketik satu fitur per baris. Contoh:\nModul Kasir & POS Lengkap\nManajemen Stok & Kartu Stok\nLaporan Laba Rugi & Arus Kas\nDukungan Teknis Prioritas`}
              value={form.features}
              onChange={(e) => setForm({ ...form, features: e.target.value })}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '9px',
                border: '1px solid var(--line)',
                background: 'var(--input-bg)',
                color: 'var(--ink)',
                fontSize: '12px',
                resize: 'vertical',
                lineHeight: 1.6,
                fontFamily: 'inherit',
              }}
            />
            <span style={{ fontSize: '11px', color: 'var(--mute)', display: 'block', marginTop: '4px' }}>
              Tekan Enter untuk memisahkan fitur. Setiap baris akan ditampilkan sebagai poin fitur dengan ikon checklist.
            </span>
          </div>

          {/* Form Actions */}
          <div style={{ display: 'flex', gap: '10px', paddingTop: '10px', borderTop: '1px solid var(--line)' }}>
            <button
              className={styles.primaryButton}
              type="submit"
              disabled={saving}
              style={{ minWidth: '150px' }}
            >
              {saving ? 'Menyimpan...' : editing ? 'Simpan Perubahan Paket' : 'Buat Paket Langganan'}
            </button>
            {editing && (
              <button className={styles.secondaryButton} type="button" onClick={resetForm} disabled={saving}>
                <X size={14} /> Batal Edit
              </button>
            )}
          </div>
        </form>

        {/* Live Preview Card */}
        {showPreview && (
          <div
            className={styles.panel}
            style={{
              position: 'sticky',
              top: '20px',
              border: '1px solid var(--role-acc, var(--acc))',
              boxShadow: '0 8px 30px rgba(52, 120, 246, 0.08)',
              background: 'linear-gradient(180deg, var(--panel) 0%, var(--bg) 100%)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--role-acc, var(--acc))', letterSpacing: '.08em' }}>
                PRATINJAU TAMPILAN OWNER
              </span>
              <span className={styles.badge} style={{ background: 'var(--oks)', color: 'var(--ok)' }}>
                Live Preview
              </span>
            </div>

            <div style={{ padding: '16px', background: 'var(--panel)', borderRadius: '14px', border: '1px solid var(--line)' }}>
              <h3 style={{ margin: '0 0 6px', fontSize: '18px', color: 'var(--ink)' }}>
                {form.name.trim() || 'Nama Paket Belum Diisi'}
              </h3>
              <p style={{ margin: '0 0 16px', fontSize: '12px', color: 'var(--mute)', minHeight: '36px', lineHeight: 1.5 }}>
                {form.description.trim() || 'Deskripsi paket akan tampil di bagian ini untuk memudahkan Owner memilih paket.'}
              </p>

              <div style={{ margin: '14px 0', padding: '12px 0', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
                <span style={{ fontSize: '11px', color: 'var(--mute)', display: 'block' }}>Biaya Langganan</span>
                <strong style={{ fontSize: '24px', color: 'var(--ink)' }}>
                  {parsedPrice > 0 ? money.format(parsedPrice) : 'Gratis'}
                </strong>
                <span style={{ fontSize: '12px', color: 'var(--mute)' }}>
                  {' '}/ {form.durationDays || '30'} Hari
                </span>
              </div>

              <div style={{ display: 'grid', gap: '8px', margin: '16px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--ink)' }}>
                  <Users size={14} color="var(--role-acc, var(--acc))" />
                  <span>Maksimal <strong>{form.maxUsers || 1} Pengguna</strong></span>
                </div>

                {parsedFeatures.length === 0 ? (
                  <span style={{ fontSize: '11px', color: 'var(--mute)', fontStyle: 'italic' }}>
                    Belum ada daftar fitur yang ditambahkan.
                  </span>
                ) : (
                  parsedFeatures.map((feat, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12px', color: 'var(--ink)' }}>
                      <Check size={14} color="var(--ok)" style={{ flexShrink: 0, marginTop: '2px' }} />
                      <span>{feat}</span>
                    </div>
                  ))
                )}
              </div>

              <button
                type="button"
                disabled
                style={{
                  width: '100%',
                  height: '40px',
                  borderRadius: '9px',
                  background: 'var(--role-acc, var(--acc))',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: '12px',
                  border: 'none',
                  opacity: 0.85,
                  cursor: 'default',
                  marginTop: '8px',
                }}
              >
                Pilih dan Bayar (Preview)
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Table: Existing Plans */}
      <section className={styles.panel} style={{ marginTop: '10px' }}>
        <div className={styles.panelHeading}>
          <div>
            <h2>Daftar Paket Langganan Aktif & Nonaktif</h2>
            <p>Kelola visibilitas paket yang ditawarkan di halaman langganan Owner.</p>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--mute)' }}>
            Total: <strong>{plans.length}</strong> paket
          </span>
        </div>

        {loading ? (
          <Loading />
        ) : plans.length === 0 ? (
          <Empty text="Belum ada paket subscription yang dibuat." />
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Nama Paket</th>
                  <th>Harga (IDR)</th>
                  <th>Durasi</th>
                  <th>Batas Pengguna</th>
                  <th>Fitur Unggulan</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((plan) => (
                  <tr key={plan.id}>
                    <td>
                      <strong>{plan.name}</strong>
                      <small style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {plan.description || 'Tanpa deskripsi'}
                      </small>
                    </td>
                    <td>
                      <strong style={{ color: 'var(--ink)' }}>{money.format(plan.price)}</strong>
                    </td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={12} color="var(--mute)" />
                        {plan.duration_days} hari
                      </span>
                    </td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Users size={12} color="var(--mute)" />
                        {plan.max_users} pengguna
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '11px', color: 'var(--mute)' }}>
                        {plan.features?.length ?? 0} fitur
                      </span>
                    </td>
                    <td>
                      <span className={`${styles.badge} ${plan.is_active ? styles.status_active : styles.status_expired}`}>
                        {plan.is_active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        <button
                          className={styles.secondaryButton}
                          type="button"
                          disabled={saving}
                          onClick={() => editPlan(plan)}
                          style={{ minHeight: '30px', padding: '0 10px', fontSize: '11px' }}
                        >
                          <Edit3 size={12} /> Edit
                        </button>
                        <button
                          className={plan.is_active ? styles.dangerButton : styles.primaryButton}
                          type="button"
                          disabled={saving}
                          onClick={() => void togglePlan(plan)}
                          style={{ minHeight: '30px', padding: '0 10px', fontSize: '11px' }}
                        >
                          {plan.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  )
}
