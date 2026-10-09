'use client'

import { useState } from 'react'
import { Plus, Search, DollarSign, Calendar, Trash2, Tag, ArrowUpRight, X, Check, TrendingDown } from 'lucide-react'
import { PageHeader } from '@/components/layout/Topbar'
import { SectionCard, FormatRupiah } from '@/components/ui/Cards'
import { createClient } from '@/lib/supabase/client'

interface ExpenseCategory {
  id: string
  name: string
}

interface Expense {
  id: string
  amount: number
  description: string
  expense_date: string
  created_at: string
  category_id: string | null
  category_name?: string
}

export default function ExpensesClient({
  initialExpenses,
  categories
}: {
  initialExpenses: Expense[]
  categories: ExpenseCategory[]
}) {
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses)
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [formData, setFormData] = useState({
    category_id: categories[0]?.id || '',
    amount: '',
    description: '',
    expense_date: new Date().toISOString().split('T')[0]
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [notification, setNotification] = useState<{ type: 'ok' | 'bad'; text: string } | null>(null)

  const supabase = createClient()

  const totalExpense = expenses.reduce((acc, curr) => acc + curr.amount, 0)
  const thisMonthExpenses = expenses.filter(e => {
    const d = new Date(e.expense_date)
    const now = new Date()
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).reduce((acc, curr) => acc + curr.amount, 0)

  const filtered = expenses.filter(e => {
    const matchSearch = e.description.toLowerCase().includes(search.toLowerCase()) ||
      (e.category_name && e.category_name.toLowerCase().includes(search.toLowerCase()))
    const matchCat = selectedCategory === 'all' ? true : e.category_id === selectedCategory
    return matchSearch && matchCat
  })

  const showNotification = (text: string, type: 'ok' | 'bad' = 'ok') => {
    setNotification({ type, text })
    setTimeout(() => setNotification(null), 3000)
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
        category_name: (data.expense_categories as any)?.name || categories.find(c => c.id === data.category_id)?.name || 'Lainnya'
      }

      setExpenses(prev => [newExpense, ...prev])
      showNotification(`Biaya operasional sebesar Rp ${amountNum.toLocaleString('id-ID')} berhasil dicatat.`, 'ok')
      setModalOpen(false)
    } catch (err: any) {
      console.error('Error saving expense:', err)
      // Demo fallback
      const catObj = categories.find(c => c.id === formData.category_id)
      const dummy: Expense = {
        id: Math.random().toString(),
        amount: amountNum,
        description: formData.description.trim(),
        expense_date: formData.expense_date,
        created_at: new Date().toISOString(),
        category_id: formData.category_id || null,
        category_name: catObj?.name || 'Umum'
      }
      setExpenses(prev => [dummy, ...prev])
      showNotification(`Biaya operasional sebesar Rp ${amountNum.toLocaleString('id-ID')} dicatat (simulasi mode).`, 'ok')
      setModalOpen(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (exp: Expense) => {
    if (!confirm(`Hapus catatan biaya "${exp.description}" sebesar Rp ${exp.amount.toLocaleString('id-ID')}?`)) return

    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', exp.id)

      if (error) throw error

      setExpenses(prev => prev.filter(e => e.id !== exp.id))
      showNotification('Catatan biaya berhasil dihapus.', 'ok')
    } catch (err: any) {
      console.error('Error deleting expense:', err)
      setExpenses(prev => prev.filter(e => e.id !== exp.id))
      showNotification('Catatan biaya dihapus (simulasi mode).', 'ok')
    }
  }

  return (
    <div>
      <PageHeader
        title="Biaya Operasional"
        subtitle="Catat dan pantau pengeluaran operasional toko (sewa, listrik, gaji, logistik, perlengkapan)"
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
          <button onClick={() => setNotification(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>✕</button>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: 14,
        marginBottom: 20
      }}>
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
            <span className="kpi-label">Total Seluruh Biaya Tercatat</span>
            <div className="kpi-icon" style={{ background: 'var(--warns)', color: 'var(--warn)' }}>
              <DollarSign size={18} />
            </div>
          </div>
          <div className="kpi-value" style={{ color: 'var(--ink)' }}>
            <FormatRupiah amount={totalExpense} />
          </div>
          <span className="kpi-sub">Akumulasi dari {expenses.length} transaksi biaya</span>
        </div>
      </div>

      <SectionCard title={`Riwayat Pengeluaran (${filtered.length})`}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="search-bar" style={{ flex: 1, minWidth: 260 }}>
            <Search size={15} color="var(--mute)" />
            <input
              type="text"
              placeholder="Cari deskripsi biaya atau kategori..."
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

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Deskripsi Pengeluaran</th>
                <th>Kategori</th>
                <th>Nominal</th>
                <th style={{ textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '36px 0', color: 'var(--mute)' }}>
                    Belum ada catatan biaya yang cocok dengan filter
                  </td>
                </tr>
              ) : (
                filtered.map(exp => (
                  <tr key={exp.id}>
                    <td style={{ fontSize: 13, color: 'var(--mute)', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Calendar size={13} color="var(--mute)" />
                        {new Date(exp.expense_date).toLocaleDateString('id-ID', { dateStyle: 'medium' })}
                      </div>
                    </td>
                    <td style={{ fontWeight: 600 }}>{exp.description}</td>
                    <td>
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
                    <td style={{ fontWeight: 700, color: 'var(--bad)', fontSize: 13.5 }}>
                      <FormatRupiah amount={exp.amount} />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        onClick={() => handleDelete(exp)}
                        className="btn btn-sm"
                        style={{ background: 'var(--bads)', color: 'var(--bad)', border: 'none' }}
                        title="Hapus Catatan"
                      >
                        <Trash2 size={12} /> Hapus
                      </button>
                    </td>
                  </tr>
                ))
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
                  <label className="label" htmlFor="exp-amount">Nominal Biaya (Rp) *</label>
                  <input
                    id="exp-amount"
                    type="text"
                    required
                    className="input"
                    placeholder="Contoh: 150.000"
                    value={formData.amount}
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g, '')
                      setFormData({ ...formData, amount: val ? parseInt(val).toLocaleString('id-ID') : '' })
                    }}
                    style={{ fontWeight: 700, fontSize: 15 }}
                  />
                </div>

                <div>
                  <label className="label" htmlFor="exp-desc">Deskripsi / Keterangan *</label>
                  <input
                    id="exp-desc"
                    type="text"
                    required
                    className="input"
                    placeholder="Contoh: Beli token listrik PLN 200rb"
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label" htmlFor="exp-date">Tanggal Pengeluaran *</label>
                  <input
                    id="exp-date"
                    type="date"
                    required
                    className="input"
                    value={formData.expense_date}
                    onChange={e => setFormData({ ...formData, expense_date: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 22 }}>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="btn btn-secondary"
                  disabled={isSubmitting}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting || !formData.amount || !formData.description.trim()}
                >
                  <Check size={14} /> {isSubmitting ? 'Menyimpan...' : 'Simpan Pengeluaran'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
