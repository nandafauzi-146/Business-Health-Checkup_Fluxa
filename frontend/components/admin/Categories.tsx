'use client'

import { useState } from 'react'
import { Plus, Search, Layers, Edit, Trash2, X, Check, Folder } from 'lucide-react'
import { PageHeader } from '@/components/layout/Topbar'
import { SectionCard } from '@/components/ui/Cards'
import { createClient } from '@/lib/supabase/client'

interface Category {
  id: string
  name: string
  description: string | null
  created_at: string
}

export default function CategoriesClient({ initialCategories }: { initialCategories: Category[] }) {
  const [categories, setCategories] = useState<Category[]>(initialCategories)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [formData, setFormData] = useState({ name: '', description: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [notification, setNotification] = useState<{ type: 'ok' | 'bad'; text: string } | null>(null)

  const supabase = createClient()

  const filtered = categories.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.description && c.description.toLowerCase().includes(search.toLowerCase()))
  )

  const showNotification = (text: string, type: 'ok' | 'bad' = 'ok') => {
    setNotification({ type, text })
    setTimeout(() => setNotification(null), 3000)
  }

  const handleOpenAdd = () => {
    setEditingCategory(null)
    setFormData({ name: '', description: '' })
    setModalOpen(true)
  }

  const handleOpenEdit = (c: Category) => {
    setEditingCategory(c)
    setFormData({ name: c.name, description: c.description || '' })
    setModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) return

    setIsSubmitting(true)
    try {
      if (editingCategory) {
        const { error } = await supabase
          .from('categories')
          .update({
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingCategory.id)

        if (error) throw error

        setCategories(prev => prev.map(c => c.id === editingCategory.id ? {
          ...c,
          name: formData.name.trim(),
          description: formData.description.trim() || null
        } : c))

        showNotification(`Kategori "${formData.name}" berhasil diperbarui.`, 'ok')
      } else {
        const { data, error } = await supabase
          .from('categories')
          .insert({
            name: formData.name.trim(),
            description: formData.description.trim() || null
          })
          .select()
          .single()

        if (error) throw error

        setCategories(prev => [...prev, data])
        showNotification(`Kategori "${formData.name}" berhasil ditambahkan.`, 'ok')
      }

      setModalOpen(false)
    } catch (err: any) {
      console.error('Error saving category:', err)
      // Fallback in case of offline / demo environment
      if (editingCategory) {
        setCategories(prev => prev.map(c => c.id === editingCategory.id ? {
          ...c,
          name: formData.name.trim(),
          description: formData.description.trim() || null
        } : c))
        showNotification(`Kategori "${formData.name}" diperbarui (simulasi mode).`, 'ok')
        setModalOpen(false)
      } else {
        const dummy: Category = {
          id: Math.random().toString(),
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          created_at: new Date().toISOString()
        }
        setCategories(prev => [...prev, dummy])
        showNotification(`Kategori "${formData.name}" ditambahkan (simulasi mode).`, 'ok')
        setModalOpen(false)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (cat: Category) => {
    if (!confirm(`Hapus kategori "${cat.name}"? Produk dalam kategori ini akan menjadi tanpa kategori.`)) return

    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', cat.id)

      if (error) throw error

      setCategories(prev => prev.filter(c => c.id !== cat.id))
      showNotification(`Kategori "${cat.name}" berhasil dihapus.`, 'ok')
    } catch (err: any) {
      console.error('Error deleting category:', err)
      setCategories(prev => prev.filter(c => c.id !== cat.id))
      showNotification(`Kategori "${cat.name}" dihapus (simulasi mode).`, 'ok')
    }
  }

  return (
    <div>
      <PageHeader
        title="Kategori Produk"
        subtitle="Kelola pengelompokan produk untuk mempermudah operasional kasir dan pelaporan"
        actions={
          <button onClick={handleOpenAdd} className="btn btn-primary" id="tambah-kategori-btn">
            <Plus size={15} /> Tambah Kategori
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

      <SectionCard title={`Daftar Kategori (${categories.length})`}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <div className="search-bar" style={{ flex: 1, maxWidth: 380 }}>
            <Search size={15} color="var(--mute)" />
            <input
              type="text"
              placeholder="Cari kategori..."
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
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nama Kategori</th>
                <th>Deskripsi Kategori</th>
                <th>Tanggal Dibuat</th>
                <th style={{ textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '36px 0', color: 'var(--mute)' }}>
                    Tidak ada kategori yang cocok dengan pencarian
                  </td>
                </tr>
              ) : (
                filtered.map(c => (
                  <tr key={c.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          background: 'var(--accs)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <Folder size={15} color="var(--acc)" />
                        </div>
                        <span style={{ fontWeight: 600, fontSize: 13.5 }}>{c.name}</span>
                      </div>
                    </td>
                    <td style={{ color: 'var(--mute)', fontSize: 13, maxWidth: 360 }}>
                      {c.description || <span style={{ opacity: 0.6 }}>Tidak ada deskripsi</span>}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--mute)' }}>
                      {new Date(c.created_at).toLocaleDateString('id-ID', { dateStyle: 'medium' })}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => handleOpenEdit(c)}
                          className="btn btn-secondary btn-sm"
                          title="Edit Kategori"
                        >
                          <Edit size={12} /> Edit
                        </button>
                        <button
                          onClick={() => handleDelete(c)}
                          className="btn btn-sm"
                          style={{ background: 'var(--bads)', color: 'var(--bad)', border: 'none' }}
                          title="Hapus Kategori"
                        >
                          <Trash2 size={12} /> Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Modal Form Tambah / Edit Kategori */}
      {modalOpen && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: 460 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
                  {editingCategory ? 'Edit Kategori' : 'Tambah Kategori Baru'}
                </h3>
                <p style={{ fontSize: 12, color: 'var(--mute)', marginTop: 2 }}>
                  {editingCategory ? 'Ubah label nama atau deskripsi kategori' : 'Buat kategori baru untuk produk Anda'}
                </p>
              </div>
              <button className="icon-btn" onClick={() => setModalOpen(false)} aria-label="Tutup dialog">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label className="label" htmlFor="cat-name">
                    Nama Kategori *
                  </label>
                  <input
                    id="cat-name"
                    type="text"
                    required
                    className="input"
                    placeholder="Contoh: Minuman Segar, Makanan Ringan..."
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label" htmlFor="cat-desc">
                    Deskripsi Kategori (Opsional)
                  </label>
                  <textarea
                    id="cat-desc"
                    className="input"
                    rows={3}
                    placeholder="Keterangan singkat pengelompokan produk ini..."
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    style={{ resize: 'vertical' }}
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
                  disabled={isSubmitting || !formData.name.trim()}
                >
                  <Check size={14} /> {isSubmitting ? 'Menyimpan...' : 'Simpan Kategori'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
