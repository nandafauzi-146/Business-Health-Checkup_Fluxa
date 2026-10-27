'use client'

import { useState } from 'react'
import {
  Plus, Search, DollarSign, Calendar, Trash2,
  X, TrendingDown, CheckCircle2, User, Pencil
} from 'lucide-react'
import { PageHeader } from '@/components/layout/Topbar'
import { SectionCard, FormatRupiah } from '@/components/ui/Cards'
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog'
import { createClient } from '@/lib/supabase/client'
import { getUserFacingError } from '@/lib/user-facing-error'

interface ExpenseCategory {
  id: string
  name: string
}

export interface Expense {
  id: string
  amount: number
  description: string
  expense_date: string
  created_at: string
  category_id: string | null
  category_name?: string
  shift_id?: string | null
  status?: 'pending' | 'approved' | 'rejected' | 'clarification'
  cash_impact?: boolean
  created_by?: string
  creator_name?: string
  creator_role?: string
  rejection_reason?: string | null
}

export default function ExpensesClient({
  initialExpenses,
  categories,
}: {
  initialExpenses: Expense[]
  categories: ExpenseCategory[]
}) {
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses)
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [sourceFilter, setSourceFilter] = useState<'all' | 'kasir' | 'admin'>('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [formData, setFormData] = useState({
    category_id: categories[0]?.id || '',
    amount: '',
    description: '',
    expense_date: new Date().toISOString().split('T')[0]
  })
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; expense: Expense | null }>({
    isOpen: false,
    expense: null
  })
  const [editExpense, setEditExpense] = useState<Expense | null>(null)
  const [editForm, setEditForm] = useState({
    category_id: '',
    amount: '',
    description: '',
    expense_date: ''
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [notification, setNotification] = useState<{ type: 'ok' | 'bad'; text: string } | null>(null)

  const supabase = createClient()

  // Kelompokkan pengeluaran berdasarkan penginput (Kasir vs Admin)
  const isCashierExpense = (e: Expense) => {
    return e.creator_role === 'kasir' ||
      Boolean(e.shift_id) ||
      (typeof e.description === 'string' && (
        e.description.includes('[Shift Operasional]') ||
        e.description.includes('[Dicatat oleh:')
      ))
  }

  const cashierExpenses = expenses.filter(isCashierExpense)
  const cashierExpensesTotal = cashierExpenses.reduce((acc, curr) => acc + curr.amount, 0)
  const cashierExpensesCount = cashierExpenses.length

  const totalExpense = expenses.reduce((acc, curr) => acc + curr.amount, 0)

  const thisMonthExpenses = expenses
    .filter(e => {
      const d = new Date(e.expense_date)
      const now = new Date()
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    .reduce((acc, curr) => acc + curr.amount, 0)

  const filtered = expenses.filter(e => {
    const matchSearch = e.description.toLowerCase().includes(search.toLowerCase()) ||
      (e.category_name && e.category_name.toLowerCase().includes(search.toLowerCase())) ||
      (e.creator_name && e.creator_name.toLowerCase().includes(search.toLowerCase()))
    const matchCat = selectedCategory === 'all' ? true : e.category_id === selectedCategory
    const isKasir = isCashierExpense(e)
    const matchSource = sourceFilter === 'all'
      ? true
      : sourceFilter === 'kasir'
      ? isKasir
      : !isKasir
    return matchSearch && matchCat && matchSource
  })

  const showNotification = (text: string, type: 'ok' | 'bad' = 'ok') => {
    setNotification({ type, text })
    setTimeout(() => setNotification(null), 3500)
  }

  const handleOpenAdd = () => {
    setFormData({
      category_id: categories[0]?.id || '',
      amount: '',
      description: '',
      expense_date: new Date().toISOString().split('T')[0]
    })
    setModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const amountNum = parseInt(formData.amount.replace(/\D/g, ''))
    if (!amountNum || !formData.description.trim()) return

    setIsSubmitting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Pengguna belum login.')

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, role')
        .eq('id', user.id)
        .single()

      const { data, error } = await supabase
        .from('expenses')
        .insert({
          category_id: formData.category_id || null,
          amount: amountNum,
          description: formData.description.trim(),
          expense_date: formData.expense_date,
          created_by: user.id
        })
        .select(`
          id,
          amount,
          description,
          expense_date,
          created_at,
          category_id,
          expense_categories (name)
        `)
        .single()

      if (error) throw error

      const newExpense: Expense = {
        id: data.id,
        amount: data.amount,
        description: data.description,
        expense_date: data.expense_date,
        created_at: data.created_at,
        category_id: data.category_id,
        category_name: (data.expense_categories as any)?.name || categories.find(c => c.id === data.category_id)?.name || 'Lainnya',
        status: 'approved',
        cash_impact: true,
        created_by: user.id,
        creator_name: profile?.full_name || 'Admin',
        creator_role: profile?.role || 'admin',
      }

      setExpenses([newExpense, ...expenses])
      setModalOpen(false)
      showNotification('Biaya operasional berhasil dicatat.', 'ok')
    } catch (err: unknown) {
      console.error('Error adding expense:', err)
      showNotification(getUserFacingError(err, 'Biaya operasional belum dapat disimpan. Silakan coba lagi.'), 'bad')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = (exp: Expense) => {
    setDeleteConfirm({ isOpen: true, expense: exp })
  }

  const handleOpenEdit = (exp: Expense) => {
    setEditExpense(exp)
    const cleanDesc = exp.description
      ? exp.description.replace(/^\[Shift Operasional\]\s*/i, '').replace(/\s*\[Dicatat oleh:[^\]]*\]/i, '').trim()
      : ''
    setEditForm({
      category_id: exp.category_id || categories[0]?.id || '',
      amount: exp.amount.toLocaleString('id-ID'),
      description: cleanDesc,
      expense_date: exp.expense_date
    })
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editExpense) return
    const amountNum = parseInt(editForm.amount.replace(/\D/g, ''))
    if (!amountNum || !editForm.description.trim()) return

    setIsSubmitting(true)
    try {
      const { error } = await supabase
        .from('expenses')
        .update({
          category_id: editForm.category_id || null,
          amount: amountNum,
          description: editForm.description.trim(),
          expense_date: editForm.expense_date
        })
        .eq('id', editExpense.id)

      if (error) throw error

      setExpenses(prev => prev.map(e =>
        e.id === editExpense.id
          ? {
              ...e,
              category_id: editForm.category_id || null,
              amount: amountNum,
              description: editForm.description.trim(),
              expense_date: editForm.expense_date,
              category_name: categories.find(c => c.id === editForm.category_id)?.name || e.category_name
            }
          : e
      ))
      setEditExpense(null)
      showNotification('Catatan biaya berhasil diperbarui.', 'ok')
    } catch (err: unknown) {
      console.error('Error updating expense:', err)
      showNotification(getUserFacingError(err, 'Catatan biaya belum dapat diperbarui. Silakan coba lagi.'), 'bad')
    } finally {
      setIsSubmitting(false)
    }
  }

  const confirmDelete = async () => {
    const exp = deleteConfirm.expense
    if (!exp) return

    setIsSubmitting(true)
    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', exp.id)

      if (error) throw error

      setExpenses(prev => prev.filter(e => e.id !== exp.id))
      showNotification('Catatan biaya berhasil dihapus.', 'ok')
    } catch (err: unknown) {
      console.error('Error deleting expense:', err)
      showNotification(getUserFacingError(err, 'Catatan biaya belum dapat dihapus. Silakan coba lagi.'), 'bad')
    } finally {
      setIsSubmitting(false)
      setDeleteConfirm({ isOpen: false, expense: null })
    }
  }

  return (
    <div>
      <PageHeader
        title="Biaya Operasional"
        subtitle="Kelola pengeluaran toko, pantau pencatatan kasir, dan rekonsiliasi kas laci shift"
        actions={
          <button onClick={handleOpenAdd} className="btn btn-primary" id="catat-biaya-btn">
            <Plus size={15} /> Catat Biaya Baru
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
          <button
            onClick={() => setNotification(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
          >
            ✕
          </button>
        </div>
      )}


      {/* KPI Cards: Ringkasan Pengeluaran & Kasir */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="kpi-label">Total Biaya Bulan Ini</span>
            <div className="kpi-icon" style={{ background: 'var(--bads)', color: 'var(--bad)' }}>
              <TrendingDown size={18} />
            </div>
          </div>
          <div className="kpi-value" style={{ color: 'var(--bad)' }}>
            <FormatRupiah amount={thisMonthExpenses} />
          </div>
          <span className="kpi-sub">Total pengeluaran di bulan berjalan</span>
        </div>

        <div className="kpi-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="kpi-label">Biaya Dicatat Kasir</span>
            <div className="kpi-icon" style={{ background: 'var(--warns)', color: 'var(--warn)' }}>
              <User size={18} />
            </div>
          </div>
          <div className="kpi-value" style={{ color: 'var(--warn)' }}>
            <FormatRupiah amount={cashierExpensesTotal} />
          </div>
          <span className="kpi-sub">{cashierExpensesCount} pengeluaran dari shift kasir</span>
        </div>

        <div className="kpi-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="kpi-label">Total Seluruh Biaya</span>
            <div className="kpi-icon" style={{ background: 'var(--accs)', color: 'var(--acc)' }}>
              <DollarSign size={18} />
            </div>
          </div>
          <div className="kpi-value" style={{ color: 'var(--ink)' }}>
            <FormatRupiah amount={totalExpense} />
          </div>
          <span className="kpi-sub">Akumulasi dari {expenses.length} transaksi biaya</span>
        </div>
      </div>

      <SectionCard title={`Daftar Pengeluaran Toko (${filtered.length})`}>
        {/* Filter Penginput Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setSourceFilter('all')}
            style={{
              padding: '6px 14px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              border: '1px solid var(--line)',
              background: sourceFilter === 'all' ? 'var(--ink)' : 'var(--panel)',
              color: sourceFilter === 'all' ? 'var(--panel)' : 'var(--ink)'
            }}
          >
            Semua ({expenses.length})
          </button>
          <button
            type="button"
            onClick={() => setSourceFilter('kasir')}
            style={{
              padding: '6px 14px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              border: `1px solid ${sourceFilter === 'kasir' ? 'var(--warn)' : 'var(--line)'}`,
              background: sourceFilter === 'kasir' ? 'var(--warn)' : 'var(--panel)',
              color: sourceFilter === 'kasir' ? '#fff' : 'var(--warn)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <User size={13} />
            <span>Dicatat Kasir ({cashierExpensesCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setSourceFilter('admin')}
            style={{
              padding: '6px 14px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              border: `1px solid ${sourceFilter === 'admin' ? 'var(--acc)' : 'var(--line)'}`,
              background: sourceFilter === 'admin' ? 'var(--acc)' : 'var(--panel)',
              color: sourceFilter === 'admin' ? '#fff' : 'var(--ink)'
            }}
          >
            Dicatat Admin ({expenses.length - cashierExpensesCount})
          </button>
        </div>

        {/* Search & Category Filter */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="search-bar" style={{ flex: 1, minWidth: 'min(260px, 100%)' }}>
            <Search size={15} color="var(--mute)" />
            <input
              type="text"
              placeholder="Cari deskripsi, kasir penginput, atau kategori..."
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

          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            style={{
              padding: '8px 14px',
              borderRadius: 10,
              border: '1px solid var(--line)',
              background: 'var(--panel)',
              color: 'var(--ink)',
              fontSize: 13,
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="all">Semua Kategori</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Table Pengeluaran */}
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Waktu Input</th>
                <th>Deskripsi Pengeluaran</th>
                <th>Nama Penginput</th>
                <th>Sumber</th>
                <th className="hide-sm">Kategori</th>
                <th>Status</th>
                <th>Nominal</th>
                <th style={{ textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '36px 0', color: 'var(--mute)' }}>
                    Belum ada catatan biaya yang cocok dengan filter
                  </td>
                </tr>
              ) : (
                filtered.map(exp => {
                  const isFromCashier = isCashierExpense(exp)
                  const cleanDesc = exp.description
                    ? exp.description.replace(/^\[Shift Operasional\]\s*/i, '').replace(/\s*\[Dicatat oleh:[^\]]*\]/i, '').trim()
                    : '—'
                  const createdDate = exp.created_at ? new Date(exp.created_at) : new Date(exp.expense_date)
                  const dateFormatted = createdDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
                  const timeFormatted = exp.created_at ? createdDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB' : '—'

                  return (
                    <tr key={exp.id}>
                      <td style={{ fontSize: 12.5, color: 'var(--mute)', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500, color: 'var(--ink)' }}>
                          <Calendar size={13} color="var(--mute)" />
                          {dateFormatted}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--mute)', marginTop: 2, paddingLeft: 19 }}>
                          {timeFormatted}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{cleanDesc}</div>
                      </td>
                      <td style={{ fontSize: 13 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <User size={13} color={isFromCashier ? 'var(--warn)' : 'var(--acc)'} />
                          <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{exp.creator_name || 'Kasir'}</span>
                        </div>
                      </td>
                      <td>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: 6,
                          background: isFromCashier ? 'var(--warns)' : 'var(--accs)',
                          color: isFromCashier ? 'var(--warn)' : 'var(--acc)',
                          fontWeight: 700,
                          fontSize: 11,
                          display: 'inline-block'
                        }}>
                          {isFromCashier ? 'Kasir Toko' : 'Admin'}
                        </span>
                      </td>
                      <td className="hide-sm">
                        <span style={{
                          padding: '3px 9px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 600,
                          background: 'var(--accs)',
                          color: 'var(--acc)'
                        }}>
                          {exp.category_name || 'Umum'}
                        </span>
                      </td>
                      <td>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 700,
                          background: 'var(--oks)',
                          color: 'var(--ok)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4
                        }}>
                          <CheckCircle2 size={11} />
                          Tercatat
                        </span>
                      </td>
                      <td style={{ fontWeight: 700, color: 'var(--bad)', fontSize: 13.5 }}>
                        <FormatRupiah amount={exp.amount} />
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          <button
                            onClick={() => handleOpenEdit(exp)}
                            className="btn btn-sm"
                            style={{ background: 'var(--accs)', color: 'var(--acc)', border: 'none' }}
                            title="Edit Catatan"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            onClick={() => handleDelete(exp)}
                            className="btn btn-sm"
                            style={{ background: 'var(--bads)', color: 'var(--bad)', border: 'none' }}
                            title="Hapus Catatan"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Modal Catat Biaya */}
      {modalOpen && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: 460 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Catat Biaya Operasional Baru</h3>
                <p style={{ fontSize: 12, color: 'var(--mute)', marginTop: 2 }}>
                  Catat pengeluaran kas toko secara akurat untuk laporan keuangan
                </p>
              </div>
              <button className="icon-btn" onClick={() => setModalOpen(false)} aria-label="Tutup dialog">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label className="label" htmlFor="exp-cat">Kategori Biaya</label>
                  <select
                    id="exp-cat"
                    className="input"
                    value={formData.category_id}
                    onChange={e => setFormData({ ...formData, category_id: e.target.value })}
                    style={{ cursor: 'pointer' }}
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label" htmlFor="exp-amount">Nominal (Rp)</label>
                  <input
                    id="exp-amount"
                    className="input"
                    type="text"
                    inputMode="numeric"
                    placeholder="Contoh: 50.000"
                    value={formData.amount}
                    onChange={e => {
                      const clean = e.target.value.replace(/\D/g, '')
                      setFormData({ ...formData, amount: clean ? parseInt(clean).toLocaleString('id-ID') : '' })
                    }}
                    required
                  />
                </div>

                <div>
                  <label className="label" htmlFor="exp-desc">Deskripsi / Keterangan</label>
                  <input
                    id="exp-desc"
                    className="input"
                    type="text"
                    placeholder="Contoh: Beli token listrik, kantong kresek..."
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="label" htmlFor="exp-date">Tanggal Biaya</label>
                  <input
                    id="exp-date"
                    className="input"
                    type="date"
                    value={formData.expense_date}
                    onChange={e => setFormData({ ...formData, expense_date: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting}
                  id="simpan-biaya-btn"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Biaya'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edit Biaya */}
      {editExpense && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setEditExpense(null)}>
          <div className="modal-content" style={{ maxWidth: 460 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Edit Catatan Biaya</h3>
                <p style={{ fontSize: 12, color: 'var(--mute)', marginTop: 2 }}>
                  Perbarui detail pengeluaran yang telah tercatat
                </p>
              </div>
              <button className="icon-btn" onClick={() => setEditExpense(null)} aria-label="Tutup dialog">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleUpdate}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label className="label" htmlFor="edit-exp-cat">Kategori Biaya</label>
                  <select
                    id="edit-exp-cat"
                    className="input"
                    value={editForm.category_id}
                    onChange={e => setEditForm({ ...editForm, category_id: e.target.value })}
                    style={{ cursor: 'pointer' }}
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label" htmlFor="edit-exp-amount">Nominal (Rp)</label>
                  <input
                    id="edit-exp-amount"
                    className="input"
                    type="text"
                    inputMode="numeric"
                    placeholder="Contoh: 50.000"
                    value={editForm.amount}
                    onChange={e => {
                      const clean = e.target.value.replace(/\D/g, '')
                      setEditForm({ ...editForm, amount: clean ? parseInt(clean).toLocaleString('id-ID') : '' })
                    }}
                    required
                  />
                </div>

                <div>
                  <label className="label" htmlFor="edit-exp-desc">Deskripsi / Keterangan</label>
                  <input
                    id="edit-exp-desc"
                    className="input"
                    type="text"
                    placeholder="Contoh: Beli token listrik, kantong kresek..."
                    value={editForm.description}
                    onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="label" htmlFor="edit-exp-date">Tanggal Biaya</label>
                  <input
                    id="edit-exp-date"
                    className="input"
                    type="date"
                    value={editForm.expense_date}
                    onChange={e => setEditForm({ ...editForm, expense_date: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditExpense(null)}
                  disabled={isSubmitting}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting}
                  id="simpan-edit-biaya-btn"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Konfirmasi Hapus Biaya */}
      <ConfirmationDialog
        isOpen={deleteConfirm.isOpen}
        title="Hapus Catatan Biaya"
        message={`Apakah Anda yakin ingin menghapus catatan biaya "${deleteConfirm.expense?.description}" sebesar Rp ${deleteConfirm.expense?.amount.toLocaleString('id-ID')}?`}
        confirmLabel="Ya, Hapus"
        variant="danger"
        icon="delete"
        onConfirm={confirmDelete}
        onClose={() => setDeleteConfirm({ isOpen: false, expense: null })}
      />
    </div>
  )
}
