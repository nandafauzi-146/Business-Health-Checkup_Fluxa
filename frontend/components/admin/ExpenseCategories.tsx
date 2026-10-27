'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2, X, Tag, Search } from 'lucide-react'
import { SectionCard } from '@/components/ui/Cards'
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog'
import { getUserFacingError } from '@/lib/user-facing-error'

export interface ExpenseCategory {
  id: string
  name: string
  description?: string | null
  created_at?: string
  expense_count?: number
}

export default function ExpenseCategoriesClient({
  initialCategories,
}: {
  initialCategories: ExpenseCategory[]
}) {
  const [categories, setCategories] = useState<ExpenseCategory[]>(initialCategories)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<ExpenseCategory | null>(null)
  const [form, setForm] = useState({ name: '', description: '' })
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; cat: ExpenseCategory | null }>({
    isOpen: false, cat: null
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [notification, setNotification] = useState<{ type: 'ok' | 'bad'; text: string } | null>(null)

  const showNotification = (text: string, type: 'ok' | 'bad' = 'ok') => {
    setNotification({ type, text })
    setTimeout(() => setNotification(null), 3500)
  }

  const filtered = categories.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.description || '').toLowerCase().includes(search.toLowerCase())
  )

  const handleOpenAdd = () => {
    setEditTarget(null)
    setForm({ name: '', description: '' })
    setModalOpen(true)
  }

  const handleOpenEdit = (cat: ExpenseCategory) => {
    setEditTarget(cat)
    setForm({ name: cat.name, description: cat.description || '' })
    setModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setIsSubmitting(true)
    try {
      const isEdit = Boolean(editTarget)
      const res = await fetch('/api/admin/expense-categories', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editTarget?.id,
          name: form.name.trim(),
          description: form.description.trim() || null,
        })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Gagal menyimpan kategori.')

      if (isEdit) {
        setCategories(prev => prev.map(c => c.id === editTarget!.id ? { ...c, ...json.category } : c))
        showNotification(`Kategori "${json.category.name}" berhasil diperbarui.`, 'ok')
      } else {
        setCategories(prev => [...prev, json.category].sort((a, b) => a.name.localeCompare(b.name)))
        showNotification(`Kategori "${json.category.name}" berhasil ditambahkan.`, 'ok')
      }
      setModalOpen(false)
    } catch (err: unknown) {
      showNotification(getUserFacingError(err, 'Gagal menyimpan kategori.'), 'bad')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = (cat: ExpenseCategory) => {
    setDeleteConfirm({ isOpen: true, cat })
  }

  const confirmDelete = async () => {
    const cat = deleteConfirm.cat
    if (!cat) return
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/admin/expense-categories', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: cat.id })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Gagal menghapus kategori.')
      setCategories(prev => prev.filter(c => c.id !== cat.id))
      showNotification(`Kategori "${cat.name}" berhasil dihapus.`, 'ok')
    } catch (err: unknown) {
      showNotification(getUserFacingError(err, 'Gagal menghapus kategori.'), 'bad')
    } finally {
      setIsSubmitting(false)
      setDeleteConfirm({ isOpen: false, cat: null })
    }
  }

  return (
    <div>
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

      <SectionCard title={`Kategori Biaya Operasional (${categories.length})`}>
        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="search-bar" style={{ flex: 1, minWidth: 'min(220px, 100%)' }}>
            <Search size={15} color="var(--mute)" />
            <input
              type="text"
              placeholder="Cari nama atau deskripsi kategori..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mute)' }}>✕</button>
            )}
          </div>
          <button onClick={handleOpenAdd} className="btn btn-primary" id="tambah-kategori-btn">
            <Plus size={14} /> Tambah Kategori
          </button>
        </div>

        {/* Grid kategori */}
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--mute)' }}>
            <Tag size={36} style={{ marginBottom: 12, opacity: 0.35 }} />
            <p style={{ fontWeight: 600, marginBottom: 4 }}>Belum ada kategori</p>
            <p style={{ fontSize: 13 }}>Tambahkan kategori biaya operasional untuk mempermudah pengelompokan pengeluaran.</p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 12
          }}>
            {filtered.map(cat => (
              <div
                key={cat.id}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--line)',
                  borderRadius: 12,
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 10
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 8,
                      background: 'var(--accs)', color: 'var(--acc)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <Tag size={13} />
                    </div>
                    <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {cat.name}
                    </span>
                  </div>
                  {cat.description && (
                    <p style={{ fontSize: 12, color: 'var(--mute)', margin: 0, lineHeight: 1.4, paddingLeft: 35 }}>
                      {cat.description}
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button
                    onClick={() => handleOpenEdit(cat)}
                    className="btn btn-sm"
                    style={{ background: 'var(--accs)', color: 'var(--acc)', border: 'none' }}
                    title="Edit Kategori"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    onClick={() => handleDelete(cat)}
                    className="btn btn-sm"
                    style={{ background: 'var(--bads)', color: 'var(--bad)', border: 'none' }}
                    title="Hapus Kategori"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Modal Tambah / Edit Kategori */}
      {modalOpen && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: 420 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
                  {editTarget ? 'Edit Kategori' : 'Tambah Kategori Baru'}
                </h3>
                <p style={{ fontSize: 12, color: 'var(--mute)', marginTop: 2 }}>
                  {editTarget ? 'Perbarui nama dan deskripsi kategori biaya' : 'Buat kategori untuk mengelompokkan jenis pengeluaran'}
                </p>
              </div>
              <button className="icon-btn" onClick={() => setModalOpen(false)} aria-label="Tutup dialog">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label className="label" htmlFor="cat-name">Nama Kategori *</label>
                  <input
                    id="cat-name"
                    className="input"
                    type="text"
                    placeholder="Contoh: Utilitas, Peralatan Toko, Transportasi..."
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    autoFocus
                    required
                  />
                </div>
                <div>
                  <label className="label" htmlFor="cat-desc">Deskripsi (Opsional)</label>
                  <textarea
                    id="cat-desc"
                    className="input"
                    rows={2}
                    placeholder="Keterangan tambahan tentang kategori ini..."
                    value={form.description}
                    onChange={e => setForm({ ...form, description: e.target.value })}
                    style={{ resize: 'none' }}
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
                  disabled={isSubmitting || !form.name.trim()}
                  id="simpan-kategori-btn"
                >
                  {isSubmitting ? 'Menyimpan...' : editTarget ? 'Simpan Perubahan' : 'Tambah Kategori'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmationDialog
        isOpen={deleteConfirm.isOpen}
        title="Hapus Kategori"
        message={`Hapus kategori "${deleteConfirm.cat?.name}"? Kategori yang masih digunakan oleh catatan biaya tidak bisa dihapus.`}
        confirmLabel="Ya, Hapus"
        variant="danger"
        icon="delete"
        onConfirm={confirmDelete}
        onClose={() => setDeleteConfirm({ isOpen: false, cat: null })}
      />
    </div>
  )
}
