'use client'

import { useState, useMemo, useEffect } from 'react'
import {
  Tag, Plus, Percent, DollarSign, Calendar, Check, X,
  AlertCircle, Edit2, Trash2, Copy, CheckCircle2, Search,
  Sparkles, ShoppingCart, ToggleLeft, ToggleRight, ArrowRight
} from 'lucide-react'
import { PageHeader } from '@/components/layout/Topbar'
import { SectionCard, StatusTag, KpiCard, FormatRupiah } from '@/components/ui/Cards'

export interface Promotion {
  id: string
  code: string
  name: string
  type: 'percentage' | 'fixed'
  value: number
  min_purchase: number
  max_discount?: number | null
  start_date: string
  end_date?: string | null
  is_active: boolean
  description?: string | null
  created_at?: string
}

const DEMO_PROMOTIONS: Promotion[] = [
  {
    id: 'p-1',
    code: 'HEMAT10',
    name: 'Diskon Belanja 10%',
    type: 'percentage',
    value: 10,
    min_purchase: 50000,
    max_discount: 25000,
    start_date: '2026-10-01',
    end_date: '2026-10-31',
    is_active: true,
    description: 'Diskon 10% minimal belanja Rp50.000, maksimal potongan Rp25.000'
  },
  {
    id: 'p-2',
    code: 'FLUXA20K',
    name: 'Potongan Langsung Rp20.000',
    type: 'fixed',
    value: 20000,
    min_purchase: 100000,
    max_discount: null,
    start_date: '2026-10-01',
    end_date: null,
    is_active: true,
    description: 'Potongan langsung Rp20.000 untuk belanja di atas Rp100.000'
  },
  {
    id: 'p-3',
    code: 'MEMBER5K',
    name: 'Spesial Member Baru',
    type: 'fixed',
    value: 5000,
    min_purchase: 25000,
    max_discount: null,
    start_date: '2026-09-01',
    end_date: null,
    is_active: true,
    description: 'Potongan Rp5.000 tanpa syarat khusus untuk pelanggan terdaftar'
  },
  {
    id: 'p-4',
    code: 'PROMOFLASH',
    name: 'Flash Sale 25%',
    type: 'percentage',
    value: 25,
    min_purchase: 75000,
    max_discount: 50000,
    start_date: '2026-10-05',
    end_date: '2026-10-07',
    is_active: false,
    description: 'Flash sale terbatas akhir pekan'
  }
]

export default function AdminDiscountsClient({ initialPromotions }: { initialPromotions: Promotion[] }) {
  const [promotions, setPromotions] = useState<Promotion[]>(
    initialPromotions.length > 0 ? initialPromotions : DEMO_PROMOTIONS
  )
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'active' | 'percentage' | 'fixed'>('all')

  // State Modal Form
  const [modalOpen, setModalOpen] = useState(false)
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null)
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    type: 'percentage' as 'percentage' | 'fixed',
    value: '',
    min_purchase: '0',
    max_discount: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    is_active: true,
    description: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [toast, setToast] = useState<{ text: string; type: 'ok' | 'bad' } | null>(null)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  // Ambil promo terbaru dari server saat halaman dibuka
  useEffect(() => {
    const loadPromotions = async () => {
      try {
        const res = await fetch('/api/admin/promotions')
        const data = await res.json()
        if (data.data && Array.isArray(data.data) && data.data.length > 0) {
          setPromotions(data.data)
          syncToLocalStorage(data.data)
        }
      } catch {}
    }
    loadPromotions()
  }, [])

  const showToast = (text: string, type: 'ok' | 'bad' = 'ok') => {
    setToast({ text, type })
    setTimeout(() => setToast(null), 3000)
  }

  // Sinkronisasi promo aktif ke localStorage & event real-time → langsung aktif di POS Kasir
  const syncToLocalStorage = (updated: Promotion[]) => {
    try {
      const active = updated.filter(p => p.is_active)
      localStorage.setItem('fluxa_active_promotions', JSON.stringify(active))
      window.dispatchEvent(new CustomEvent('fluxa_promotions_updated', { detail: active }))
    } catch {}
  }

  const handleCopyCode = (code: string) => {
    navigator.clipboard?.writeText(code)
    setCopiedCode(code)
    showToast(`Kode "${code}" berhasil disalin!`, 'ok')
    setTimeout(() => setCopiedCode(null), 2000)
  }

  // Open Modal untuk Tambah
  const handleOpenAdd = () => {
    setEditingPromo(null)
    setFormData({
      code: '',
      name: '',
      type: 'percentage',
      value: '',
      min_purchase: '0',
      max_discount: '',
      start_date: new Date().toISOString().split('T')[0],
      end_date: '',
      is_active: true,
      description: ''
    })
    setModalOpen(true)
  }

  // Open Modal untuk Edit
  const handleOpenEdit = (promo: Promotion) => {
    setEditingPromo(promo)
    setFormData({
      code: promo.code,
      name: promo.name,
      type: promo.type,
      value: String(promo.value),
      min_purchase: String(promo.min_purchase || 0),
      max_discount: promo.max_discount ? String(promo.max_discount) : '',
      start_date: promo.start_date || new Date().toISOString().split('T')[0],
      end_date: promo.end_date || '',
      is_active: promo.is_active,
      description: promo.description || ''
    })
    setModalOpen(true)
  }

  // Toggle Status Aktif Langsung
  const handleToggleActive = async (promo: Promotion) => {
    const nextStatus = !promo.is_active
    const updated = promotions.map(p => p.id === promo.id ? { ...p, is_active: nextStatus } : p)
    setPromotions(updated)
    syncToLocalStorage(updated)

    try {
      await fetch('/api/admin/promotions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: promo.id, is_active: nextStatus })
      })
      showToast(`Promo ${promo.code} kini ${nextStatus ? '✅ Aktif di terminal Kasir' : 'Dinonaktifkan'}.`, 'ok')
    } catch {
      showToast(`Status promo ${promo.code} diubah (simulasi).`, 'ok')
    }
  }

  // Hapus Promo
  const handleDelete = async (id: string, code: string) => {
    if (!confirm(`Yakin ingin menghapus promo "${code}"? Kasir tidak akan dapat menggunakannya lagi.`)) return

    const updated = promotions.filter(p => p.id !== id)
    setPromotions(updated)
    syncToLocalStorage(updated)

    try {
      await fetch(`/api/admin/promotions?id=${id}`, { method: 'DELETE' })
      showToast(`Promo ${code} berhasil dihapus.`, 'ok')
    } catch {
      showToast(`Promo ${code} dihapus (simulasi).`, 'ok')
    }
  }

  // Simpan Form (Create / Edit)
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.code || !formData.name || !formData.value) {
      showToast('Mohon lengkapi kode, nama promo, dan nilai diskon.', 'bad')
      return
    }

    const cleanCode = formData.code.trim().toUpperCase()
    const numValue = parseInt(formData.value)
    if (isNaN(numValue) || numValue <= 0) {
      showToast('Nilai diskon harus berupa angka lebih besar dari 0.', 'bad')
      return
    }

    if (formData.type === 'percentage' && numValue > 100) {
      showToast('Diskon persentase maksimal 100%.', 'bad')
      return
    }

    setIsSubmitting(true)
    const payload = {
      code: cleanCode,
      name: formData.name.trim(),
      type: formData.type,
      value: numValue,
      min_purchase: parseInt(formData.min_purchase) || 0,
      max_discount: formData.max_discount ? parseInt(formData.max_discount) : null,
      start_date: formData.start_date,
      end_date: formData.end_date || null,
      is_active: formData.is_active,
      description: formData.description.trim() || null
    }

    try {
      if (editingPromo) {
        // Update
        const res = await fetch('/api/admin/promotions', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingPromo.id, ...payload })
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)

        const updated = promotions.map(p => p.id === editingPromo.id ? { ...p, ...payload } : p)
        setPromotions(updated)
        syncToLocalStorage(updated)
        showToast(`✅ Promo ${cleanCode} berhasil diperbarui dan disinkron ke Kasir!`, 'ok')
      } else {
        // Create
        const res = await fetch('/api/admin/promotions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)

        const newPromo: Promotion = data.data || {
          id: 'p-' + Date.now(),
          ...payload
        }
        const updated = [newPromo, ...promotions]
        setPromotions(updated)
        syncToLocalStorage(updated)
        showToast(`✅ Promo ${cleanCode} berhasil dibuat dan otomatis aktif di POS Kasir!`, 'ok')
      }
      setModalOpen(false)
    } catch (err: any) {
      // Fallback local update (mode demo tanpa database)
      if (editingPromo) {
        const updated = promotions.map(p => p.id === editingPromo.id ? { ...p, ...payload } : p)
        setPromotions(updated)
        syncToLocalStorage(updated)
        showToast(`✅ Promo ${cleanCode} diperbarui (mode demo) — Kasir dapat menggunakannya!`, 'ok')
      } else {
        const newPromo: Promotion = { id: 'demo-' + Date.now(), ...payload }
        const updated = [newPromo, ...promotions]
        setPromotions(updated)
        syncToLocalStorage(updated)
        showToast(`✅ Promo ${cleanCode} dibuat dan aktif di Kasir (mode demo)!`, 'ok')
      }
      setModalOpen(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Statistik KPI
  const stats = useMemo(() => {
    const activeList = promotions.filter(p => p.is_active)
    const percentageCount = promotions.filter(p => p.type === 'percentage').length
    const fixedCount = promotions.filter(p => p.type === 'fixed').length
    return {
      activeCount: activeList.length,
      percentageCount,
      fixedCount,
      totalCount: promotions.length
    }
  }, [promotions])

  // Filter Table
  const filteredPromotions = useMemo(() => {
    return promotions.filter(p => {
      if (filterType === 'active' && !p.is_active) return false
      if (filterType === 'percentage' && p.type !== 'percentage') return false
      if (filterType === 'fixed' && p.type !== 'fixed') return false

      if (search) {
        const q = search.toLowerCase()
        return p.code.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q) ||
          (p.description || '').toLowerCase().includes(q)
      }
      return true
    })
  }, [promotions, filterType, search])

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1400, margin: '0 auto' }}>
      <PageHeader
        title="Kelola Diskon & Promo"
        subtitle="Buat promo diskon harga atau persentase yang otomatis diteruskan dan aktif di terminal Kasir POS"
        actions={
          <button
            id="tambah-promo-btn"
            className="btn btn-primary"
            onClick={handleOpenAdd}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 12 }}
          >
            <Plus size={16} /> Buat Promo Baru
          </button>
        }
      />

      {/* Toast Alert */}
      {toast && (
        <div style={{
          padding: '12px 18px',
          borderRadius: 12,
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: toast.type === 'ok' ? 'var(--oks)' : 'var(--bads)',
          color: toast.type === 'ok' ? 'var(--ok)' : 'var(--bad)',
          fontWeight: 600,
          fontSize: 13,
          border: `1px solid ${toast.type === 'ok' ? 'var(--ok)' : 'var(--bad)'}`,
          boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle2 size={16} />
            <span>{toast.text}</span>
          </div>
          <button onClick={() => setToast(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>✕</button>
        </div>
      )}

      {/* KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: 16,
        marginBottom: 24
      }}>
        <div className="card" style={{ borderLeft: '4px solid var(--ok)', background: 'linear-gradient(135deg, var(--panel) 0%, var(--bg) 100%)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--mute)' }}>Promo Aktif di Kasir</span>
            <span style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--oks)', color: 'var(--ok)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Tag size={16} />
            </span>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--ink)' }}>{stats.activeCount} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--mute)' }}>dari {stats.totalCount} promo</span></div>
          <span style={{ fontSize: 11.5, color: 'var(--ok)', fontWeight: 600, marginTop: 4, display: 'block' }}>
            ● Siap digunakan kasir di POS
          </span>
        </div>

        <div className="card" style={{ borderLeft: '4px solid var(--acc)', background: 'linear-gradient(135deg, var(--panel) 0%, var(--bg) 100%)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--mute)' }}>Promo Persentase (%)</span>
            <span style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--accs)', color: 'var(--acc)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Percent size={16} />
            </span>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--ink)' }}>{stats.percentageCount}</div>
          <span style={{ fontSize: 11.5, color: 'var(--mute)', marginTop: 4, display: 'block' }}>
            Potongan berbasis rasio belanja
          </span>
        </div>

        <div className="card" style={{ borderLeft: '4px solid #8B5CF6', background: 'linear-gradient(135deg, var(--panel) 0%, var(--bg) 100%)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--mute)' }}>Potongan Tunai (Rp)</span>
            <span style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(139, 92, 246, 0.12)', color: '#8B5CF6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DollarSign size={16} />
            </span>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--ink)' }}>{stats.fixedCount}</div>
          <span style={{ fontSize: 11.5, color: 'var(--mute)', marginTop: 4, display: 'block' }}>
            Potongan nominal langsung
          </span>
        </div>

        <div className="card" style={{ borderLeft: '4px solid var(--warn)', background: 'linear-gradient(135deg, var(--panel) 0%, var(--bg) 100%)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--mute)' }}>Sinkronisasi POS Kasir</span>
            <span style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--warns)', color: 'var(--warn)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShoppingCart size={16} />
            </span>
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>Real-time</span>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: 'var(--oks)', color: 'var(--ok)', fontWeight: 700 }}>Aktif</span>
          </div>
          <span style={{ fontSize: 11.5, color: 'var(--mute)', marginTop: 4, display: 'block' }}>
            Kasir dapat memilih promo langsung
          </span>
        </div>
      </div>

      {/* Main Table Card */}
      <SectionCard
        title={`Daftar Promo & Voucher (${filteredPromotions.length})`}
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* Filter Tabs */}
            <div style={{ display: 'flex', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 10, padding: 2 }}>
              {(['all', 'active', 'percentage', 'fixed'] as const).map(tab => {
                const labels = {
                  all: 'Semua',
                  active: 'Hanya Aktif',
                  percentage: 'Persentase %',
                  fixed: 'Potongan Rp'
                }
                const active = filterType === tab
                return (
                  <button
                    key={tab}
                    onClick={() => setFilterType(tab)}
                    style={{
                      background: active ? 'var(--panel)' : 'transparent',
                      color: active ? 'var(--ink)' : 'var(--mute)',
                      fontWeight: active ? 700 : 500,
                      border: 'none',
                      borderRadius: 8,
                      padding: '5px 12px',
                      fontSize: 12,
                      cursor: 'pointer'
                    }}
                  >
                    {labels[tab]}
                  </button>
                )
              })}
            </div>

            {/* Search Input */}
            <div className="search-pill" style={{ width: 220, padding: '5px 12px' }}>
              <Search size={14} color="var(--mute)" />
              <input
                placeholder="Cari kode / nama promo..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ fontSize: 12.5 }}
              />
            </div>
          </div>
        }
      >
        {filteredPromotions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--mute)' }}>
            <Tag size={32} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
            <p style={{ fontWeight: 600, fontSize: 14 }}>Belum ada promo yang sesuai</p>
            <p style={{ fontSize: 12.5, marginTop: 4 }}>Klik tombol "Buat Promo Baru" untuk menambahkan voucher diskon untuk kasir</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '12px 14px', fontSize: 12, color: 'var(--mute)', fontWeight: 600, borderBottom: '1px solid var(--line)' }}>KODE PROMO</th>
                  <th style={{ textAlign: 'left', padding: '12px 14px', fontSize: 12, color: 'var(--mute)', fontWeight: 600, borderBottom: '1px solid var(--line)' }}>NAMA PROMO</th>
                  <th style={{ textAlign: 'left', padding: '12px 14px', fontSize: 12, color: 'var(--mute)', fontWeight: 600, borderBottom: '1px solid var(--line)' }}>NILAI POTONGAN</th>
                  <th style={{ textAlign: 'left', padding: '12px 14px', fontSize: 12, color: 'var(--mute)', fontWeight: 600, borderBottom: '1px solid var(--line)' }}>MIN. BELANJA</th>
                  <th style={{ textAlign: 'left', padding: '12px 14px', fontSize: 12, color: 'var(--mute)', fontWeight: 600, borderBottom: '1px solid var(--line)' }}>PERIODE</th>
                  <th style={{ textAlign: 'center', padding: '12px 14px', fontSize: 12, color: 'var(--mute)', fontWeight: 600, borderBottom: '1px solid var(--line)' }}>STATUS DI KASIR</th>
                  <th style={{ textAlign: 'right', padding: '12px 14px', fontSize: 12, color: 'var(--mute)', fontWeight: 600, borderBottom: '1px solid var(--line)' }}>AKSI</th>
                </tr>
              </thead>
              <tbody>
                {filteredPromotions.map(promo => {
                  const isPercentage = promo.type === 'percentage'

                  return (
                    <tr
                      key={promo.id}
                      style={{
                        borderBottom: '1px solid var(--line)',
                        opacity: promo.is_active ? 1 : 0.65
                      }}
                    >
                      {/* Kode Promo */}
                      <td style={{ padding: '14px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{
                            fontFamily: 'monospace',
                            fontWeight: 700,
                            fontSize: 13,
                            padding: '3px 8px',
                            borderRadius: 6,
                            background: 'var(--bg)',
                            border: '1px solid var(--line)',
                            color: 'var(--ink)'
                          }}>
                            {promo.code}
                          </span>
                          <button
                            onClick={() => handleCopyCode(promo.code)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mute)', padding: 4 }}
                            title="Salin Kode Promo"
                          >
                            {copiedCode === promo.code ? <Check size={13} color="var(--ok)" /> : <Copy size={13} />}
                          </button>
                        </div>
                      </td>

                      {/* Nama Promo & Deskripsi */}
                      <td style={{ padding: '14px 14px' }}>
                        <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--ink)' }}>{promo.name}</div>
                        {promo.description && (
                          <div style={{ fontSize: 11.5, color: 'var(--mute)', marginTop: 2, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {promo.description}
                          </div>
                        )}
                      </td>

                      {/* Nilai Potongan */}
                      <td style={{ padding: '14px 14px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '3px 9px',
                          borderRadius: 8,
                          fontWeight: 700,
                          fontSize: 12,
                          background: isPercentage ? 'var(--accs)' : 'rgba(139, 92, 246, 0.12)',
                          color: isPercentage ? 'var(--acc)' : '#8B5CF6'
                        }}>
                          {isPercentage ? <Percent size={12} /> : <DollarSign size={12} />}
                          {isPercentage ? `${promo.value}%` : `Rp ${promo.value.toLocaleString('id-ID')}`}
                          {isPercentage && promo.max_discount ? ` (Maks Rp ${promo.max_discount.toLocaleString('id-ID')})` : ''}
                        </span>
                      </td>

                      {/* Min Belanja */}
                      <td style={{ padding: '14px 14px', fontSize: 13 }}>
                        {promo.min_purchase > 0 ? (
                          <span>Rp {promo.min_purchase.toLocaleString('id-ID')}</span>
                        ) : (
                          <span style={{ color: 'var(--mute)' }}>Tanpa Minimum</span>
                        )}
                      </td>

                      {/* Periode */}
                      <td style={{ padding: '14px 14px', fontSize: 12, color: 'var(--mute)' }}>
                        <div>{new Date(promo.start_date).toLocaleDateString('id-ID')}</div>
                        {promo.end_date ? (
                          <div>s/d {new Date(promo.end_date).toLocaleDateString('id-ID')}</div>
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--ok)' }}>Selamanya</span>
                        )}
                      </td>

                      {/* Status Toggle */}
                      <td style={{ padding: '14px 14px', textAlign: 'center' }}>
                        <button
                          onClick={() => handleToggleActive(promo)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6
                          }}
                          title={promo.is_active ? 'Klik untuk nonaktifkan di kasir' : 'Klik untuk aktifkan di kasir'}
                        >
                          {promo.is_active ? (
                            <span style={{
                              padding: '3px 10px',
                              borderRadius: 99,
                              background: 'var(--oks)',
                              color: 'var(--ok)',
                              fontWeight: 700,
                              fontSize: 11.5,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4
                            }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ok)' }} />
                              Aktif di Kasir
                            </span>
                          ) : (
                            <span style={{
                              padding: '3px 10px',
                              borderRadius: 99,
                              background: 'var(--bg)',
                              color: 'var(--mute)',
                              fontWeight: 600,
                              fontSize: 11.5
                            }}>
                              Nonaktif
                            </span>
                          )}
                        </button>
                      </td>

                      {/* Aksi */}
                      <td style={{ padding: '14px 14px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => handleOpenEdit(promo)}
                            className="btn btn-secondary btn-sm"
                            title="Edit Promo"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => handleDelete(promo.id, promo.code)}
                            className="btn btn-danger btn-sm"
                            style={{ borderColor: 'var(--bad)', color: 'var(--bad)' }}
                            title="Hapus Promo"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Modal Form Buat / Edit Promo */}
      {modalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background: 'rgba(15, 18, 24, 0.72)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
          animation: 'fadeIn 0.2s ease'
        }}>
          <div style={{
            background: 'var(--panel)',
            border: '1px solid var(--line)',
            borderRadius: 20,
            padding: '28px 28px',
            width: '100%',
            maxWidth: 540,
            boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
            maxHeight: '92vh',
            overflowY: 'auto'
          }}>
            {/* Header Modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10,
                  background: 'var(--accs)', color: 'var(--acc)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <Tag size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: 'var(--ink)' }}>
                    {editingPromo ? 'Edit Diskon & Promo' : 'Buat Promo Baru untuk Kasir'}
                  </h3>
                  <span style={{ fontSize: 12, color: 'var(--mute)' }}>
                    Otomatis terhubung ke keranjang kasir POS
                  </span>
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--mute)' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Kode Promo & Nama Promo */}
              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 12 }}>
                <div>
                  <label className="label">KODE PROMO *</label>
                  <input
                    required
                    placeholder="DISKON10"
                    value={formData.code}
                    onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    className="input"
                    style={{ fontFamily: 'monospace', fontWeight: 700, textTransform: 'uppercase' }}
                  />
                </div>
                <div>
                  <label className="label">NAMA PROMO *</label>
                  <input
                    required
                    placeholder="Contoh: Diskon Pelanggan Baru"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="input"
                  />
                </div>
              </div>

              {/* Tipe Diskon (Radio Button) */}
              <div>
                <label className="label">TIPE DISKON *</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: formData.type === 'percentage' ? '2px solid var(--acc)' : '1px solid var(--line)',
                    background: formData.type === 'percentage' ? 'var(--accs)' : 'var(--bg)',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: 13
                  }}>
                    <input
                      type="radio"
                      name="promo_type"
                      checked={formData.type === 'percentage'}
                      onChange={() => setFormData({ ...formData, type: 'percentage' })}
                    />
                    <span>Persentase (%)</span>
                  </label>

                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: formData.type === 'fixed' ? '2px solid var(--acc)' : '1px solid var(--line)',
                    background: formData.type === 'fixed' ? 'var(--accs)' : 'var(--bg)',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: 13
                  }}>
                    <input
                      type="radio"
                      name="promo_type"
                      checked={formData.type === 'fixed'}
                      onChange={() => setFormData({ ...formData, type: 'fixed' })}
                    />
                    <span>Potongan Tetap (Rp)</span>
                  </label>
                </div>
              </div>

              {/* Nilai Diskon & Maksimal Diskon */}
              <div style={{ display: 'grid', gridTemplateColumns: formData.type === 'percentage' ? '1fr 1fr' : '1fr', gap: 12 }}>
                <div>
                  <label className="label">
                    {formData.type === 'percentage' ? 'NILAI PERSENTASE (%) *' : 'NOMINAL POTONGAN (RP) *'}
                  </label>
                  <input
                    required
                    type="number"
                    min="1"
                    max={formData.type === 'percentage' ? '100' : undefined}
                    placeholder={formData.type === 'percentage' ? '10' : '20000'}
                    value={formData.value}
                    onChange={e => setFormData({ ...formData, value: e.target.value })}
                    className="input"
                    style={{ fontWeight: 700 }}
                  />
                </div>

                {formData.type === 'percentage' && (
                  <div>
                    <label className="label">MAKSIMAL POTONGAN (RP)</label>
                    <input
                      type="number"
                      placeholder="Opsional, misal 25000"
                      value={formData.max_discount}
                      onChange={e => setFormData({ ...formData, max_discount: e.target.value })}
                      className="input"
                    />
                  </div>
                )}
              </div>

              {/* Minimum Belanja */}
              <div>
                <label className="label">MINIMUM BELANJA (RP)</label>
                <input
                  type="number"
                  min="0"
                  placeholder="0 (Tanpa minimum)"
                  value={formData.min_purchase}
                  onChange={e => setFormData({ ...formData, min_purchase: e.target.value })}
                  className="input"
                />
                <span style={{ fontSize: 11, color: 'var(--mute)', marginTop: 4, display: 'block' }}>
                  Kasir hanya bisa menerapkan promo jika total belanja memenuhi batas ini
                </span>
              </div>

              {/* Tanggal Periode */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="label">TANGGAL MULAI</label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">TANGGAL BERAKHIR (OPSIONAL)</label>
                  <input
                    type="date"
                    value={formData.end_date}
                    onChange={e => setFormData({ ...formData, end_date: e.target.value })}
                    className="input"
                  />
                </div>
              </div>

              {/* Deskripsi / Syarat Ketentuan */}
              <div>
                <label className="label">KETERANGAN / SYARAT PROMO (OPSIONAL)</label>
                <input
                  placeholder="Contoh: Khusus pembelian minuman & makanan..."
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="input"
                />
              </div>

              {/* Status Aktif */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                />
                <span>Aktifkan langsung agar kasir dapat memilih promo ini di POS</span>
              </label>

              {/* Tombol Aksi */}
              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={isSubmitting}
                  className="btn btn-secondary"
                  style={{ flex: 1, justifyContent: 'center', padding: '11px 0' }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn btn-primary"
                  style={{ flex: 2, justifyContent: 'center', padding: '11px 0' }}
                >
                  {isSubmitting ? 'Menyimpan...' : editingPromo ? 'Simpan Perubahan' : 'Buat Promo & Teruskan ke Kasir'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
