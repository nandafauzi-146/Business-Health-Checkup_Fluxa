'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  ExternalLink,
  Save,
  RotateCcw,
  Plus,
  Trash2,
  Sparkles,
  Layers,
  HelpCircle,
  MessageCircle,
  Bot,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Eye,
  ShieldCheck,
  CircleDollarSign,
  ArrowRight,
  Headset,
  CreditCard,
  Check,
} from 'lucide-react'
import type { LandingCMSContent, FeatureItem, FAQItem, PackageItem } from '@/lib/cms'
import defaultContent from '@/content/landing-default.json'
import styles from './super-admin-cms.module.css'

const AVAILABLE_ICONS = [
  { value: 'ShoppingCart', label: 'Keranjang / Kasir (ShoppingCart)' },
  { value: 'BarChart3', label: 'Grafik / Laporan (BarChart3)' },
  { value: 'Bot', label: 'Robot / AI (Bot)' },
  { value: 'Package', label: 'Paket / Stok (Package)' },
  { value: 'Wallet', label: 'Dompet / Kas (Wallet)' },
  { value: 'Users', label: 'Pengguna / Tim (Users)' },
  { value: 'ShieldCheck', label: 'Keamanan / Verifikasi (ShieldCheck)' },
  { value: 'Sparkles', label: 'Kilau / Fitur AI (Sparkles)' },
  { value: 'TrendingUp', label: 'Tren Naik / Penjualan (TrendingUp)' },
  { value: 'Database', label: 'Database / Data Usaha (Database)' },
  { value: 'CircleDollarSign', label: 'Keuangan / Omzet (CircleDollarSign)' },
]

const AVAILABLE_TONES = [
  { value: 'blue', label: 'Biru (Utama)' },
  { value: 'purple', label: 'Ungu (Kreatif)' },
  { value: 'green', label: 'Hijau (Sukses)' },
  { value: 'orange', label: 'Oranye (Perhatian)' },
  { value: 'cyan', label: 'Sian (Modern)' },
  { value: 'pink', label: 'Merah Muda (Aksen)' },
]

type CMSTab = 'hero' | 'features' | 'ai' | 'pricing' | 'contact' | 'faq' | 'trial'

export default function SuperAdminCMS() {
  const [content, setContent] = useState<LandingCMSContent>(
    () => JSON.parse(JSON.stringify(defaultContent)) as LandingCMSContent
  )
  const [activeTab, setActiveTab] = useState<CMSTab>('hero')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message })
    setTimeout(() => {
      setToast(null)
    }, 4000)
  }

  const loadContent = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/super-admin/cms', { cache: 'no-store' })
      const data = await res.json()
      if (res.ok && data.content) {
        setContent(data.content)
      } else {
        showToast('error', data.error || 'Gagal memuat data CMS.')
      }
    } catch (err) {
      console.error('Fetch CMS error:', err)
      showToast('error', 'Terjadi kesalahan jaringan saat memuat CMS.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadContent()
  }, [loadContent])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/super-admin/cms', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      const data = await res.json()
      if (res.ok) {
        setContent(data.content)
        showToast('success', data.message || 'Konten berhasil diperbarui!')
      } else {
        showToast('error', data.error || 'Gagal menyimpan perubahan.')
      }
    } catch (err) {
      console.error('Save CMS error:', err)
      showToast('error', 'Terjadi kesalahan saat menyimpan.')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    if (!window.confirm('Apakah Anda yakin ingin mengembalikan semua teks Landing Page ke pengaturan bawaan pabrik?')) {
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/super-admin/cms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' }),
      })
      const data = await res.json()
      if (res.ok) {
        setContent(data.content)
        showToast('success', 'Konten berhasil dikembalikan ke pengaturan bawaan!')
      } else {
        showToast('error', data.error || 'Gagal mereset konten.')
      }
    } catch (err) {
      console.error('Reset CMS error:', err)
      showToast('error', 'Terjadi kesalahan saat mereset.')
    } finally {
      setSaving(false)
    }
  }

  // Feature list handlers
  const handleAddFeature = () => {
    const newItem: FeatureItem = {
      icon: 'Sparkles',
      title: 'Fitur Baru',
      description: 'Deskripsi singkat mengenai manfaat fitur ini bagi pengguna.',
      tone: 'blue',
    }
    setContent((prev) => ({
      ...prev,
      features: [...prev.features, newItem],
    }))
  }

  const handleRemoveFeature = (index: number) => {
    setContent((prev) => ({
      ...prev,
      features: prev.features.filter((_, i) => i !== index),
    }))
  }

  const handleUpdateFeature = (index: number, patch: Partial<FeatureItem>) => {
    setContent((prev) => {
      const updated = [...prev.features]
      updated[index] = { ...updated[index], ...patch }
      return { ...prev, features: updated }
    })
  }

  // FAQ list handlers
  const handleAddFAQ = () => {
    const newItem: FAQItem = {
      question: 'Pertanyaan baru mengenai Fluxa?',
      answer: 'Penjelasan atau jawaban lengkap mengenai pertanyaan tersebut.',
    }
    setContent((prev) => ({
      ...prev,
      faqs: [...prev.faqs, newItem],
    }))
  }

  const handleRemoveFAQ = (index: number) => {
    setContent((prev) => ({
      ...prev,
      faqs: prev.faqs.filter((_, i) => i !== index),
    }))
  }

  const handleUpdateFAQ = (index: number, patch: Partial<FAQItem>) => {
    setContent((prev) => {
      const updated = [...prev.faqs]
      updated[index] = { ...updated[index], ...patch }
      return { ...prev, faqs: updated }
    })
  }

  // Checklist handlers
  const handleAddChecklist = () => {
    setContent((prev) => ({
      ...prev,
      aiInsight: {
        ...prev.aiInsight,
        checklist: [...prev.aiInsight.checklist, 'Poin analisis baru'],
      },
    }))
  }

  const handleRemoveChecklist = (index: number) => {
    setContent((prev) => ({
      ...prev,
      aiInsight: {
        ...prev.aiInsight,
        checklist: prev.aiInsight.checklist.filter((_, i) => i !== index),
      },
    }))
  }

  const handleUpdateChecklist = (index: number, value: string) => {
    setContent((prev) => {
      const list = [...prev.aiInsight.checklist]
      list[index] = value
      return {
        ...prev,
        aiInsight: { ...prev.aiInsight, checklist: list },
      }
    })
  }

  // Pricing package handlers
  const handleAddPackage = () => {
    const newPkg: PackageItem = {
      name: 'Paket Baru',
      description: 'Deskripsi peruntukan paket ini.',
      priceLabel: 'Hubungi kami',
      priceSublabel: 'untuk informasi harga',
      featured: false,
      badge: '',
      features: ['Fitur utama paket'],
    }
    setContent((prev) => ({
      ...prev,
      pricing: {
        ...prev.pricing,
        packages: [...(prev.pricing?.packages || []), newPkg],
      },
    }))
  }

  const handleRemovePackage = (index: number) => {
    setContent((prev) => ({
      ...prev,
      pricing: {
        ...prev.pricing,
        packages: (prev.pricing?.packages || []).filter((_, i) => i !== index),
      },
    }))
  }

  const handleUpdatePackage = (index: number, patch: Partial<PackageItem>) => {
    setContent((prev) => {
      const list = [...(prev.pricing?.packages || [])]
      list[index] = { ...list[index], ...patch }
      return {
        ...prev,
        pricing: { ...prev.pricing, packages: list },
      }
    })
  }

  const handleAddPackageFeature = (pkgIndex: number) => {
    setContent((prev) => {
      const list = [...(prev.pricing?.packages || [])]
      const currentFeatures = list[pkgIndex]?.features || []
      list[pkgIndex] = {
        ...list[pkgIndex],
        features: [...currentFeatures, 'Fitur baru'],
      }
      return {
        ...prev,
        pricing: { ...prev.pricing, packages: list },
      }
    })
  }

  const handleRemovePackageFeature = (pkgIndex: number, featureIndex: number) => {
    setContent((prev) => {
      const list = [...(prev.pricing?.packages || [])]
      const currentFeatures = (list[pkgIndex]?.features || []).filter((_, i) => i !== featureIndex)
      list[pkgIndex] = {
        ...list[pkgIndex],
        features: currentFeatures,
      }
      return {
        ...prev,
        pricing: { ...prev.pricing, packages: list },
      }
    })
  }

  const handleUpdatePackageFeature = (pkgIndex: number, featureIndex: number, value: string) => {
    setContent((prev) => {
      const list = [...(prev.pricing?.packages || [])]
      const currentFeatures = [...(list[pkgIndex]?.features || [])]
      currentFeatures[featureIndex] = value
      list[pkgIndex] = {
        ...list[pkgIndex],
        features: currentFeatures,
      }
      return {
        ...prev,
        pricing: { ...prev.pricing, packages: list },
      }
    })
  }

  return (
    <section className={styles.page}>
      {/* Toast Notification */}
      {toast && (
        <div className={`${styles.toast} ${toast.type === 'success' ? styles.toastSuccess : styles.toastError}`}>
          {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Heading */}
      <div className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>CONTENT MANAGEMENT SYSTEM</span>
          <h1>Manajemen Landing Page (CMS)</h1>
          <p>
            Ubah teks, judul, banner, kontak WhatsApp, dan FAQ di halaman depan tanpa perlu coding.
          </p>
        </div>
        <div className={styles.headerActions}>
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.secondaryButton}
            title="Buka Landing Page di tab baru"
          >
            <ExternalLink size={15} /> Lihat Website Utama
          </a>
          <button
            type="button"
            className={styles.dangerButton}
            onClick={handleReset}
            disabled={saving || loading}
            title="Kembalikan semua teks ke bawaan awal"
          >
            <RotateCcw size={14} /> Reset Bawaan
          </button>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={handleSave}
            disabled={saving || loading}
          >
            {saving ? <RefreshCw size={15} className={styles.spin} /> : <Save size={15} />}
            {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <nav className={styles.tabsContainer} aria-label="Kategori CMS Landing Page">
        <button
          type="button"
          className={`${styles.tabButton} ${activeTab === 'hero' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('hero')}
        >
          <Eye size={15} /> Hero &amp; Banner Utama
        </button>
        <button
          type="button"
          className={`${styles.tabButton} ${activeTab === 'features' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('features')}
        >
          <Layers size={15} /> Fitur Unggulan ({content.features?.length ?? 0})
        </button>
        <button
          type="button"
          className={`${styles.tabButton} ${activeTab === 'ai' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('ai')}
        >
          <Bot size={15} /> AI &amp; Cara Kerja
        </button>
        <button
          type="button"
          className={`${styles.tabButton} ${activeTab === 'pricing' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('pricing')}
        >
          <CreditCard size={15} /> Paket Langganan ({content.pricing?.packages?.length ?? 3})
        </button>
        <button
          type="button"
          className={`${styles.tabButton} ${activeTab === 'contact' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('contact')}
        >
          <MessageCircle size={15} /> Kontak &amp; WhatsApp
        </button>
        <button
          type="button"
          className={`${styles.tabButton} ${activeTab === 'faq' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('faq')}
        >
          <HelpCircle size={15} /> Tanya Jawab FAQ ({content.faqs?.length ?? 0})
        </button>
        <button
          type="button"
          className={`${styles.tabButton} ${activeTab === 'trial' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('trial')}
        >
          <Sparkles size={15} /> Banner Trial &amp; Footer
        </button>
      </nav>

      {/* Main CMS Grid (Form on left, Preview on right) */}
      <div className={styles.cmsGrid}>
        {/* Left Form Area */}
        <div className={styles.formPanel}>
          {/* TAB 1: HERO */}
          {activeTab === 'hero' && (
            <>
              <div className={styles.fieldRow}>
                <div className={styles.fieldGroup}>
                  <label>Pill / Kategori Kecil <span>(Paling atas)</span></label>
                  <input
                    type="text"
                    className={styles.input}
                    value={content.hero.eyebrow}
                    onChange={(e) =>
                      setContent((prev) => ({
                        ...prev,
                        hero: { ...prev.hero, eyebrow: e.target.value },
                      }))
                    }
                    placeholder="Contoh: Platform bisnis untuk UMKM modern"
                  />
                </div>
                <div className={styles.fieldGroup}>
                  <label>Badge Tambahan <span>(Sebelah kanan pill)</span></label>
                  <input
                    type="text"
                    className={styles.input}
                    value={content.hero.badge}
                    onChange={(e) =>
                      setContent((prev) => ({
                        ...prev,
                        hero: { ...prev.hero, badge: e.target.value },
                      }))
                    }
                    placeholder="Contoh: Data usaha, satu dashboard"
                  />
                </div>
              </div>

              <div className={styles.fieldGroup}>
                <label>Judul Utama Baris 1 <span>(Wajib)</span></label>
                <input
                  type="text"
                  className={styles.input}
                  value={content.hero.title}
                  onChange={(e) =>
                    setContent((prev) => ({
                      ...prev,
                      hero: { ...prev.hero, title: e.target.value },
                    }))
                  }
                  placeholder="Contoh: Bisnis lebih terarah."
                />
              </div>

              <div className={styles.fieldGroup}>
                <label>Judul Sorotan Berwarna (Baris 2) <span>(Aksen teks)</span></label>
                <input
                  type="text"
                  className={styles.input}
                  value={content.hero.titleHighlight}
                  onChange={(e) =>
                    setContent((prev) => ({
                      ...prev,
                      hero: { ...prev.hero, titleHighlight: e.target.value },
                    }))
                  }
                  placeholder="Contoh: Tumbuh lebih percaya diri."
                />
              </div>

              <div className={styles.fieldGroup}>
                <label>Deskripsi Hero <span>(Penjelasan singkat platform)</span></label>
                <textarea
                  className={styles.textarea}
                  value={content.hero.description}
                  onChange={(e) =>
                    setContent((prev) => ({
                      ...prev,
                      hero: { ...prev.hero, description: e.target.value },
                    }))
                  }
                  placeholder="Tuliskan deskripsi utama yang menarik calon pemilik usaha..."
                />
              </div>

              <div className={styles.fieldRow}>
                <div className={styles.fieldGroup}>
                  <label>Teks Tombol Utama (CTA)</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={content.hero.ctaText}
                    onChange={(e) =>
                      setContent((prev) => ({
                        ...prev,
                        hero: { ...prev.hero, ctaText: e.target.value },
                      }))
                    }
                    placeholder="Contoh: Coba gratis 7 hari"
                  />
                </div>
                <div className={styles.fieldGroup}>
                  <label>Teks Tombol Sekunder</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={content.hero.ctaSecondaryText}
                    onChange={(e) =>
                      setContent((prev) => ({
                        ...prev,
                        hero: { ...prev.hero, ctaSecondaryText: e.target.value },
                      }))
                    }
                    placeholder="Contoh: Kenali cara kerjanya"
                  />
                </div>
              </div>

              <div className={styles.fieldGroup}>
                <label>Catatan Kepercayaan <span>(Bawah tombol CTA)</span></label>
                <input
                  type="text"
                  className={styles.input}
                  value={content.hero.trustNote}
                  onChange={(e) =>
                    setContent((prev) => ({
                      ...prev,
                      hero: { ...prev.hero, trustNote: e.target.value },
                    }))
                  }
                  placeholder="Contoh: Satu platform untuk operasional dan insight bisnis"
                />
              </div>
            </>
          )}

          {/* TAB 2: FEATURES */}
          {activeTab === 'features' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <strong style={{ fontSize: 13 }}>Daftar Kartu Fitur</strong>
                  <p className={styles.hint}>Kartu fitur yang ditampilkan di bagian &quot;Semua Yang Dibutuhkan&quot;.</p>
                </div>
                <button type="button" className={styles.addItemButton} onClick={handleAddFeature}>
                  <Plus size={15} /> Tambah Fitur
                </button>
              </div>

              <div className={styles.itemList}>
                {content.features.map((item, idx) => (
                  <div className={styles.itemCard} key={idx}>
                    <div className={styles.itemCardHead}>
                      <span className={styles.itemIndex}>Fitur #{idx + 1}</span>
                      {content.features.length > 1 && (
                        <button
                          type="button"
                          className={styles.removeButton}
                          onClick={() => handleRemoveFeature(idx)}
                          title="Hapus kartu fitur ini"
                        >
                          <Trash2 size={13} /> Hapus
                        </button>
                      )}
                    </div>

                    <div className={styles.fieldRow}>
                      <div className={styles.fieldGroup}>
                        <label>Judul Fitur</label>
                        <input
                          type="text"
                          className={styles.input}
                          value={item.title}
                          onChange={(e) => handleUpdateFeature(idx, { title: e.target.value })}
                        />
                      </div>
                      <div className={styles.fieldGroup}>
                        <label>Pilihan Ikon</label>
                        <select
                          className={styles.select}
                          value={item.icon}
                          onChange={(e) => handleUpdateFeature(idx, { icon: e.target.value })}
                        >
                          {AVAILABLE_ICONS.map((ic) => (
                            <option key={ic.value} value={ic.value}>{ic.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className={styles.fieldRow}>
                      <div className={styles.fieldGroup}>
                        <label>Warna Aksen Ikon</label>
                        <select
                          className={styles.select}
                          value={item.tone}
                          onChange={(e) => handleUpdateFeature(idx, { tone: e.target.value as FeatureItem['tone'] })}
                        >
                          {AVAILABLE_TONES.map((t) => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className={styles.fieldGroup}>
                        <label>Deskripsi Singkat</label>
                        <input
                          type="text"
                          className={styles.input}
                          value={item.description}
                          onChange={(e) => handleUpdateFeature(idx, { description: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* TAB 3: AI & CARA KERJA */}
          {activeTab === 'ai' && (
            <>
              <strong style={{ fontSize: 14 }}>Bagian AI Insight</strong>
              <div className={styles.fieldRow}>
                <div className={styles.fieldGroup}>
                  <label>Label Kategori</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={content.aiInsight.eyebrow}
                    onChange={(e) =>
                      setContent((prev) => ({
                        ...prev,
                        aiInsight: { ...prev.aiInsight, eyebrow: e.target.value },
                      }))
                    }
                  />
                </div>
                <div className={styles.fieldGroup}>
                  <label>Judul Utama</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={content.aiInsight.title}
                    onChange={(e) =>
                      setContent((prev) => ({
                        ...prev,
                        aiInsight: { ...prev.aiInsight, title: e.target.value },
                      }))
                    }
                  />
                </div>
              </div>

              <div className={styles.fieldGroup}>
                <label>Judul Sorotan (Baris 2)</label>
                <input
                  type="text"
                  className={styles.input}
                  value={content.aiInsight.titleHighlight}
                  onChange={(e) =>
                    setContent((prev) => ({
                      ...prev,
                      aiInsight: { ...prev.aiInsight, titleHighlight: e.target.value },
                    }))
                  }
                />
              </div>

              <div className={styles.fieldGroup}>
                <label>Deskripsi AI Insight</label>
                <textarea
                  className={styles.textarea}
                  value={content.aiInsight.description}
                  onChange={(e) =>
                    setContent((prev) => ({
                      ...prev,
                      aiInsight: { ...prev.aiInsight, description: e.target.value },
                    }))
                  }
                />
              </div>

              <div className={styles.fieldGroup}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <label>Poin Keunggulan (Checklist)</label>
                  <button type="button" className={styles.addItemButton} onClick={handleAddChecklist} style={{ padding: '4px 10px' }}>
                    <Plus size={13} /> Tambah Poin
                  </button>
                </div>
                {content.aiInsight.checklist.map((pt, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                    <input
                      type="text"
                      className={styles.input}
                      value={pt}
                      onChange={(e) => handleUpdateChecklist(idx, e.target.value)}
                    />
                    {content.aiInsight.checklist.length > 1 && (
                      <button
                        type="button"
                        className={styles.removeButton}
                        onClick={() => handleRemoveChecklist(idx)}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '14px 0' }} />

              <strong style={{ fontSize: 14 }}>4 Langkah Operasional (Cara Kerja)</strong>
              <div className={styles.itemList}>
                {content.steps.map((step, idx) => (
                  <div className={styles.itemCard} key={idx}>
                    <div className={styles.itemCardHead}>
                      <span className={styles.itemIndex}>Langkah {step.number} ({step.label})</span>
                    </div>
                    <div className={styles.fieldRow}>
                      <div className={styles.fieldGroup}>
                        <label>Judul Langkah</label>
                        <input
                          type="text"
                          className={styles.input}
                          value={step.title}
                          onChange={(e) => {
                            const newSteps = [...content.steps]
                            newSteps[idx] = { ...newSteps[idx], title: e.target.value }
                            setContent((prev) => ({ ...prev, steps: newSteps }))
                          }}
                        />
                      </div>
                      <div className={styles.fieldGroup}>
                        <label>Tagline Detail</label>
                        <input
                          type="text"
                          className={styles.input}
                          value={step.detail}
                          onChange={(e) => {
                            const newSteps = [...content.steps]
                            newSteps[idx] = { ...newSteps[idx], detail: e.target.value }
                            setContent((prev) => ({ ...prev, steps: newSteps }))
                          }}
                        />
                      </div>
                    </div>
                    <div className={styles.fieldGroup}>
                      <label>Deskripsi Langkah</label>
                      <input
                        type="text"
                        className={styles.input}
                        value={step.description}
                        onChange={(e) => {
                          const newSteps = [...content.steps]
                          newSteps[idx] = { ...newSteps[idx], description: e.target.value }
                          setContent((prev) => ({ ...prev, steps: newSteps }))
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* TAB 4: PRICING (PAKET LANGGANAN) */}
          {activeTab === 'pricing' && (
            <>
              <strong style={{ fontSize: 14 }}>Bagian Judul &amp; Keterangan Paket</strong>
              <div className={styles.fieldRow}>
                <div className={styles.fieldGroup}>
                  <label>Label Kategori <span>(Eyebrow)</span></label>
                  <input
                    type="text"
                    className={styles.input}
                    value={content.pricing?.eyebrow || ''}
                    onChange={(e) =>
                      setContent((prev) => ({
                        ...prev,
                        pricing: { ...prev.pricing, eyebrow: e.target.value },
                      }))
                    }
                    placeholder="Contoh: PILIH SESUAI KEBUTUHAN"
                  />
                </div>
                <div className={styles.fieldGroup}>
                  <label>Judul Utama Baris 1</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={content.pricing?.title || ''}
                    onChange={(e) =>
                      setContent((prev) => ({
                        ...prev,
                        pricing: { ...prev.pricing, title: e.target.value },
                      }))
                    }
                    placeholder="Contoh: Paket yang tumbuh"
                  />
                </div>
              </div>

              <div className={styles.fieldRow}>
                <div className={styles.fieldGroup}>
                  <label>Judul Sorotan Berwarna (Baris 2)</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={content.pricing?.titleHighlight || ''}
                    onChange={(e) =>
                      setContent((prev) => ({
                        ...prev,
                        pricing: { ...prev.pricing, titleHighlight: e.target.value },
                      }))
                    }
                    placeholder="Contoh: bersama bisnis Anda."
                  />
                </div>
                <div className={styles.fieldGroup}>
                  <label>Teks Tombol Aksi Paket</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={content.pricing?.buttonText || ''}
                    onChange={(e) =>
                      setContent((prev) => ({
                        ...prev,
                        pricing: { ...prev.pricing, buttonText: e.target.value },
                      }))
                    }
                    placeholder="Contoh: Tanyakan paket"
                  />
                </div>
              </div>

              <div className={styles.fieldGroup}>
                <label>Deskripsi Bagian Paket</label>
                <textarea
                  className={styles.textarea}
                  value={content.pricing?.description || ''}
                  onChange={(e) =>
                    setContent((prev) => ({
                      ...prev,
                      pricing: { ...prev.pricing, description: e.target.value },
                    }))
                  }
                  placeholder="Mulai dengan trial 7 hari, lalu pilih kategori paket..."
                />
              </div>

              <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '14px 0' }} />

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <strong style={{ fontSize: 13 }}>Daftar Kartu Paket Langganan</strong>
                  <p className={styles.hint}>Kartu paket yang ditampilkan kepada calon pelanggan di landing page.</p>
                </div>
                <button type="button" className={styles.addItemButton} onClick={handleAddPackage}>
                  <Plus size={15} /> Tambah Paket
                </button>
              </div>

              <div className={styles.itemList}>
                {(content.pricing?.packages || []).map((pkg, idx) => (
                  <div className={styles.itemCard} key={idx}>
                    <div className={styles.itemCardHead}>
                      <span className={styles.itemIndex}>Paket #{idx + 1}: {pkg.name}</span>
                      {(content.pricing?.packages || []).length > 1 && (
                        <button
                          type="button"
                          className={styles.removeButton}
                          onClick={() => handleRemovePackage(idx)}
                        >
                          <Trash2 size={13} /> Hapus Paket
                        </button>
                      )}
                    </div>

                    <div className={styles.fieldRow}>
                      <div className={styles.fieldGroup}>
                        <label>Nama Paket</label>
                        <input
                          type="text"
                          className={styles.input}
                          value={pkg.name}
                          onChange={(e) => handleUpdatePackage(idx, { name: e.target.value })}
                        />
                      </div>
                      <div className={styles.fieldGroup}>
                        <label>Label Harga <span>(Contoh: Hubungi kami / Rp 49.000)</span></label>
                        <input
                          type="text"
                          className={styles.input}
                          value={pkg.priceLabel}
                          onChange={(e) => handleUpdatePackage(idx, { priceLabel: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className={styles.fieldRow}>
                      <div className={styles.fieldGroup}>
                        <label>Sublabel Harga <span>(Contoh: untuk informasi harga / per bulan)</span></label>
                        <input
                          type="text"
                          className={styles.input}
                          value={pkg.priceSublabel}
                          onChange={(e) => handleUpdatePackage(idx, { priceSublabel: e.target.value })}
                        />
                      </div>
                      <div className={styles.fieldGroup}>
                        <label>Teks Badge Pilihan</label>
                        <input
                          type="text"
                          className={styles.input}
                          value={pkg.badge || ''}
                          placeholder="Pilihan bisnis"
                          onChange={(e) => handleUpdatePackage(idx, { badge: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className={styles.fieldGroup}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={Boolean(pkg.featured)}
                          onChange={(e) => handleUpdatePackage(idx, { featured: e.target.checked })}
                          style={{ width: 16, height: 16 }}
                        />
                        <span>Tandai sebagai Paket Unggulan (Sorotan / Rekomendasi Utama)</span>
                      </label>
                    </div>

                    <div className={styles.fieldGroup}>
                      <label>Deskripsi Singkat Paket</label>
                      <input
                        type="text"
                        className={styles.input}
                        value={pkg.description}
                        onChange={(e) => handleUpdatePackage(idx, { description: e.target.value })}
                      />
                    </div>

                    <div className={styles.fieldGroup} style={{ marginTop: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <label>Fitur-fitur yang Termasuk:</label>
                        <button
                          type="button"
                          className={styles.addItemButton}
                          onClick={() => handleAddPackageFeature(idx)}
                          style={{ padding: '3px 8px', fontSize: 11 }}
                        >
                          <Plus size={12} /> Tambah Fitur
                        </button>
                      </div>
                      {(pkg.features || []).map((feat, fIdx) => (
                        <div key={fIdx} style={{ display: 'flex', gap: 8, marginBottom: 5 }}>
                          <input
                            type="text"
                            className={styles.input}
                            value={feat}
                            onChange={(e) => handleUpdatePackageFeature(idx, fIdx, e.target.value)}
                            placeholder="Tuliskan nama fitur..."
                          />
                          {(pkg.features || []).length > 1 && (
                            <button
                              type="button"
                              className={styles.removeButton}
                              onClick={() => handleRemovePackageFeature(idx, fIdx)}
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* TAB 5: CONTACT & WHATSAPP */}
          {activeTab === 'contact' && (
            <>
              <div className={styles.fieldGroup}>
                <label>Nomor WhatsApp Admin <span>(Format internasional tanpa +, contoh: 628980148297)</span></label>
                <input
                  type="text"
                  className={styles.input}
                  value={content.contact.whatsappNumber}
                  onChange={(e) =>
                    setContent((prev) => ({
                      ...prev,
                      contact: { ...prev.contact, whatsappNumber: e.target.value.replace(/\D/g, '') },
                    }))
                  }
                  placeholder="628123456789"
                />
                <span className={styles.hint}>
                  Saat calon pengguna menekan tombol WhatsApp di landing page, pesan akan otomatis dikirimkan ke nomor ini.
                </span>
              </div>

              <div className={styles.fieldGroup}>
                <label>Template Pesan WhatsApp Otomatis</label>
                <textarea
                  className={styles.textarea}
                  style={{ minHeight: 120 }}
                  value={content.contact.whatsappMessage}
                  onChange={(e) =>
                    setContent((prev) => ({
                      ...prev,
                      contact: { ...prev.contact, whatsappMessage: e.target.value },
                    }))
                  }
                  placeholder="Teks pesan awal yang otomatis terisi saat pengunjung membuka chat WhatsApp..."
                />
              </div>

              <div className={styles.fieldRow}>
                <div className={styles.fieldGroup}>
                  <label>Label Kategori Kartu</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={content.contact.eyebrow}
                    onChange={(e) =>
                      setContent((prev) => ({
                        ...prev,
                        contact: { ...prev.contact, eyebrow: e.target.value },
                      }))
                    }
                  />
                </div>
                <div className={styles.fieldGroup}>
                  <label>Teks Tombol Chat</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={content.contact.buttonText}
                    onChange={(e) =>
                      setContent((prev) => ({
                        ...prev,
                        contact: { ...prev.contact, buttonText: e.target.value },
                      }))
                    }
                  />
                </div>
              </div>

              <div className={styles.fieldGroup}>
                <label>Judul Kartu Kontak</label>
                <input
                  type="text"
                  className={styles.input}
                  value={content.contact.heading}
                  onChange={(e) =>
                    setContent((prev) => ({
                      ...prev,
                      contact: { ...prev.contact, heading: e.target.value },
                    }))
                  }
                />
              </div>

              <div className={styles.fieldGroup}>
                <label>Deskripsi Ajakan Kontak</label>
                <textarea
                  className={styles.textarea}
                  value={content.contact.description}
                  onChange={(e) =>
                    setContent((prev) => ({
                      ...prev,
                      contact: { ...prev.contact, description: e.target.value },
                    }))
                  }
                />
              </div>
            </>
          )}

          {/* TAB 5: FAQ */}
          {activeTab === 'faq' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <strong style={{ fontSize: 13 }}>Daftar Pertanyaan &amp; Jawaban</strong>
                  <p className={styles.hint}>FAQ yang ditampilkan di bagian bawah landing page.</p>
                </div>
                <button type="button" className={styles.addItemButton} onClick={handleAddFAQ}>
                  <Plus size={15} /> Tambah Pertanyaan
                </button>
              </div>

              <div className={styles.itemList}>
                {content.faqs.map((faq, idx) => (
                  <div className={styles.itemCard} key={idx}>
                    <div className={styles.itemCardHead}>
                      <span className={styles.itemIndex}>Pertanyaan #{idx + 1}</span>
                      {content.faqs.length > 1 && (
                        <button
                          type="button"
                          className={styles.removeButton}
                          onClick={() => handleRemoveFAQ(idx)}
                        >
                          <Trash2 size={13} /> Hapus
                        </button>
                      )}
                    </div>
                    <div className={styles.fieldGroup}>
                      <label>Pertanyaan</label>
                      <input
                        type="text"
                        className={styles.input}
                        value={faq.question}
                        onChange={(e) => handleUpdateFAQ(idx, { question: e.target.value })}
                      />
                    </div>
                    <div className={styles.fieldGroup}>
                      <label>Jawaban</label>
                      <textarea
                        className={styles.textarea}
                        value={faq.answer}
                        onChange={(e) => handleUpdateFAQ(idx, { answer: e.target.value })}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* TAB 6: TRIAL BANNER & FOOTER */}
          {activeTab === 'trial' && (
            <>
              <strong style={{ fontSize: 14 }}>Banner Registrasi / Trial</strong>
              <div className={styles.fieldRow}>
                <div className={styles.fieldGroup}>
                  <label>Pill / Label Aksen</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={content.trialBanner.pill}
                    onChange={(e) =>
                      setContent((prev) => ({
                        ...prev,
                        trialBanner: { ...prev.trialBanner, pill: e.target.value },
                      }))
                    }
                  />
                </div>
                <div className={styles.fieldGroup}>
                  <label>Teks Tombol Daftar</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={content.trialBanner.ctaText}
                    onChange={(e) =>
                      setContent((prev) => ({
                        ...prev,
                        trialBanner: { ...prev.trialBanner, ctaText: e.target.value },
                      }))
                    }
                  />
                </div>
              </div>

              <div className={styles.fieldRow}>
                <div className={styles.fieldGroup}>
                  <label>Judul Banner</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={content.trialBanner.title}
                    onChange={(e) =>
                      setContent((prev) => ({
                        ...prev,
                        trialBanner: { ...prev.trialBanner, title: e.target.value },
                      }))
                    }
                  />
                </div>
                <div className={styles.fieldGroup}>
                  <label>Judul Sorotan Berwarna</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={content.trialBanner.titleHighlight}
                    onChange={(e) =>
                      setContent((prev) => ({
                        ...prev,
                        trialBanner: { ...prev.trialBanner, titleHighlight: e.target.value },
                      }))
                    }
                  />
                </div>
              </div>

              <div className={styles.fieldGroup}>
                <label>Deskripsi Banner</label>
                <textarea
                  className={styles.textarea}
                  value={content.trialBanner.description}
                  onChange={(e) =>
                    setContent((prev) => ({
                      ...prev,
                      trialBanner: { ...prev.trialBanner, description: e.target.value },
                    }))
                  }
                />
              </div>

              <div className={styles.fieldGroup}>
                <label>Catatan Kaki Banner</label>
                <input
                  type="text"
                  className={styles.input}
                  value={content.trialBanner.footnote}
                  onChange={(e) =>
                    setContent((prev) => ({
                      ...prev,
                      trialBanner: { ...prev.trialBanner, footnote: e.target.value },
                    }))
                  }
                />
              </div>

              <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '14px 0' }} />

              <strong style={{ fontSize: 14 }}>Pengaturan Footer</strong>
              <div className={styles.fieldRow}>
                <div className={styles.fieldGroup}>
                  <label>Slogan / Tagline Footer</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={content.footer.tagline}
                    onChange={(e) =>
                      setContent((prev) => ({
                        ...prev,
                        footer: { ...prev.footer, tagline: e.target.value },
                      }))
                    }
                  />
                </div>
                <div className={styles.fieldGroup}>
                  <label>Teks Hak Cipta (Copyright)</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={content.footer.copyright}
                    onChange={(e) =>
                      setContent((prev) => ({
                        ...prev,
                        footer: { ...prev.footer, copyright: e.target.value },
                      }))
                    }
                  />
                </div>
              </div>
            </>
          )}

          {/* Bottom Save Action */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12, borderTop: '1px solid var(--line)', paddingTop: 16 }}>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={handleSave}
              disabled={saving || loading}
            >
              {saving ? <RefreshCw size={15} className={styles.spin} /> : <Save size={15} />}
              {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </div>
        </div>

        {/* Right Preview Side Panel */}
        <aside className={styles.previewPanel}>
          <div className={styles.previewHeader}>
            <h3>
              <Eye size={15} /> Pratinjau Tampilan Cepat
            </h3>
            <span className={styles.previewLiveBadge}>● Real-time</span>
          </div>

          <p className={styles.hint} style={{ margin: 0 }}>
            Tampilan di bawah ini merender teks yang sedang Anda ketik secara langsung sebelum disimpan.
          </p>

          {/* Mini Card Preview of current Hero or Pricing */}
          {activeTab === 'pricing' ? (
            <div className={styles.miniPreviewCard}>
              <span className={styles.miniPill}>
                <CreditCard size={13} /> {content.pricing?.eyebrow || 'PILIH SESUAI KEBUTUHAN'}
              </span>
              <h4 className={styles.miniTitle}>
                {content.pricing?.title || 'Paket yang tumbuh'}{' '}
                <span className={styles.miniTitleHighlight}>{content.pricing?.titleHighlight || 'bersama bisnis Anda.'}</span>
              </h4>
              <p className={styles.miniDesc}>{content.pricing?.description}</p>
              <div style={{ display: 'grid', gap: 8, marginTop: 4 }}>
                {(content.pricing?.packages || []).slice(0, 3).map((pkg, pIdx) => (
                  <div key={pIdx} style={{ padding: 10, border: '1px solid var(--line)', borderRadius: 8, background: pkg.featured ? 'color-mix(in srgb, var(--role-acc, var(--acc)) 8%, var(--panel))' : 'var(--panel)', display: 'grid', gap: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: 12 }}>{pkg.name}</strong>
                      {pkg.featured && <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 10, background: 'var(--role-acc, var(--acc))', color: '#fff', fontWeight: 700 }}>{pkg.badge || 'Pilihan'}</span>}
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--mute)' }}>{pkg.priceLabel} · {pkg.priceSublabel}</span>
                    <ul style={{ margin: 0, paddingLeft: 14, fontSize: 10, color: 'var(--mute)' }}>
                      {(pkg.features || []).slice(0, 2).map((f, fi) => (
                        <li key={fi}>{f}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className={styles.miniPreviewCard}>
              <span className={styles.miniPill}>
                <CircleDollarSign size={13} /> {content.hero.eyebrow || 'Platform UMKM'}
              </span>
              <h4 className={styles.miniTitle}>
                {content.hero.title || 'Bisnis lebih terarah.'}{' '}
                <span className={styles.miniTitleHighlight}>{content.hero.titleHighlight}</span>
              </h4>
              <p className={styles.miniDesc}>{content.hero.description}</p>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className={styles.miniBtn}>
                  {content.hero.ctaText || 'Coba Sekarang'} <ArrowRight size={13} />
                </span>
                <span style={{ fontSize: 11, color: 'var(--mute)' }}>{content.hero.ctaSecondaryText}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--mute)' }}>
                <ShieldCheck size={14} /> {content.hero.trustNote}
              </div>
            </div>
          )}

          {/* Contact quick review */}
          <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 12, background: 'var(--panel)', display: 'grid', gap: 6 }}>
            <strong style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Headset size={14} /> Target WhatsApp:
            </strong>
            <span style={{ fontSize: 12, color: 'var(--role-acc, var(--acc))', fontWeight: 600 }}>
              +{content.contact.whatsappNumber || '628980148297'}
            </span>
            <small style={{ color: 'var(--mute)', fontSize: 10 }}>
              Tombol WhatsApp di beranda akan langsung membuka chat ke nomor di atas.
            </small>
          </div>

          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.secondaryButton}
            style={{ width: '100%' }}
          >
            <ExternalLink size={14} /> Buka Website di Tab Baru
          </a>
        </aside>
      </div>
    </section>
  )
}
