'use client'

import { useEffect, useState } from 'react'
import {
  Plus, Search, Edit, Trash2, X, Check, Folder, ArrowUpRight, ArrowDownLeft, Layers
} from 'lucide-react'
import { PageHeader } from '@/components/layout/Topbar'
import { SectionCard } from '@/components/ui/Cards'
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog'

type CategoryType = 'payable' | 'receivable' | 'both'

interface DebtCategory {
  id: string
  name: string
  description: string | null
  type: CategoryType
  created_at: string
}

const STORAGE_KEY = 'fluxa:debt-categories:v1'

const DEFAULT_SEED: Omit<DebtCategory, 'created_at'>[] = [
  { id: 'dc-1', name: 'Supplier / Bahan Baku', description: 'Pembelian bahan baku dan barang dagangan dari supplier', type: 'payable' },
  { id: 'dc-2', name: 'Operasional & Sewa Ruko', description: 'Sewa tempat usaha dan biaya operasional rutin', type: 'payable' },
  { id: 'dc-3', name: 'Utilitas & Listrik Toko', description: 'Tagihan listrik, air, dan utilitas toko', type: 'payable' },
  { id: 'dc-4', name: 'Peralatan & Fasilitas', description: 'Pembelian peralatan dan perlengkapan toko', type: 'payable' },
  { id: 'dc-5', name: 'Pinjaman Modal Usaha', description: 'Pinjaman modal usaha dari pihak ketiga', type: 'payable' },
  { id: 'dc-6', name: 'Konsinyasi & Kemitraan Toko', description: 'Titip jual dan kemitraan dengan mitra usaha', type: 'receivable' },
  { id: 'dc-7', name: 'Lain-lain', description: 'Transaksi hutang atau piutang di luar kategori lain', type: 'both' },
]

const DEFAULT_CATEGORIES: DebtCategory[] = DEFAULT_SEED.map(c => ({
  ...c,
  created_at: new Date().toISOString()
}))

const TYPE_META: Record<CategoryType, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  payable: { label: 'Hutang', color: 'var(--bad)', bg: 'var(--bads)', icon: <ArrowUpRight size={13} /> },
  receivable: { label: 'Piutang', color: 'var(--ok)', bg: 'var(--oks)', icon: <ArrowDownLeft size={13} /> },
  both: { label: 'Hutang & Piutang', color: 'var(--acc)', bg: 'var(--accs)', icon: <Layers size={13} /> },
}

export default function DebtCategoriesClient() {
  const [categories, setCategories] = useState<DebtCategory[]>([])
  const [loaded, setLoaded] = useState(false)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<DebtCategory | null>(null)
  const [formData, setFormData] = useState<{ name: string; description: string; type: CategoryType }>({
    name: '',
    description: '',
    type: 'payable'
  })
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; category: DebtCategory | null }>({
    isOpen: false,
    category: null
  })
  const [notification, setNotification] = useState<{ type: 'ok' | 'bad'; text: string } | null>(null)

  // Muat dari penyimpanan lokal, atau pakai daftar bawaan.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      const parsed = raw ? JSON.parse(raw) as DebtCategory[] : null
      setCategories(parsed && parsed.length > 0 ? parsed : DEFAULT_CATEGORIES)
    } catch {
      setCategories(DEFAULT_CATEGORIES)
    }
    setLoaded(true)
  }, [])

  // Simpan setiap perubahan.
  useEffect(() => {
    if (!loaded) return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(categories))
    } catch {
      // abaikan jika penyimpanan tidak tersedia
    }
  }, [categories, loaded])

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
    setFormData({ name: '', description: '', type: 'payable' })
    setModalOpen(true)
  }

  const handleOpenEdit = (c: DebtCategory) => {
    setEditingCategory(c)
    setFormData({ name: c.name, description: c.description || '', type: c.type })
    setModalOpen(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const name = formData.name.trim()
    if (!name) return

    const description = formData.description.trim() || null

    if (editingCategory) {
      setCategories(prev => prev.map(c => c.id === editingCategory.id ? { ...c, name, description, type: formData.type } : c))
      showNotification(`Kategori "${name}" berhasil diperbarui.`, 'ok')
    } else {
      setCategories(prev => [...prev, {
        id: `dc-${Date.now()}`,
        name,
        description,
        type: formData.type,
        created_at: new Date().toISOString()
      }])
      showNotification(`Kategori "${name}" berhasil ditambahkan.`, 'ok')
    }

    setModalOpen(false)
  }

  const handleDelete = (cat: DebtCategory) => {
    setDeleteConfirm({ isOpen: true, category: cat })
  }

  const confirmDelete = () => {
    const cat = deleteConfirm.category
    if (!cat) return
    setCategories(prev => prev.filter(c => c.id !== cat.id))
    showNotification(`Kategori "${cat.name}" berhasil dihapus.`, 'ok')
    setDeleteConfirm({ isOpen: false, category: null })
  }

  return (
    <div>
      <PageHeader
        title="Kelola Kategori Hutang & Piutang"
        subtitle="Atur kategori peruntukan untuk transaksi hutang toko dan piutang usaha pada menu Hutang & Piutang"
        actions={
          <button onClick={handleOpenAdd} className="btn btn-primary" id="tambah-kategori-hutang-btn">
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
        <div className="toolbar-row">
          <div className="search-bar" style={{ flex: 1, maxWidth: 380 }}>
            <Search size={15} color="var(--mute)" />
            <input
              type="text"
              placeholder="Cari kategori hutang / piutang..."
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
                <th>Jenis</th>
                <th>Deskripsi Kategori</th>
                <th style={{ textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {!loaded ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '36px 0', color: 'var(--mute)' }}>
                    Memuat kategori...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '36px 0', color: 'var(--mute)' }}>
                    Tidak ada kategori yang cocok dengan pencarian
                  </td>
                </tr>
              ) : (
                filtered.map(c => {
                  const meta = TYPE_META[c.type] ?? TYPE_META.both
                  return (
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
                      <td>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '3px 9px',
                          borderRadius: 20,
                          fontSize: 11,
                          fontWeight: 700,
                          background: meta.bg,
                          color: meta.color,
                          whiteSpace: 'nowrap'
                        }}>
                          {meta.icon}{meta.label}
                        </span>
                      </td>
                      <td style={{ color: 'var(--mute)', fontSize: 13, maxWidth: 360 }}>
                        {c.description || <span style={{ opacity: 0.6 }}>Tidak ada deskripsi</span>}
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
                  )
                })
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
                  {editingCategory ? 'Ubah label, jenis, atau deskripsi kategori' : 'Buat kategori baru untuk transaksi hutang & piutang'}
                </p>
              </div>
              <button className="icon-btn" onClick={() => setModalOpen(false)} aria-label="Tutup dialog">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label className="label" htmlFor="debt-cat-name">
                    Nama Kategori *
                  </label>
                  <input
                    id="debt-cat-name"
                    type="text"
                    required
                    className="input"
                    placeholder="Contoh: Supplier / Bahan Baku, Konsinyasi Mitra..."
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label">Jenis Transaksi *</label>
                  <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                    {([
                      { value: 'payable', label: 'Hutang', icon: <ArrowUpRight size={15} />, color: 'var(--bad)', bg: 'var(--bads)' },
                      { value: 'receivable', label: 'Piutang', icon: <ArrowDownLeft size={15} />, color: 'var(--ok)', bg: 'var(--oks)' },
                    ] as const).map(opt => {
                      const isActive = formData.type === opt.value
                      return (
                        <label
                          key={opt.value}
                          htmlFor={`debt-type-${opt.value}`}
                          style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 6,
                            padding: '12px 8px',
                            borderRadius: 10,
                            border: `2px solid ${isActive ? opt.color : 'var(--line)'}`,
                            background: isActive ? opt.bg : 'var(--surface)',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            userSelect: 'none',
                          }}
                        >
                          <input
                            type="radio"
                            id={`debt-type-${opt.value}`}
                            name="debt-cat-type"
                            value={opt.value}
                            checked={isActive}
                            onChange={() => setFormData({ ...formData, type: opt.value })}
                            style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
                          />
                          <span style={{ color: isActive ? opt.color : 'var(--mute)' }}>{opt.icon}</span>
                          <span style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: isActive ? opt.color : 'var(--mute)',
                            whiteSpace: 'nowrap'
                          }}>
                            {opt.label}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <label className="label" htmlFor="debt-cat-desc">
                    Deskripsi Kategori (Opsional)
                  </label>
                  <textarea
                    id="debt-cat-desc"
                    className="input"
                    rows={3}
                    placeholder="Keterangan singkat penggunaan kategori ini..."
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
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!formData.name.trim()}
                >
                  <Check size={14} /> Simpan Kategori
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmationDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, category: null })}
        onConfirm={confirmDelete}
        title="Konfirmasi Hapus Kategori"
        message={`Apakah Anda yakin ingin menghapus kategori "${deleteConfirm.category?.name}"? Tindakan ini tidak dapat dibatalkan.`}
        confirmLabel="Hapus"
        cancelLabel="Batal"
        variant="danger"
        icon="delete"
      />
    </div>
  )
}
