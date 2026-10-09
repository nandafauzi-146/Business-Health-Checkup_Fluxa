'use client'

import { useState } from 'react'
import { Plus, Search, CreditCard, DollarSign, AlertCircle, CheckCircle, Clock, Calendar, X, Check, User } from 'lucide-react'
import { PageHeader } from '@/components/layout/Topbar'
import { SectionCard, StatusTag, FormatRupiah } from '@/components/ui/Cards'
import { createClient } from '@/lib/supabase/client'

interface Customer {
  id: string
  name: string
  phone: string | null
}

interface Receivable {
  id: string
  customer_id: string
  customer_name: string
  customer_phone: string | null
  total_amount: number
  paid_amount: number
  remaining_amount: number
  due_date: string | null
  status: 'unpaid' | 'partial' | 'paid'
  note: string | null
  created_at: string
}

export default function ReceivablesClient({
  initialReceivables,
  customers
}: {
  initialReceivables: Receivable[]
  customers: Customer[]
}) {
  const [receivables, setReceivables] = useState<Receivable[]>(initialReceivables)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'unpaid' | 'partial' | 'paid'>('all')

  // Payment Modal
  const [payModalOpen, setPayModalOpen] = useState(false)
  const [selectedReceivable, setSelectedReceivable] = useState<Receivable | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState<'cash' | 'qris' | 'transfer'>('cash')
  const [payNote, setPayNote] = useState('')

  // New Kasbon Modal
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [newCustomer, setNewCustomer] = useState(customers[0]?.id || '')
  const [newAmount, setNewAmount] = useState('')
  const [newDueDate, setNewDueDate] = useState('')
  const [newNote, setNewNote] = useState('')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [notification, setNotification] = useState<{ type: 'ok' | 'bad'; text: string } | null>(null)

  const supabase = createClient()

  const totalOutstanding = receivables
    .filter(r => r.status !== 'paid')
    .reduce((sum, r) => sum + (r.total_amount - r.paid_amount), 0)

  const totalPaid = receivables.reduce((sum, r) => sum + r.paid_amount, 0)
  const totalAll = receivables.reduce((sum, r) => sum + r.total_amount, 0)

  const filtered = receivables.filter(r => {
    const matchSearch = r.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      (r.note && r.note.toLowerCase().includes(search.toLowerCase())) ||
      (r.customer_phone && r.customer_phone.includes(search))
    const matchStatus = statusFilter === 'all' ? true : r.status === statusFilter
    return matchSearch && matchStatus
  })

  const showNotification = (text: string, type: 'ok' | 'bad' = 'ok') => {
    setNotification({ type, text })
    setTimeout(() => setNotification(null), 3000)
  }

  const handleOpenPay = (rec: Receivable) => {
    setSelectedReceivable(rec)
    const remaining = rec.total_amount - rec.paid_amount
    setPayAmount(remaining.toLocaleString('id-ID'))
    setPayMethod('cash')
    setPayNote('')
    setPayModalOpen(true)
  }

  const handlePaySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedReceivable) return
    const amountNum = parseInt(payAmount.replace(/\D/g, ''))
    if (!amountNum || amountNum <= 0) return

    const remaining = selectedReceivable.total_amount - selectedReceivable.paid_amount
    if (amountNum > remaining) {
      alert(`Nominal pembayaran (Rp ${amountNum.toLocaleString('id-ID')}) melebihi sisa tagihan (Rp ${remaining.toLocaleString('id-ID')})`)
      return
    }

    setIsSubmitting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Pengguna belum login.')

      // 1. Simpan ke receivable_payments
      const { error: payErr } = await supabase
        .from('receivable_payments')
        .insert({
          receivable_id: selectedReceivable.id,
          amount: amountNum,
          payment_method: payMethod,
          note: payNote.trim() || null,
          created_by: user.id
        })

      if (payErr) throw payErr

      // 2. Update status & paid_amount di receivables
      const newPaid = selectedReceivable.paid_amount + amountNum
      const newStatus = newPaid >= selectedReceivable.total_amount ? 'paid' : 'partial'

      const { error: updateErr } = await supabase
        .from('receivables')
        .update({
          paid_amount: newPaid,
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedReceivable.id)

      if (updateErr) throw updateErr

      setReceivables(prev => prev.map(r => r.id === selectedReceivable.id ? {
        ...r,
        paid_amount: newPaid,
        remaining_amount: r.total_amount - newPaid,
        status: newStatus
      } : r))

      showNotification(`Pembayaran kasbon Rp ${amountNum.toLocaleString('id-ID')} untuk ${selectedReceivable.customer_name} berhasil dicatat.`, 'ok')
      setPayModalOpen(false)
    } catch (err: any) {
      console.error('Error paying receivable:', err)
      // Demo fallback
      const newPaid = selectedReceivable.paid_amount + amountNum
      const newStatus = newPaid >= selectedReceivable.total_amount ? 'paid' : 'partial'
      setReceivables(prev => prev.map(r => r.id === selectedReceivable.id ? {
        ...r,
        paid_amount: newPaid,
        remaining_amount: r.total_amount - newPaid,
        status: newStatus
      } : r))
      showNotification(`Pembayaran kasbon Rp ${amountNum.toLocaleString('id-ID')} dicatat (simulasi mode).`, 'ok')
      setPayModalOpen(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCreateReceivable = async (e: React.FormEvent) => {
    e.preventDefault()
    const amountNum = parseInt(newAmount.replace(/\D/g, ''))
    if (!newCustomer || !amountNum) return

    setIsSubmitting(true)
    try {
      const { data, error } = await supabase
        .from('receivables')
        .insert({
          customer_id: newCustomer,
          total_amount: amountNum,
          paid_amount: 0,
          due_date: newDueDate || null,
          status: 'unpaid',
          note: newNote.trim() || null
        })
        .select(`
          id,
          customer_id,
          total_amount,
          paid_amount,
          due_date,
          status,
          note,
          created_at,
          customers (name, phone)
        `)
        .single()

      if (error) throw error

      const created: Receivable = {
        id: data.id,
        customer_id: data.customer_id,
        customer_name: (data.customers as any)?.name || 'Pelanggan',
        customer_phone: (data.customers as any)?.phone || null,
        total_amount: data.total_amount,
        paid_amount: data.paid_amount,
        remaining_amount: data.total_amount - data.paid_amount,
        due_date: data.due_date,
        status: data.status as any,
        note: data.note,
        created_at: data.created_at
      }

      setReceivables(prev => [created, ...prev])
      showNotification(`Kasbon baru sebesar Rp ${amountNum.toLocaleString('id-ID')} berhasil dibuat.`, 'ok')
      setAddModalOpen(false)
      setNewAmount('')
      setNewDueDate('')
      setNewNote('')
    } catch (err: any) {
      console.error('Error creating receivable:', err)
      // Fallback demo
      const custObj = customers.find(c => c.id === newCustomer)
      const created: Receivable = {
        id: Math.random().toString(),
        customer_id: newCustomer,
        customer_name: custObj?.name || 'Pelanggan Demo',
        customer_phone: custObj?.phone || null,
        total_amount: amountNum,
        paid_amount: 0,
        remaining_amount: amountNum,
        due_date: newDueDate || null,
        status: 'unpaid',
        note: newNote.trim() || null,
        created_at: new Date().toISOString()
      }
      setReceivables(prev => [created, ...prev])
      showNotification(`Kasbon baru Rp ${amountNum.toLocaleString('id-ID')} dibuat (simulasi mode).`, 'ok')
      setAddModalOpen(false)
      setNewAmount('')
      setNewDueDate('')
      setNewNote('')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Kasbon & Piutang Pelanggan"
        subtitle="Kelola tagihan pelanggan yang belum lunas, jadwal jatuh tempo, dan pencatatan pembayaran cicilan"
        actions={
          <button onClick={() => setAddModalOpen(true)} className="btn btn-primary" id="tambah-kasbon-btn">
            <Plus size={15} /> Tambah Kasbon Manual
          </button>
        }
      />

      {notification && (
        <div style={{
          padding: '12px 16px',
          borderRadius: 12,
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: notification.type === 'ok' ? 'var(--oks)' : 'var(--bads)',
          color: notification.type === 'ok' ? 'var(--ok)' : 'var(--bad)',
          fontWeight: 600,
          fontSize: 13,
          border: `1px solid ${notification.type === 'ok' ? 'var(--ok)' : 'var(--bad)'}`
        }}>
          <span>{notification.text}</span>
          <button onClick={() => setNotification(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>✕</button>
        </div>
      )}

      {/* KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: 14,
        marginBottom: 20
      }}>
        <div className="kpi-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="kpi-label">Sisa Piutang Belum Lunas</span>
            <div className="kpi-icon" style={{ background: 'var(--warns)', color: 'var(--warn)' }}>
              <AlertCircle size={18} />
            </div>
          </div>
          <div className="kpi-value" style={{ color: 'var(--warn)' }}>
            <FormatRupiah amount={totalOutstanding} />
          </div>
          <span className="kpi-sub">Total dana kasbon yang masih di pelanggan</span>
        </div>

        <div className="kpi-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="kpi-label">Total Telah Terbayar</span>
            <div className="kpi-icon" style={{ background: 'var(--oks)', color: 'var(--ok)' }}>
              <CheckCircle size={18} />
            </div>
          </div>
          <div className="kpi-value" style={{ color: 'var(--ok)' }}>
            <FormatRupiah amount={totalPaid} />
          </div>
          <span className="kpi-sub">Akumulasi pelunasan kasbon tercatat</span>
        </div>

        <div className="kpi-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="kpi-label">Akumulasi Seluruh Kasbon</span>
            <div className="kpi-icon" style={{ background: 'var(--accs)', color: 'var(--acc)' }}>
              <CreditCard size={18} />
            </div>
          </div>
          <div className="kpi-value" style={{ color: 'var(--ink)' }}>
            <FormatRupiah amount={totalAll} />
          </div>
          <span className="kpi-sub">Total dari {receivables.length} riwayat kasbon</span>
        </div>
      </div>

      <SectionCard title={`Daftar Kasbon (${filtered.length})`}>
        {/* Filters */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="search-bar" style={{ flex: 1, minWidth: 260 }}>
            <Search size={15} color="var(--mute)" />
            <input
              type="text"
              placeholder="Cari pelanggan, catatan, atau no telepon..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mute)' }}
              >
                ✕
              </button>
            )}
          </div>

          <div className="filter-tabs">
            <button
              onClick={() => setStatusFilter('all')}
              className={`filter-tab ${statusFilter === 'all' ? 'active' : ''}`}
            >
              Semua ({receivables.length})
            </button>
            <button
              onClick={() => setStatusFilter('unpaid')}
              className={`filter-tab ${statusFilter === 'unpaid' ? 'active' : ''}`}
            >
              Belum Bayar ({receivables.filter(r => r.status === 'unpaid').length})
            </button>
            <button
              onClick={() => setStatusFilter('partial')}
              className={`filter-tab ${statusFilter === 'partial' ? 'active' : ''}`}
            >
              Cicilan ({receivables.filter(r => r.status === 'partial').length})
            </button>
            <button
              onClick={() => setStatusFilter('paid')}
              className={`filter-tab ${statusFilter === 'paid' ? 'active' : ''}`}
            >
              Lunas ({receivables.filter(r => r.status === 'paid').length})
            </button>
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nama Pelanggan</th>
                <th>Tanggal Buat</th>
                <th>Jatuh Tempo</th>
                <th>Total Kasbon</th>
                <th>Sudah Dibayar</th>
                <th>Sisa Tagihan</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '36px 0', color: 'var(--mute)' }}>
                    Tidak ada data kasbon yang cocok dengan filter
                  </td>
                </tr>
              ) : (
                filtered.map(r => {
                  const remaining = r.total_amount - r.paid_amount
                  const isOverdue = r.due_date && new Date(r.due_date) < new Date() && r.status !== 'paid'

                  return (
                    <tr key={r.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                          <div style={{
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            background: 'var(--bg)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--mute)'
                          }}>
                            <User size={15} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{r.customer_name}</div>
                            {r.customer_phone && <div style={{ fontSize: 11, color: 'var(--mute)' }}>{r.customer_phone}</div>}
                            {r.note && <div style={{ fontSize: 11, color: 'var(--mute)', fontStyle: 'italic' }}>{r.note}</div>}
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize: 12.5, color: 'var(--mute)', whiteSpace: 'nowrap' }}>
                        {new Date(r.created_at).toLocaleDateString('id-ID', { dateStyle: 'medium' })}
                      </td>
                      <td style={{ fontSize: 12.5, whiteSpace: 'nowrap' }}>
                        {r.due_date ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <span style={{ color: isOverdue ? 'var(--bad)' : 'var(--ink)', fontWeight: isOverdue ? 700 : 400 }}>
                              {new Date(r.due_date).toLocaleDateString('id-ID', { dateStyle: 'medium' })}
                            </span>
                            {isOverdue && (
                              <span style={{
                                fontSize: 10,
                                background: 'var(--bads)',
                                color: 'var(--bad)',
                                padding: '1px 6px',
                                borderRadius: 6,
                                fontWeight: 700
                              }}>
                                Lewat!
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--mute)' }}>—</span>
                        )}
                      </td>
                      <td style={{ fontWeight: 600, fontSize: 13 }}>
                        <FormatRupiah amount={r.total_amount} />
                      </td>
                      <td style={{ color: 'var(--ok)', fontWeight: 600, fontSize: 13 }}>
                        <FormatRupiah amount={r.paid_amount} />
                      </td>
                      <td style={{ color: remaining > 0 ? 'var(--warn)' : 'var(--mute)', fontWeight: 700, fontSize: 13 }}>
                        <FormatRupiah amount={remaining} />
                      </td>
                      <td>
                        <StatusTag
                          type={r.status === 'paid' ? 'ok' : r.status === 'partial' ? 'warn' : 'bad'}
                          label={r.status === 'paid' ? 'Lunas' : r.status === 'partial' ? 'Cicilan' : 'Belum Bayar'}
                        />
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {r.status !== 'paid' ? (
                          <button
                            onClick={() => handleOpenPay(r)}
                            className="btn btn-primary btn-sm"
                            style={{ padding: '6px 14px' }}
                          >
                            <DollarSign size={13} /> Bayar Cicilan
                          </button>
                        ) : (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: 12,
                            color: 'var(--ok)',
                            fontWeight: 600,
                            padding: '4px 8px',
                            background: 'var(--oks)',
                            borderRadius: 6
                          }}>
                            <CheckCircle size={12} /> Lunas
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

      {/* Modal Bayar Kasbon */}
      {payModalOpen && selectedReceivable && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setPayModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: 460 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Pencatatan Pembayaran Kasbon</h3>
                <p style={{ fontSize: 12, color: 'var(--mute)', marginTop: 2 }}>
                  Catat pembayaran tunai, QRIS, atau transfer dari pelanggan
                </p>
              </div>
              <button className="icon-btn" onClick={() => setPayModalOpen(false)} aria-label="Tutup dialog">
                <X size={16} />
              </button>
            </div>

            {/* Receivable Summary Card */}
            <div style={{
              padding: '12px 14px',
              background: 'var(--bg)',
              borderRadius: 12,
              border: '1px solid var(--line)',
              marginBottom: 16,
              fontSize: 13
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: 'var(--mute)' }}>Pelanggan:</span>
                <strong style={{ color: 'var(--ink)' }}>{selectedReceivable.customer_name}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: 'var(--mute)' }}>Total Kasbon:</span>
                <span><FormatRupiah amount={selectedReceivable.total_amount} /></span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: 'var(--mute)' }}>Sudah Dibayar:</span>
                <span style={{ color: 'var(--ok)', fontWeight: 600 }}><FormatRupiah amount={selectedReceivable.paid_amount} /></span>
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                paddingTop: 8,
                marginTop: 6,
                borderTop: '1px dashed var(--line)',
                fontWeight: 700
              }}>
                <span style={{ color: 'var(--warn)' }}>Sisa Tagihan:</span>
                <span style={{ color: 'var(--warn)', fontSize: 14 }}>
                  <FormatRupiah amount={selectedReceivable.total_amount - selectedReceivable.paid_amount} />
                </span>
              </div>
            </div>

            <form onSubmit={handlePaySubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label className="label" htmlFor="pay-amt">Nominal Pembayaran (Rp) *</label>
                  <input
                    id="pay-amt"
                    type="text"
                    required
                    className="input"
                    value={payAmount}
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g, '')
                      setPayAmount(val ? parseInt(val).toLocaleString('id-ID') : '')
                    }}
                    style={{ fontSize: 16, fontWeight: 700 }}
                  />
                </div>

                <div>
                  <label className="label">Metode Pembayaran</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    {(['cash', 'qris', 'transfer'] as const).map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setPayMethod(m)}
                        className="btn"
                        style={{
                          background: payMethod === m ? 'var(--accs)' : 'var(--bg)',
                          color: payMethod === m ? 'var(--acc)' : 'var(--ink)',
                          border: payMethod === m ? '2px solid var(--acc)' : '1px solid var(--line)',
                          fontSize: 12,
                          padding: '10px 4px',
                          justifyContent: 'center',
                          textTransform: 'uppercase',
                          fontWeight: payMethod === m ? 700 : 500
                        }}
                      >
                        {m === 'cash' ? 'Tunai' : m === 'qris' ? 'QRIS' : 'Transfer'}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="label" htmlFor="pay-note">Catatan Pembayaran (Opsional)</label>
                  <input
                    id="pay-note"
                    type="text"
                    className="input"
                    placeholder="Contoh: Titipan kasir Budi, transfer BCA..."
                    value={payNote}
                    onChange={e => setPayNote(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 22 }}>
                <button
                  type="button"
                  onClick={() => setPayModalOpen(false)}
                  className="btn btn-secondary"
                  disabled={isSubmitting}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting || !payAmount}
                >
                  <Check size={14} /> {isSubmitting ? 'Memproses...' : 'Simpan Pembayaran'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Buat Kasbon Manual */}
      {addModalOpen && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setAddModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: 460 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Tambah Kasbon Pelanggan</h3>
                <p style={{ fontSize: 12, color: 'var(--mute)', marginTop: 2 }}>
                  Catat hutang atau kasbon baru secara manual
                </p>
              </div>
              <button className="icon-btn" onClick={() => setAddModalOpen(false)} aria-label="Tutup dialog">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateReceivable}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label className="label" htmlFor="kasbon-cust">Pilih Pelanggan *</label>
                  <select
                    id="kasbon-cust"
                    className="input"
                    value={newCustomer}
                    onChange={e => setNewCustomer(e.target.value)}
                    style={{ cursor: 'pointer' }}
                  >
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.phone ? `(${c.phone})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label" htmlFor="kasbon-amt">Nominal Kasbon (Rp) *</label>
                  <input
                    id="kasbon-amt"
                    type="text"
                    required
                    className="input"
                    placeholder="Contoh: 75.000"
                    value={newAmount}
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g, '')
                      setNewAmount(val ? parseInt(val).toLocaleString('id-ID') : '')
                    }}
                    style={{ fontSize: 16, fontWeight: 700 }}
                  />
                </div>

                <div>
                  <label className="label" htmlFor="kasbon-due">Tanggal Jatuh Tempo (Opsional)</label>
                  <input
                    id="kasbon-due"
                    type="date"
                    className="input"
                    value={newDueDate}
                    onChange={e => setNewDueDate(e.target.value)}
                  />
                </div>

                <div>
                  <label className="label" htmlFor="kasbon-note">Keterangan Kasbon</label>
                  <input
                    id="kasbon-note"
                    type="text"
                    className="input"
                    placeholder="Contoh: Titipan barang dagang, bon rokok..."
                    value={newNote}
                    onChange={e => setNewNote(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 22 }}>
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="btn btn-secondary"
                  disabled={isSubmitting}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting || !newAmount}
                >
                  <Check size={14} /> {isSubmitting ? 'Menyimpan...' : 'Buat Kasbon'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
