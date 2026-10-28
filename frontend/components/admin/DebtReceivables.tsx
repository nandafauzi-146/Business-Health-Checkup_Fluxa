'use client'

import { useState } from 'react'
import {
  Plus, Search, Building2, AlertCircle, CheckCircle, Clock, Calendar,
  X, Check, ArrowDownLeft, ArrowUpRight, Scale, Tags, Edit2, Trash2, Save
} from 'lucide-react'
import { PageHeader } from '@/components/layout/Topbar'
import { SectionCard, StatusTag, FormatRupiah } from '@/components/ui/Cards'
import { createClient } from '@/lib/supabase/client'
import { getUserFacingError } from '@/lib/user-facing-error'

export interface DebtReceivableItem {
  id: string
  type: 'payable' | 'receivable'
  party_name: string
  category: string
  description: string
  total_amount: number
  paid_amount: number
  remaining_amount: number
  due_date: string | null
  status: 'unpaid' | 'partial' | 'paid'
  note: string | null
  created_at: string
}

export interface DebtCategory {
  id: string
  name: string
}

const DEFAULT_CATEGORIES: DebtCategory[] = [
  { id: 'default-1', name: 'Supplier / Bahan Baku' },
  { id: 'default-2', name: 'Operasional & Sewa Ruko' },
  { id: 'default-3', name: 'Utilitas & Listrik Toko' },
  { id: 'default-4', name: 'Peralatan & Fasilitas' },
  { id: 'default-5', name: 'Pinjaman Modal Usaha' },
  { id: 'default-6', name: 'Konsinyasi & Kemitraan Toko' },
  { id: 'default-7', name: 'Lain-lain' },
]

function formatRp(n: number) {
  return 'Rp' + new Intl.NumberFormat('id-ID').format(n)
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function DebtReceivablesClient({
  initialData,
  initialCategories,
  loadError,
}: {
  initialData: DebtReceivableItem[]
  initialCategories?: DebtCategory[]
  loadError?: string | null
}) {
  const supabase = createClient()
  const [data, setData] = useState<DebtReceivableItem[]>(initialData)
  const [categories, setCategories] = useState<DebtCategory[]>(
    initialCategories && initialCategories.length > 0 ? initialCategories : DEFAULT_CATEGORIES
  )
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'payable' | 'receivable'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'unpaid' | 'partial' | 'paid'>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  // Add modal
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({
    type: 'payable' as 'payable' | 'receivable',
    party_name: '',
    category: '',
    description: '',
    total_amount: '',
    due_date: '',
    note: ''
  })

  // Pay modal
  const [payOpen, setPayOpen] = useState(false)
  const [selected, setSelected] = useState<DebtReceivableItem | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState<'cash' | 'non_cash'>('cash')
  const [payNote, setPayNote] = useState('')

  // Category management modal
  const [catOpen, setCatOpen] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [editingCatId, setEditingCatId] = useState<string | null>(null)
  const [editingCatName, setEditingCatName] = useState('')
  const [catSaving, setCatSaving] = useState(false)

  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ type: 'ok' | 'bad'; msg: string } | null>(null)

  const showToast = (msg: string, type: 'ok' | 'bad' = 'ok') => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3500)
  }

  // Filtered list
  const filtered = data.filter(item => {
    if (typeFilter !== 'all' && item.type !== typeFilter) return false
    if (statusFilter !== 'all' && item.status !== statusFilter) return false
    if (categoryFilter !== 'all' && item.category !== categoryFilter) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      const matchParty = item.party_name.toLowerCase().includes(q)
      const matchDesc = item.description.toLowerCase().includes(q)
      const matchCat = item.category.toLowerCase().includes(q)
      if (!matchParty && !matchDesc && !matchCat) return false
    }
    return true
  })

  // KPI Calculations
  const totalPayableUnpaid = data
    .filter(d => d.type === 'payable' && d.status !== 'paid')
    .reduce((sum, d) => sum + d.remaining_amount, 0)

  const totalReceivableUnpaid = data
    .filter(d => d.type === 'receivable' && d.status !== 'paid')
    .reduce((sum, d) => sum + d.remaining_amount, 0)

  const now = new Date()
  const sevenDaysLater = new Date(now.getTime() + 7 * 86400000)

  const upcomingDueCount = data.filter(d => {
    if (d.status === 'paid' || !d.due_date) return false
    const due = new Date(d.due_date)
    return due <= sevenDaysLater
  }).length

  const netBalance = totalPayableUnpaid - totalReceivableUnpaid

  // ── Category Management Handlers ──────────────────────────────
  const handleAddCategory = async () => {
    const name = newCatName.trim()
    if (!name) return
    if (categories.some(c => c.name.toLowerCase() === name.toLowerCase())) {
      showToast('Kategori dengan nama tersebut sudah ada', 'bad')
      return
    }
    setCatSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: inserted, error } = await supabase
        .from('debt_categories')
        .insert({ name, created_by: user?.id })
        .select('id, name')
        .single()
      if (error) throw error
      setCategories(prev => [...prev, inserted].sort((a, b) => a.name.localeCompare(b.name)))
      setNewCatName('')
      showToast(`Kategori "${name}" berhasil ditambahkan`)
    } catch (err) {
      showToast(getUserFacingError(err, 'Kategori gagal ditambahkan.'), 'bad')
    } finally {
      setCatSaving(false)
    }
  }

  const handleRenameCategory = async (id: string) => {
    const name = editingCatName.trim()
    if (!name) return
    if (categories.some(c => c.name.toLowerCase() === name.toLowerCase() && c.id !== id)) {
      showToast('Nama kategori sudah digunakan', 'bad')
      return
    }
    setCatSaving(true)
    try {
      const { error } = await supabase
        .from('debt_categories')
        .update({ name })
        .eq('id', id)
      if (error) throw error
      setCategories(prev =>
        prev.map(c => c.id === id ? { ...c, name } : c).sort((a, b) => a.name.localeCompare(b.name))
      )
      setEditingCatId(null)
      setEditingCatName('')
      showToast(`Kategori berhasil diubah menjadi "${name}"`)
    } catch (err) {
      showToast(getUserFacingError(err, 'Gagal mengubah nama kategori.'), 'bad')
    } finally {
      setCatSaving(false)
    }
  }

  const handleDeleteCategory = async (id: string, name: string) => {
    const inUse = data.some(d => d.category === name)
    if (inUse) {
      showToast(`Kategori "${name}" masih digunakan oleh transaksi — tidak dapat dihapus`, 'bad')
      return
    }
    setCatSaving(true)
    try {
      const { error } = await supabase.from('debt_categories').delete().eq('id', id)
      if (error) throw error
      setCategories(prev => prev.filter(c => c.id !== id))
      showToast(`Kategori "${name}" berhasil dihapus`)
    } catch (err) {
      showToast(getUserFacingError(err, 'Gagal menghapus kategori.'), 'bad')
    } finally {
      setCatSaving(false)
    }
  }

  // Handle Add Item
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    const selectedCategory = form.category || (categories[0]?.name ?? 'Lain-lain')
    if (!form.party_name.trim() || !form.description.trim() || !form.total_amount) {
      showToast('Mohon lengkapi nama pihak, keterangan, dan total nominal', 'bad')
      return
    }

    const total = parseInt(form.total_amount)
    if (isNaN(total) || total <= 0) {
      showToast('Nominal harus berupa angka lebih dari 0', 'bad')
      return
    }

    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Sesi login tidak ditemukan.')
      const { data: inserted, error } = await supabase
        .from('supplier_payables')
        .insert({
          supplier_name: form.party_name.trim(),
          party_name: form.party_name.trim(),
          type: form.type,
          category: selectedCategory,
          description: form.description.trim(),
          total_amount: total,
          paid_amount: 0,
          due_date: form.due_date || null,
          status: 'unpaid',
          note: form.note.trim() || null,
          created_by: user.id
        })
        .select('*')
        .single()
      if (error) throw error
      if (!inserted) throw new Error('Database tidak mengembalikan data hutang/piutang.')

      const newItem: DebtReceivableItem = {
        id: inserted.id,
        type: inserted.type,
        party_name: inserted.party_name || inserted.supplier_name,
        category: inserted.category,
        description: inserted.description,
        total_amount: inserted.total_amount,
        paid_amount: inserted.paid_amount,
        remaining_amount: inserted.total_amount - inserted.paid_amount,
        due_date: inserted.due_date,
        status: inserted.status,
        note: inserted.note,
        created_at: inserted.created_at
      }

      setData(prev => [newItem, ...prev])
      showToast(`${form.type === 'payable' ? 'Hutang toko' : 'Piutang usaha'} berhasil dicatat!`)
      setAddOpen(false)
      setForm({
        type: 'payable',
        party_name: '',
        category: 'Supplier / Bahan Baku',
        description: '',
        total_amount: '',
        due_date: '',
        note: ''
      })
    } catch (err) {
      showToast(getUserFacingError(err, 'Hutang atau piutang belum dapat disimpan. Silakan coba lagi.'), 'bad')
    } finally {
      setSaving(false)
    }
  }

  // Handle Pay / Receive Payment
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected) return

    const amt = parseInt(payAmount)
    if (isNaN(amt) || amt <= 0) {
      showToast('Nominal pembayaran harus lebih dari 0', 'bad')
      return
    }

    if (amt > selected.remaining_amount) {
      showToast(`Nominal melebihi sisa tagihan (${formatRp(selected.remaining_amount)})`, 'bad')
      return
    }

    setSaving(true)
    try {
      const { data: payment, error } = await supabase.rpc('record_business_debt_payment', {
        p_payable_id: selected.id,
        p_amount: amt,
        p_payment_method: payMethod,
        p_note: payNote.trim() || null
      })
      if (error) throw error
      if (!payment) throw new Error('Database tidak mengembalikan status pembayaran terbaru.')
      const result = payment as { paid_amount: number; remaining_amount: number; status: DebtReceivableItem['status'] }

      setData(prev => prev.map(item => {
        if (item.id === selected.id) {
          return {
            ...item,
            paid_amount: result.paid_amount,
            remaining_amount: result.remaining_amount,
            status: result.status
          }
        }
        return item
      }))

      const actionText = selected.type === 'payable' ? 'Pembayaran cicilan hutang' : 'Penerimaan pembayaran piutang'
      showToast(`${actionText} ${formatRp(amt)} berhasil dicatat!`)
      setPayOpen(false)
      setSelected(null)
      setPayAmount('')
      setPayNote('')
    } catch (err) {
      showToast(getUserFacingError(err, 'Pembayaran belum dapat dicatat. Silakan coba lagi.'), 'bad')
    } finally {
      setSaving(false)
    }
  }

  const openPayModal = (item: DebtReceivableItem) => {
    setSelected(item)
    setPayAmount(String(item.remaining_amount))
    setPayNote('')
    setPayMethod('cash')
    setPayOpen(true)
  }

  return (
    <div>
      <PageHeader
        title="Hutang & Piutang Usaha"
        subtitle="Kelola seluruh kewajiban hutang toko (supplier, sewa ruko, utilitas operasional) serta piutang usaha (konsinyasi mitra, pesanan B2B)"
        actions={
          <button
            id="add-debt-receivable-btn"
            className="btn btn-primary"
            onClick={() => {
              setForm({ type: 'payable', party_name: '', category: categories[0]?.name ?? '', description: '', total_amount: '', due_date: '', note: '' })
              setAddOpen(true)
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', fontWeight: 600 }}
          >
            <Plus size={16} />
            Catat Hutang / Piutang
          </button>
        }
      />

      {loadError && (
        <div role="alert" style={{ marginBottom: 16, padding: 12, borderRadius: 10, color: 'var(--bad)', background: 'var(--bads)' }}>
          Data hutang dan piutang belum dapat dimuat. Silakan coba lagi.
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 9999,
          background: toast.type === 'ok' ? 'var(--acc)' : 'var(--bad)',
          color: '#fff',
          padding: '12px 20px',
          borderRadius: 10,
          fontWeight: 600,
          fontSize: 14,
          boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          {toast.type === 'ok' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          {toast.msg}
        </div>
      )}

      {/* 4 KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 16, marginBottom: 20 }}>
        {/* Total Hutang Toko */}
        <div className="kpi-card" style={{ borderLeft: '4px solid var(--bad)' }}>
          <div className="kpi-icon" style={{ background: 'var(--bads)', color: 'var(--bad)' }}>
            <ArrowUpRight size={20} />
          </div>
          <div className="kpi-label">Total Hutang Toko (Kewajiban)</div>
          <div className="kpi-value" style={{ color: 'var(--bad)' }}>
            <FormatRupiah amount={totalPayableUnpaid} />
          </div>
          <div className="kpi-sub">Supplier, sewa ruko & beban operasional</div>
        </div>

        {/* Total Piutang Toko */}
        <div className="kpi-card" style={{ borderLeft: '4px solid var(--ok)' }}>
          <div className="kpi-icon" style={{ background: 'var(--oks)', color: 'var(--ok)' }}>
            <ArrowDownLeft size={20} />
          </div>
          <div className="kpi-label">Total Piutang Usaha (Hak Masuk)</div>
          <div className="kpi-value" style={{ color: 'var(--ok)' }}>
            <FormatRupiah amount={totalReceivableUnpaid} />
          </div>
          <div className="kpi-sub">Konsinyasi mitra & pesanan grosir B2B</div>
        </div>

        {/* Jatuh Tempo Terdekat */}
        <div className="kpi-card" style={{ borderLeft: '4px solid var(--warn)' }}>
          <div className="kpi-icon" style={{ background: 'var(--warns)', color: 'var(--warn)' }}>
            <Clock size={20} />
          </div>
          <div className="kpi-label">Jatuh Tempo Dalam 7 Hari</div>
          <div className="kpi-value" style={{ color: 'var(--warn)' }}>
            {upcomingDueCount} <span style={{ fontSize: 14, fontWeight: 500 }}>Tagihan</span>
          </div>
          <div className="kpi-sub">Segera siapkan kas operasional</div>
        </div>

        {/* Posisi Bersih */}
        <div className="kpi-card" style={{ borderLeft: '4px solid var(--acc)' }}>
          <div className="kpi-icon" style={{ background: 'var(--accs)', color: 'var(--acc)' }}>
            <Scale size={20} />
          </div>
          <div className="kpi-label">Net Liabilitas (Hutang Bersih)</div>
          <div className="kpi-value" style={{ color: netBalance > 0 ? 'var(--warn)' : 'var(--ok)' }}>
            <FormatRupiah amount={Math.abs(netBalance)} />
          </div>
          <div className="kpi-sub">
            {netBalance > 0 ? 'Hutang melebihi piutang usaha' : 'Piutang usaha melebihi hutang'}
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <SectionCard title="Daftar Hutang & Piutang Bisnis">
        {/* Controls: Search, Type Segment, Category, Status */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 18, alignItems: 'center' }}>
          {/* Search */}
          <div style={{ flex: '1 1 240px', position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--mute)' }} />
            <input
              id="search-debt-receivable-input"
              className="input"
              placeholder="Cari pihak mitra, sewa, supplier, atau keterangan..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 36, width: '100%' }}
            />
          </div>

          {/* Type Segment Control */}
          <div
            role="group"
            aria-label="Filter jenis transaksi"
            style={{ display: 'flex', background: 'var(--bg)', padding: 4, borderRadius: 8, border: '1px solid var(--line)', gap: 4, alignItems: 'center' }}
          >
            <button
              id="filter-type-all-btn"
              type="button"
              onClick={() => setTypeFilter('all')}
              aria-label="Semua Jenis"
              aria-pressed={typeFilter === 'all'}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: 'none',
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
                background: typeFilter === 'all' ? 'var(--panel)' : 'transparent',
                color: typeFilter === 'all' ? 'var(--ink)' : 'var(--mute)',
                boxShadow: typeFilter === 'all' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                height: 31,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 150ms ease'
              }}
            >
              Semua Jenis
            </button>
            <button
              id="filter-type-payable-btn"
              type="button"
              className="fluxa-filter-icon-btn"
              onClick={() => setTypeFilter('payable')}
              title="Hutang Toko"
              aria-label="Hutang Toko"
              aria-pressed={typeFilter === 'payable'}
              style={{
                position: 'relative',
                padding: '6px 10px',
                minWidth: 36,
                height: 31,
                borderRadius: 6,
                border: 'none',
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
                background: typeFilter === 'payable' ? 'var(--bads)' : 'transparent',
                color: typeFilter === 'payable' ? 'var(--bad)' : 'var(--mute)',
                boxShadow: typeFilter === 'payable' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 150ms ease'
              }}
            >
              <ArrowUpRight size={16} />
              <span className="filter-tooltip" role="tooltip">Hutang Toko</span>
            </button>
            <button
              id="filter-type-receivable-btn"
              type="button"
              className="fluxa-filter-icon-btn"
              onClick={() => setTypeFilter('receivable')}
              title="Piutang Usaha"
              aria-label="Piutang Usaha"
              aria-pressed={typeFilter === 'receivable'}
              style={{
                position: 'relative',
                padding: '6px 10px',
                minWidth: 36,
                height: 31,
                borderRadius: 6,
                border: 'none',
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
                background: typeFilter === 'receivable' ? 'var(--oks)' : 'transparent',
                color: typeFilter === 'receivable' ? 'var(--ok)' : 'var(--mute)',
                boxShadow: typeFilter === 'receivable' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 150ms ease'
              }}
            >
              <ArrowDownLeft size={16} />
              <span className="filter-tooltip" role="tooltip">Piutang Usaha</span>
            </button>
          </div>

          {/* Category Dropdown */}
          <select
            className="input"
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            style={{ width: 'auto', minWidth: 160 }}
          >
            <option value="all">Semua Kategori</option>
            {categories.map(c => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>

          {/* Status Dropdown */}
          <select
            className="input"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            style={{ width: 'auto', minWidth: 140 }}
          >
            <option value="all">Semua Status</option>
            <option value="unpaid">Belum Lunas</option>
            <option value="partial">Dicicil</option>
            <option value="paid">Lunas</option>
          </select>
        </div>

        {/* Data Table */}
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 100 }}>Jenis</th>
                <th>Pihak / Mitra</th>
                <th>Kategori & Keterangan</th>
                <th style={{ textAlign: 'right' }}>Total Nominal</th>
                <th style={{ textAlign: 'right' }}>Dibayar</th>
                <th style={{ textAlign: 'right' }}>Sisa</th>
                <th>Jatuh Tempo</th>
                <th>Status</th>
                <th style={{ textAlign: 'center' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--mute)' }}>
                    <AlertCircle size={28} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.5 }} />
                    Tidak ada catatan hutang atau piutang yang cocok dengan filter.
                  </td>
                </tr>
              ) : (
                filtered.map(item => {
                  const isOverdue = item.due_date && item.status !== 'paid' && new Date(item.due_date) < now
                  const isNearDue = item.due_date && item.status !== 'paid' && !isOverdue && new Date(item.due_date) <= sevenDaysLater

                  return (
                    <tr key={item.id}>
                      {/* Jenis Badge */}
                      <td>
                        <span style={{
                          display: 'inline-block',
                          padding: '3px 8px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 700,
                          background: item.type === 'payable' ? 'var(--bads)' : 'var(--oks)',
                          color: item.type === 'payable' ? 'var(--bad)' : 'var(--ok)',
                          whiteSpace: 'nowrap'
                        }}>
                          {item.type === 'payable' ? 'HUTANG' : 'PIUTANG'}
                        </span>
                      </td>

                      {/* Party Name */}
                      <td style={{ fontWeight: 600 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Building2 size={15} style={{ color: 'var(--mute)', flexShrink: 0 }} />
                          <span>{item.party_name}</span>
                        </div>
                      </td>

                      {/* Kategori & Keterangan */}
                      <td>
                        <div style={{ fontSize: 11.5, color: 'var(--acc)', fontWeight: 600, marginBottom: 2 }}>
                          {item.category}
                        </div>
                        <div style={{ fontSize: 13 }}>{item.description}</div>
                        {item.note && (
                          <div style={{ fontSize: 11, color: 'var(--mute)', fontStyle: 'italic', marginTop: 2 }}>
                            Catatan: {item.note}
                          </div>
                        )}
                      </td>

                      {/* Total Nominal */}
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        {formatRp(item.total_amount)}
                      </td>

                      {/* Dibayar */}
                      <td style={{ textAlign: 'right', color: 'var(--ok)' }}>
                        {formatRp(item.paid_amount)}
                      </td>

                      {/* Sisa */}
                      <td style={{ textAlign: 'right', fontWeight: 700, color: item.status === 'paid' ? 'var(--ok)' : (item.type === 'payable' ? 'var(--bad)' : 'var(--warn)') }}>
                        {formatRp(item.remaining_amount)}
                      </td>

                      {/* Jatuh Tempo */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Calendar size={13} style={{ color: 'var(--mute)' }} />
                          <span style={{
                            color: isOverdue ? 'var(--bad)' : (isNearDue ? 'var(--warn)' : 'var(--ink)'),
                            fontWeight: (isOverdue || isNearDue) ? 700 : 400
                          }}>
                            {formatDate(item.due_date)}
                          </span>
                        </div>
                        {isOverdue && (
                          <span style={{ display: 'inline-block', fontSize: 10, color: 'var(--bad)', fontWeight: 700, marginTop: 2 }}>
                            [LEWAT TEMPO]
                          </span>
                        )}
                        {isNearDue && (
                          <span style={{ display: 'inline-block', fontSize: 10, color: 'var(--warn)', fontWeight: 700, marginTop: 2 }}>
                            [DEKAT TEMPO]
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td>
                        {item.status === 'paid' && <StatusTag label="Lunas" status="lunas" />}
                        {item.status === 'partial' && <StatusTag label="Dicicil" status="sebagian" />}
                        {item.status === 'unpaid' && <StatusTag label="Belum Lunas" status="belum-lunas" />}
                      </td>

                      {/* Aksi */}
                      <td style={{ textAlign: 'center' }}>
                        {item.status !== 'paid' ? (
                          <button
                            className="btn btn-secondary"
                            onClick={() => openPayModal(item)}
                            style={{
                              padding: '5px 12px',
                              fontSize: 12,
                              fontWeight: 600,
                              background: item.type === 'payable' ? 'var(--panel)' : 'var(--oks)',
                              color: item.type === 'payable' ? 'var(--ink)' : 'var(--ok)',
                              borderColor: item.type === 'payable' ? 'var(--line)' : 'var(--ok)'
                            }}
                          >
                            {item.type === 'payable' ? 'Bayar Cicilan' : 'Terima Uang'}
                          </button>
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--ok)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <Check size={14} /> Selesai
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Modal 1: Catat Hutang / Piutang Baru */}
      {addOpen && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: 16
        }}>
          <div style={{
            background: 'var(--panel)',
            border: '1px solid var(--line)',
            borderRadius: 14,
            width: '100%',
            maxWidth: 520,
            boxShadow: '0 16px 40px rgba(0,0,0,0.25)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--line)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>
                Catat Transaksi Hutang / Piutang Baru
              </div>
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--mute)' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleAdd} style={{ padding: '20px' }}>
              {/* Jenis: Hutang vs Piutang Selector */}
              <div style={{ marginBottom: 16 }}>
                <label className="label" style={{ fontWeight: 700, marginBottom: 8, display: 'block' }}>
                  Jenis Transaksi <span style={{ color: 'var(--bad)' }}>*</span>
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, type: 'payable' }))}
                    style={{
                      padding: '12px',
                      borderRadius: 8,
                      border: `2px solid ${form.type === 'payable' ? 'var(--bad)' : 'var(--line)'}`,
                      background: form.type === 'payable' ? 'var(--bads)' : 'var(--panel)',
                      color: form.type === 'payable' ? 'var(--bad)' : 'var(--ink)',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    <span style={{ fontSize: 15 }}>🧾 Hutang Toko</span>
                    <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--mute)' }}>
                      Kewajiban keluar (supplier, sewa, utilitas)
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, type: 'receivable' }))}
                    style={{
                      padding: '12px',
                      borderRadius: 8,
                      border: `2px solid ${form.type === 'receivable' ? 'var(--ok)' : 'var(--line)'}`,
                      background: form.type === 'receivable' ? 'var(--oks)' : 'var(--panel)',
                      color: form.type === 'receivable' ? 'var(--ok)' : 'var(--ink)',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    <span style={{ fontSize: 15 }}>💰 Piutang Usaha</span>
                    <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--mute)' }}>
                      Hak tagih masuk (konsinyasi mitra, pesanan B2B)
                    </span>
                  </button>
                </div>
              </div>

              {/* Nama Pihak / Mitra */}
              <div style={{ marginBottom: 14 }}>
                <label className="label" htmlFor="party-name-input">
                  Nama Pihak / Mitra / Vendor <span style={{ color: 'var(--bad)' }}>*</span>
                </label>
                <input
                  id="party-name-input"
                  className="input"
                  required
                  placeholder={form.type === 'payable' ? "Contoh: CV Maju Jaya / Bpk. Hendro (Sewa Ruko)" : "Contoh: Toko Bu Ani (Konsinyasi) / Katering Berkah"}
                  value={form.party_name}
                  onChange={e => setForm(f => ({ ...f, party_name: e.target.value }))}
                />
              </div>

              {/* Kategori */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <label className="label" htmlFor="category-select" style={{ marginBottom: 0 }}>
                    Kategori Peruntukan <span style={{ color: 'var(--bad)' }}>*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => { setAddOpen(false); setTimeout(() => setCatOpen(true), 150) }}
                    style={{ background: 'transparent', border: 'none', color: 'var(--acc)', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <Tags size={12} /> Kelola Kategori
                  </button>
                </div>
                <select
                  id="category-select"
                  className="input"
                  value={form.category || categories[0]?.name}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                >
                  {categories.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Keterangan */}
              <div style={{ marginBottom: 14 }}>
                <label className="label" htmlFor="description-input">
                  Keterangan / Deskripsi Transaksi <span style={{ color: 'var(--bad)' }}>*</span>
                </label>
                <input
                  id="description-input"
                  className="input"
                  required
                  placeholder={form.type === 'payable' ? "Contoh: Pembelian terigu 100kg / Sewa toko semester 1" : "Contoh: Titip jual 50 produk kemasan / Pesanan hajatan"}
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>

              {/* Total Nominal & Jatuh Tempo (2 Kolom) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label className="label" htmlFor="total-amount-input">
                    Total Nominal (Rp) <span style={{ color: 'var(--bad)' }}>*</span>
                  </label>
                  <input
                    id="total-amount-input"
                    className="input"
                    type="number"
                    min="1"
                    required
                    placeholder="Contoh: 1500000"
                    value={form.total_amount}
                    onChange={e => setForm(f => ({ ...f, total_amount: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="label" htmlFor="due-date-input">
                    Batas Jatuh Tempo
                  </label>
                  <input
                    id="due-date-input"
                    className="input"
                    type="date"
                    value={form.due_date}
                    onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                  />
                </div>
              </div>

              {/* Catatan */}
              <div style={{ marginBottom: 20 }}>
                <label className="label" htmlFor="note-input">
                  Catatan Tambahan (Opsional)
                </label>
                <textarea
                  id="note-input"
                  className="input"
                  rows={2}
                  placeholder="Contoh: Rekening BCA 1234567890 an Bapak Hendro, bukti nota terlampir"
                  value={form.note}
                  onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  style={{ resize: 'vertical' }}
                />
              </div>

              {/* Modal Footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setAddOpen(false)}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving ? 'Menyimpan...' : 'Simpan Transaksi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Catat Pembayaran / Pelunasan */}
      {payOpen && selected && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: 16
        }}>
          <div style={{
            background: 'var(--panel)',
            border: '1px solid var(--line)',
            borderRadius: 14,
            width: '100%',
            maxWidth: 480,
            boxShadow: '0 16px 40px rgba(0,0,0,0.25)',
            overflow: 'hidden'
          }}>
            {/* Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--line)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>
                {selected.type === 'payable' ? 'Catat Pembayaran Hutang Toko' : 'Catat Penerimaan Pembayaran Piutang'}
              </div>
              <button
                type="button"
                onClick={() => setPayOpen(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--mute)' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleRecordPayment} style={{ padding: '20px' }}>
              {/* Info Ringkas */}
              <div style={{
                background: 'var(--bg)',
                padding: '14px',
                borderRadius: 10,
                border: '1px solid var(--line)',
                marginBottom: 16
              }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
                  {selected.party_name}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--mute)', marginBottom: 8 }}>
                  {selected.category} — {selected.description}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderTop: '1px solid var(--line)', paddingTop: 8 }}>
                  <span>Total Tagihan:</span>
                  <strong style={{ color: 'var(--ink)' }}>{formatRp(selected.total_amount)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 4 }}>
                  <span>Sisa Yang Harus {selected.type === 'payable' ? 'Dibayar' : 'Diterima'}:</span>
                  <strong style={{ color: selected.type === 'payable' ? 'var(--bad)' : 'var(--ok)' }}>
                    {formatRp(selected.remaining_amount)}
                  </strong>
                </div>
              </div>

              {/* Input Nominal Pembayaran */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <label className="label" htmlFor="pay-amount-input">
                    Nominal {selected.type === 'payable' ? 'Pembayaran (Rp)' : 'Penerimaan (Rp)'} <span style={{ color: 'var(--bad)' }}>*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setPayAmount(String(selected.remaining_amount))}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--acc)',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Lunasi Seluruhnya ({formatRp(selected.remaining_amount)})
                  </button>
                </div>
                <input
                  id="pay-amount-input"
                  className="input"
                  type="number"
                  min="1"
                  max={selected.remaining_amount}
                  required
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                />
              </div>

              {/* Metode Pembayaran */}
              <div style={{ marginBottom: 14 }}>
                <label className="label" style={{ marginBottom: 6, display: 'block' }}>
                  Metode {selected.type === 'payable' ? 'Pembayaran Kas' : 'Penerimaan Kas'}
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[
                    { id: 'cash', label: 'Tunai' },
                    { id: 'non_cash', label: 'Non-Tunai' },
                  ].map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPayMethod(m.id as 'cash' | 'non_cash')}
                      style={{
                        padding: '9px',
                        borderRadius: 8,
                        border: `1.5px solid ${payMethod === m.id ? 'var(--acc)' : 'var(--line)'}`,
                        background: payMethod === m.id ? 'var(--accs)' : 'var(--panel)',
                        color: payMethod === m.id ? 'var(--acc)' : 'var(--ink)',
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: 'pointer'
                      }}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Catatan Pembayaran */}
              <div style={{ marginBottom: 20 }}>
                <label className="label" htmlFor="pay-note-input">
                  Catatan Bukti / Keterangan Cicilan
                </label>
                <input
                  id="pay-note-input"
                  className="input"
                  placeholder="Contoh: Cicilan ke-1 transfer via BCA, bukti terverifikasi"
                  value={payNote}
                  onChange={e => setPayNote(e.target.value)}
                />
              </div>

              {/* Modal Footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setPayOpen(false)}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving ? 'Menyimpan...' : 'Konfirmasi Transaksi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Kelola Kategori */}
      {catOpen && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: 16
        }}>
          <div style={{
            background: 'var(--panel)',
            border: '1px solid var(--line)',
            borderRadius: 14,
            width: '100%',
            maxWidth: 480,
            boxShadow: '0 16px 40px rgba(0,0,0,0.25)',
            overflow: 'hidden',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--line)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexShrink: 0
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Tags size={18} style={{ color: 'var(--acc)' }} />
                  Kelola Kategori Hutang & Piutang
                </div>
                <div style={{ fontSize: 12, color: 'var(--mute)', marginTop: 2 }}>
                  {categories.length} kategori tersedia
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setCatOpen(false); setEditingCatId(null); setNewCatName('') }}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--mute)' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Add new category input */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
              <label className="label" style={{ marginBottom: 6, display: 'block' }}>Tambah Kategori Baru</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  id="new-category-input"
                  className="input"
                  placeholder="Contoh: Biaya Pengiriman & Logistik"
                  value={newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddCategory())}
                  style={{ flex: 1 }}
                />
                <button
                  id="add-category-btn"
                  className="btn btn-primary"
                  onClick={handleAddCategory}
                  disabled={catSaving || !newCatName.trim()}
                  style={{ padding: '9px 16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
                >
                  <Plus size={14} />
                  Tambah
                </button>
              </div>
            </div>

            {/* Category list */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {categories.length === 0 ? (
                <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--mute)' }}>
                  Belum ada kategori. Tambahkan kategori pertama di atas.
                </div>
              ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: '8px 0' }}>
                  {categories.map((cat, idx) => (
                    <li
                      key={cat.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '10px 20px',
                        borderBottom: idx < categories.length - 1 ? '1px solid var(--line)' : 'none',
                        transition: 'background 0.15s'
                      }}
                    >
                      <span style={{
                        width: 28, height: 28, borderRadius: 8,
                        background: 'var(--accs)', color: 'var(--acc)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: 12, flexShrink: 0
                      }}>
                        {cat.name.charAt(0)}
                      </span>

                      {editingCatId === cat.id ? (
                        <>
                          <input
                            className="input"
                            value={editingCatName}
                            onChange={e => setEditingCatName(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleRenameCategory(cat.id)
                              if (e.key === 'Escape') { setEditingCatId(null); setEditingCatName('') }
                            }}
                            autoFocus
                            style={{ flex: 1, padding: '6px 10px', fontSize: 13 }}
                          />
                          <button
                            onClick={() => handleRenameCategory(cat.id)}
                            disabled={catSaving}
                            style={{ background: 'var(--oks)', border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', color: 'var(--ok)', display: 'flex', alignItems: 'center' }}
                            title="Simpan"
                          >
                            <Save size={14} />
                          </button>
                          <button
                            onClick={() => { setEditingCatId(null); setEditingCatName('') }}
                            style={{ background: 'var(--bg)', border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', color: 'var(--mute)', display: 'flex', alignItems: 'center' }}
                            title="Batal"
                          >
                            <X size={14} />
                          </button>
                        </>
                      ) : (
                        <>
                          <span style={{ flex: 1, fontSize: 13.5, fontWeight: 500 }}>{cat.name}</span>
                          <div style={{ display: 'flex', gap: 6, opacity: 0.7 }}>
                            <button
                              onClick={() => { setEditingCatId(cat.id); setEditingCatName(cat.name) }}
                              style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', color: 'var(--ink)', display: 'flex', alignItems: 'center' }}
                              title={`Ubah nama "${cat.name}"`}
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => handleDeleteCategory(cat.id, cat.name)}
                              disabled={catSaving}
                              style={{ background: 'transparent', border: '1px solid var(--line)', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', color: 'var(--bad)', display: 'flex', alignItems: 'center' }}
                              title={`Hapus "${cat.name}"`}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Footer */}
            <div style={{
              padding: '12px 20px',
              borderTop: '1px solid var(--line)',
              flexShrink: 0,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ fontSize: 12, color: 'var(--mute)' }}>
                💡 Kategori yang masih digunakan tidak dapat dihapus
              </span>
              <button
                className="btn btn-secondary"
                onClick={() => { setCatOpen(false); setEditingCatId(null); setNewCatName('') }}
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
