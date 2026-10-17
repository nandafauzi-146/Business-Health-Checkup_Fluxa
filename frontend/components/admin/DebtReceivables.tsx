'use client'

import { useState } from 'react'
import {
  Plus, Search, Building2, AlertCircle, CheckCircle, Clock, Calendar,
  X, Check, CreditCard, ChevronDown, ArrowDownLeft, ArrowUpRight, Scale, Filter
} from 'lucide-react'
import { PageHeader } from '@/components/layout/Topbar'
import { SectionCard, StatusTag, FormatRupiah } from '@/components/ui/Cards'
import { createClient } from '@/lib/supabase/client'

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

const CATEGORIES = [
  'Supplier / Bahan Baku',
  'Operasional & Sewa Ruko',
  'Utilitas & Listrik Toko',
  'Peralatan & Fasilitas',
  'Pinjaman Modal Usaha',
  'Konsinyasi & Kemitraan Toko',
  'Lain-lain'
]

const DEMO_DATA: DebtReceivableItem[] = [
  {
    id: 'd1',
    type: 'payable',
    party_name: 'Bpk. Hendro (Pemilik Ruko)',
    category: 'Operasional & Sewa Ruko',
    description: 'Sewa ruko toko semester 2 tahun 2026',
    total_amount: 12000000,
    paid_amount: 6000000,
    remaining_amount: 6000000,
    due_date: '2026-11-15',
    status: 'partial',
    note: 'Dicicil 2 tahap sesuai kesepakatan',
    created_at: new Date(Date.now() - 86400000 * 7).toISOString()
  },
  {
    id: 'd2',
    type: 'payable',
    party_name: 'CV Maju Jaya',
    category: 'Supplier / Bahan Baku',
    description: 'Beli tepung terigu 100kg & gula pasir 50kg',
    total_amount: 1500000,
    paid_amount: 500000,
    remaining_amount: 1000000,
    due_date: '2026-10-30',
    status: 'partial',
    note: 'Tempo 14 hari dari pengiriman',
    created_at: new Date(Date.now() - 86400000 * 3).toISOString()
  },
  {
    id: 'd3',
    type: 'payable',
    party_name: 'PLN & Utilitas Usaha',
    category: 'Utilitas & Listrik Toko',
    description: 'Tagihan listrik operasional toko bulan Oktober',
    total_amount: 850000,
    paid_amount: 0,
    remaining_amount: 850000,
    due_date: '2026-10-25',
    status: 'unpaid',
    note: 'Batas akhir pembayaran tgl 25',
    created_at: new Date(Date.now() - 86400000 * 2).toISOString()
  },
  {
    id: 'd4',
    type: 'receivable',
    party_name: 'Toko Roti Bu Ani (Mitra Konsinyasi)',
    category: 'Konsinyasi & Kemitraan Toko',
    description: 'Titip jual produk kemasan 50 pcs di toko cabang mitra',
    total_amount: 750000,
    paid_amount: 250000,
    remaining_amount: 500000,
    due_date: '2026-10-28',
    status: 'partial',
    note: 'Pelunasan setiap akhir bulan',
    created_at: new Date(Date.now() - 86400000 * 5).toISOString()
  },
  {
    id: 'd5',
    type: 'receivable',
    party_name: 'Katering Sejahtera (Pesanan B2B)',
    category: 'Lain-lain',
    description: 'Pesanan bahan baku paket hajatan (tempo 14 hari)',
    total_amount: 2400000,
    paid_amount: 2400000,
    remaining_amount: 0,
    due_date: '2026-10-15',
    status: 'paid',
    note: 'Sudah lunas ditransfer via BCA',
    created_at: new Date(Date.now() - 86400000 * 12).toISOString()
  },
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
}: {
  initialData: DebtReceivableItem[]
}) {
  const supabase = createClient()
  const [data, setData] = useState<DebtReceivableItem[]>(initialData.length > 0 ? initialData : DEMO_DATA)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'payable' | 'receivable'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'unpaid' | 'partial' | 'paid'>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  // Add modal
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({
    type: 'payable' as 'payable' | 'receivable',
    party_name: '',
    category: 'Supplier / Bahan Baku',
    description: '',
    total_amount: '',
    due_date: '',
    note: ''
  })

  // Pay modal
  const [payOpen, setPayOpen] = useState(false)
  const [selected, setSelected] = useState<DebtReceivableItem | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState<'cash' | 'qris' | 'transfer'>('cash')
  const [payNote, setPayNote] = useState('')

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

  // Handle Add Item
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
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

      const newItem: DebtReceivableItem = {
        id: 'dr-' + Date.now(),
        type: form.type,
        party_name: form.party_name.trim(),
        category: form.category,
        description: form.description.trim(),
        total_amount: total,
        paid_amount: 0,
        remaining_amount: total,
        due_date: form.due_date || null,
        status: 'unpaid',
        note: form.note.trim() || null,
        created_at: new Date().toISOString()
      }

      if (user) {
        try {
          const { data: inserted, error } = await supabase
            .from('supplier_payables')
            .insert({
              supplier_name: newItem.party_name,
              party_name: newItem.party_name,
              type: newItem.type,
              category: newItem.category,
              description: newItem.description,
              total_amount: newItem.total_amount,
              paid_amount: 0,
              due_date: newItem.due_date,
              status: 'unpaid',
              note: newItem.note,
              created_by: user.id
            })
            .select('id')
            .single()

          if (!error && inserted) {
            newItem.id = inserted.id
          }
        } catch {
          // fallback client memory
        }
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
      const newPaid = selected.paid_amount + amt
      const newRemaining = selected.total_amount - newPaid
      const newStatus = newRemaining === 0 ? 'paid' : 'partial'

      const { data: { user } } = await supabase.auth.getUser()

      if (user && !selected.id.startsWith('d') && !selected.id.startsWith('dr-')) {
        try {
          await supabase.from('supplier_payments').insert({
            supplier_payable_id: selected.id,
            amount: amt,
            payment_method: payMethod,
            note: payNote || null,
            created_by: user.id
          })

          await supabase
            .from('supplier_payables')
            .update({
              paid_amount: newPaid,
              status: newStatus
            })
            .eq('id', selected.id)
        } catch {
          // ignore
        }
      }

      setData(prev => prev.map(item => {
        if (item.id === selected.id) {
          return {
            ...item,
            paid_amount: newPaid,
            remaining_amount: newRemaining,
            status: newStatus
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
            onClick={() => setAddOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', fontWeight: 600 }}
          >
            <Plus size={16} />
            Catat Hutang / Piutang
          </button>
        }
      />

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
          <div style={{ display: 'flex', background: 'var(--bg)', padding: 4, borderRadius: 8, border: '1px solid var(--line)', gap: 4 }}>
            <button
              type="button"
              onClick={() => setTypeFilter('all')}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: 'none',
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
                background: typeFilter === 'all' ? 'var(--panel)' : 'transparent',
                color: typeFilter === 'all' ? 'var(--ink)' : 'var(--mute)',
                boxShadow: typeFilter === 'all' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
              }}
            >
              Semua Jenis
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('payable')}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: 'none',
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
                background: typeFilter === 'payable' ? 'var(--bads)' : 'transparent',
                color: typeFilter === 'payable' ? 'var(--bad)' : 'var(--mute)',
                boxShadow: typeFilter === 'payable' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
              }}
            >
              🔴 Hutang Toko
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('receivable')}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: 'none',
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
                background: typeFilter === 'receivable' ? 'var(--oks)' : 'transparent',
                color: typeFilter === 'receivable' ? 'var(--ok)' : 'var(--mute)',
                boxShadow: typeFilter === 'receivable' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
              }}
            >
              🟢 Piutang Usaha
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
            {CATEGORIES.map(c => (
              <option key={c} value={c}>{c}</option>
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
                    <span style={{ fontSize: 15 }}>🔴 Hutang Toko</span>
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
                    <span style={{ fontSize: 15 }}>🟢 Piutang Usaha</span>
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
                <label className="label" htmlFor="category-select">
                  Kategori Peruntukan <span style={{ color: 'var(--bad)' }}>*</span>
                </label>
                <select
                  id="category-select"
                  className="input"
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                >
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
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
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  {[
                    { id: 'cash', label: 'Tunai' },
                    { id: 'transfer', label: 'Transfer' },
                    { id: 'qris', label: 'QRIS' },
                  ].map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPayMethod(m.id as any)}
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
    </div>
  )
}
