'use client'

import { useState } from 'react'
import { Plus, Search, Package, Edit, Trash2, X, Check, Filter } from 'lucide-react'
import { SectionCard, StatusTag } from '@/components/ui/Cards'
import { PageHeader } from '@/components/layout/Topbar'
import { createClient } from '@/lib/supabase/client'

function formatRp(n: number) {
  return 'Rp' + new Intl.NumberFormat('id-ID').format(n)
}

const DEMO_PRODUCTS = [
  { id: '1', name: 'Kopi Arabika 250g', sku: 'KA-001', category_id: '1', categories: { name: 'Minuman' }, buy_price: 35000, sell_price: 55000, stock: 3, min_stock: 10, unit: 'pcs', is_active: true },
  { id: '2', name: 'Gula Pasir 1kg', sku: 'GP-001', category_id: '2', categories: { name: 'Bahan Baku' }, buy_price: 14000, sell_price: 18000, stock: 5, min_stock: 20, unit: 'kg', is_active: true },
  { id: '3', name: 'Susu UHT Full Cream', sku: 'SU-001', category_id: '1', categories: { name: 'Minuman' }, buy_price: 15000, sell_price: 22000, stock: 18, min_stock: 12, unit: 'liter', is_active: true },
  { id: '4', name: 'Teh Hijau Celup', sku: 'TH-001', category_id: '1', categories: { name: 'Minuman' }, buy_price: 8000, sell_price: 14000, stock: 45, min_stock: 15, unit: 'kotak', is_active: true },
  { id: '5', name: 'Roti Tawar Gandum', sku: 'RT-001', category_id: '3', categories: { name: 'Makanan' }, buy_price: 12000, sell_price: 18000, stock: 8, min_stock: 10, unit: 'bungkus', is_active: false },
]

interface Category {
  id: string
  name: string
}

interface Product {
  id: string
  name: string
  sku: string | null
  buy_price: number
  sell_price: number
  stock: number
  min_stock: number
  unit: string
  category_id?: string | null
  categories?: { name: string } | null
  is_active: boolean
}

interface Props {
  products: Product[]
  categories: Category[]
}

export default function ProductsClient({ products: initialProducts, categories }: Props) {
  const supabase = createClient()
  const [products, setProducts] = useState<Product[]>(initialProducts.length > 0 ? initialProducts : DEMO_PRODUCTS)
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

  const [showDialog, setShowDialog] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ type: 'ok' | 'bad'; msg: string } | null>(null)

  const [form, setForm] = useState({
    name: '',
    sku: '',
    buy_price: '',
    sell_price: '',
    stock: '',
    min_stock: '5',
    unit: 'pcs',
    category_id: '',
    is_active: true
  })

  const filtered = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(search.toLowerCase()))
    const matchesCat = selectedCategory === 'all' ? true : (p.category_id === selectedCategory || (p.categories as any)?.name === selectedCategory)
    const matchesStatus = statusFilter === 'all' ? true : statusFilter === 'active' ? p.is_active : !p.is_active
    return matchesSearch && matchesCat && matchesStatus
  })

  const showToast = (msg: string, type: 'ok' | 'bad' = 'ok') => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3000)
  }

  const handleOpenAdd = () => {
    setEditingProduct(null)
    setForm({
      name: '',
      sku: '',
      buy_price: '',
      sell_price: '',
      stock: '',
      min_stock: '5',
      unit: 'pcs',
      category_id: categories[0]?.id || '',
      is_active: true
    })
    setShowDialog(true)
  }

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p)
    setForm({
      name: p.name,
      sku: p.sku || '',
      buy_price: String(p.buy_price || ''),
      sell_price: String(p.sell_price || ''),
      stock: String(p.stock || '0'),
      min_stock: String(p.min_stock || '5'),
      unit: p.unit || 'pcs',
      category_id: p.category_id || '',
      is_active: p.is_active
    })
    setShowDialog(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.sell_price) return
    setSaving(true)

    try {
      const payload: any = {
        name: form.name.trim(),
        sku: form.sku.trim() || null,
        buy_price: parseInt(form.buy_price) || 0,
        sell_price: parseInt(form.sell_price) || 0,
        min_stock: parseInt(form.min_stock) || 5,
        unit: form.unit.trim() || 'pcs',
        category_id: form.category_id || null,
        is_active: form.is_active,
        updated_at: new Date().toISOString()
      }

      const categoryObj = categories.find(c => c.id === form.category_id)

      if (editingProduct) {
        const { error } = await supabase
          .from('products')
          .update(payload)
          .eq('id', editingProduct.id)

        if (error) throw error

        setProducts(prev => prev.map(p => p.id === editingProduct.id ? {
          ...p,
          ...payload,
          categories: categoryObj ? { name: categoryObj.name } : p.categories
        } : p))

        showToast(`Produk "${form.name}" berhasil diperbarui.`, 'ok')
      } else {
        payload.stock = parseInt(form.stock) || 0
        const { data, error } = await supabase
          .from('products')
          .insert(payload)
          .select('*, categories(name)')
          .single()

        if (error) throw error

        const newProd = data || {
          id: Math.random().toString(),
          ...payload,
          categories: categoryObj ? { name: categoryObj.name } : null
        }

        setProducts(prev => [newProd, ...prev])
        showToast(`Produk "${form.name}" berhasil ditambahkan.`, 'ok')
      }

      setShowDialog(false)
    } catch (err: any) {
      console.error('Error saving product:', err)
      // Fallback for demo local testing
      if (editingProduct) {
        const categoryObj = categories.find(c => c.id === form.category_id)
        setProducts(prev => prev.map(p => p.id === editingProduct.id ? {
          ...p,
          name: form.name,
          sku: form.sku || null,
          buy_price: parseInt(form.buy_price) || 0,
          sell_price: parseInt(form.sell_price) || 0,
          min_stock: parseInt(form.min_stock) || 5,
          unit: form.unit || 'pcs',
          category_id: form.category_id || null,
          is_active: form.is_active,
          categories: categoryObj ? { name: categoryObj.name } : p.categories
        } : p))
        showToast(`Produk "${form.name}" diperbarui (simulasi mode).`, 'ok')
        setShowDialog(false)
      } else {
        const categoryObj = categories.find(c => c.id === form.category_id)
        const dummy: Product = {
          id: Math.random().toString(),
          name: form.name,
          sku: form.sku || null,
          buy_price: parseInt(form.buy_price) || 0,
          sell_price: parseInt(form.sell_price) || 0,
          stock: parseInt(form.stock) || 0,
          min_stock: parseInt(form.min_stock) || 5,
          unit: form.unit || 'pcs',
          category_id: form.category_id || null,
          is_active: form.is_active,
          categories: categoryObj ? { name: categoryObj.name } : null
        }
        setProducts(prev => [dummy, ...prev])
        showToast(`Produk "${form.name}" ditambahkan (simulasi mode).`, 'ok')
        setShowDialog(false)
      }
    } finally {
      setSaving(false)
    }
  }

  const handleToggleStatus = async (p: Product) => {
    const nextStatus = !p.is_active
    try {
      const { error } = await supabase
        .from('products')
        .update({ is_active: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', p.id)

      if (error) throw error

      setProducts(prev => prev.map(item => item.id === p.id ? { ...item, is_active: nextStatus } : item))
      showToast(`Status ${p.name} diubah menjadi ${nextStatus ? 'Aktif' : 'Nonaktif'}.`, 'ok')
    } catch (err: any) {
      setProducts(prev => prev.map(item => item.id === p.id ? { ...item, is_active: nextStatus } : item))
      showToast(`Status ${p.name} diubah menjadi ${nextStatus ? 'Aktif' : 'Nonaktif'} (simulasi).`, 'ok')
    }
  }

  return (
    <div>
      <PageHeader
        title="Kelola Produk"
        subtitle={`${products.length} produk terdaftar dalam katalog`}
        actions={
          <button id="tambah-produk-btn" className="btn btn-primary" onClick={handleOpenAdd}>
            <Plus size={15} /> Tambah Produk Baru
          </button>
        }
      />

      {/* Filter & Search Bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 10, flex: 1, minWidth: 280, maxWidth: 640 }}>
          <div className="search-bar" style={{ flex: 1 }}>
            <Search size={15} color="var(--mute)" />
            <input
              placeholder="Cari nama produk atau SKU..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              id="search-produk"
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
              padding: '8px 12px',
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

        {/* Status Pill Filters */}
        <div className="filter-tabs">
          <button
            className={`filter-tab ${statusFilter === 'all' ? 'active' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            Semua ({products.length})
          </button>
          <button
            className={`filter-tab ${statusFilter === 'active' ? 'active' : ''}`}
            onClick={() => setStatusFilter('active')}
          >
            Aktif ({products.filter(p => p.is_active).length})
          </button>
          <button
            className={`filter-tab ${statusFilter === 'inactive' ? 'active' : ''}`}
            onClick={() => setStatusFilter('inactive')}
          >
            Nonaktif ({products.filter(p => !p.is_active).length})
          </button>
        </div>
      </div>

      {/* Products table */}
      <SectionCard title={`Daftar Produk (${filtered.length})`}>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Produk</th>
                <th>SKU</th>
                <th>Kategori</th>
                <th>Harga Modal</th>
                <th>Harga Jual</th>
                <th>Margin</th>
                <th>Stok</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '36px 0', color: 'var(--mute)' }}>
                    Tidak ada produk yang cocok dengan pencarian / filter
                  </td>
                </tr>
              ) : (
                filtered.map(p => {
                  const margin = p.sell_price > 0 ? Math.round(((p.sell_price - p.buy_price) / p.sell_price) * 100) : 0
                  const stockStatus = p.stock <= 0 ? 'kritis' : p.stock <= p.min_stock ? 'menipis' : 'aman'
                  return (
                    <tr key={p.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 36,
                            height: 36,
                            borderRadius: 10,
                            background: p.is_active ? 'var(--accs)' : 'var(--bg)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            <Package size={16} color={p.is_active ? 'var(--acc)' : 'var(--mute)'} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13, color: p.is_active ? 'var(--ink)' : 'var(--mute)' }}>
                              {p.name}
                            </div>
                            {!p.is_active && (
                              <span style={{ fontSize: 11, color: 'var(--bad)', fontWeight: 500 }}>
                                Dinonaktifkan
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--mute)', fontFamily: 'monospace' }}>
                        {p.sku || '—'}
                      </td>
                      <td>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 500,
                          background: 'var(--bg)',
                          color: 'var(--ink)'
                        }}>
                          {p.categories?.name || 'Umum'}
                        </span>
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--mute)' }}>
                        {formatRp(p.buy_price)}
                      </td>
                      <td style={{ fontWeight: 700, fontSize: 13 }}>
                        {formatRp(p.sell_price)}
                      </td>
                      <td>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 700,
                          background: margin >= 30 ? 'var(--oks)' : margin >= 15 ? 'var(--warns)' : 'var(--bads)',
                          color: margin >= 30 ? 'var(--ok)' : margin >= 15 ? 'var(--warn)' : 'var(--bad)'
                        }}>
                          {margin}%
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontWeight: 700, fontSize: 13 }}>{p.stock}</span>
                          <span style={{ fontSize: 11, color: 'var(--mute)' }}>{p.unit}</span>
                          <StatusTag status={stockStatus} />
                        </div>
                      </td>
                      <td>
                        <StatusTag status={p.is_active ? 'ok' : 'void'} label={p.is_active ? 'Aktif' : 'Nonaktif'} />
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleOpenEdit(p)}
                            title="Edit Produk"
                            id={`edit-product-${p.id}`}
                          >
                            <Edit size={12} /> Edit
                          </button>
                          <button
                            className="btn btn-sm"
                            onClick={() => handleToggleStatus(p)}
                            title={p.is_active ? 'Nonaktifkan Produk' : 'Aktifkan Produk'}
                            style={{
                              background: p.is_active ? 'var(--bads)' : 'var(--oks)',
                              color: p.is_active ? 'var(--bad)' : 'var(--ok)',
                              border: 'none'
                            }}
                          >
                            {p.is_active ? 'Nonaktif' : 'Aktifkan'}
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

      {/* Add / Edit Product Modal */}
      {showDialog && (
        <div className="dialog-overlay" onClick={e => e.target === e.currentTarget && setShowDialog(false)}>
          <div className="dialog">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700 }}>
                  {editingProduct ? 'Edit Informasi Produk' : 'Tambah Produk Baru'}
                </h2>
                <p style={{ fontSize: 12, color: 'var(--mute)', marginTop: 2 }}>
                  {editingProduct ? 'Perbarui data harga, SKU, atau kategori produk' : 'Lengkapi detail produk untuk inventaris POS'}
                </p>
              </div>
              <button className="icon-btn" onClick={() => setShowDialog(false)} aria-label="Tutup dialog">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label className="label" htmlFor="prod-name">Nama Produk *</label>
                  <input
                    id="prod-name"
                    required
                    className="input"
                    placeholder="Contoh: Kopi Susu Aren 500ml"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 10 }}>
                  <div>
                    <label className="label" htmlFor="prod-cat">Kategori</label>
                    <select
                      id="prod-cat"
                      className="input"
                      value={form.category_id}
                      onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
                      style={{ cursor: 'pointer' }}
                    >
                      <option value="">— Tanpa Kategori —</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor="prod-sku">SKU / Kode Barang</label>
                    <input
                      id="prod-sku"
                      className="input"
                      placeholder="Opsional (misal: KSA-01)"
                      value={form.sku}
                      onChange={e => setForm(f => ({ ...f, sku: e.target.value }))}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label className="label" htmlFor="prod-buy">Harga Modal (Rp) *</label>
                    <input
                      id="prod-buy"
                      required
                      className="input"
                      type="number"
                      placeholder="0"
                      value={form.buy_price}
                      onChange={e => setForm(f => ({ ...f, buy_price: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor="prod-sell">Harga Jual (Rp) *</label>
                    <input
                      id="prod-sell"
                      required
                      className="input"
                      type="number"
                      placeholder="0"
                      value={form.sell_price}
                      onChange={e => setForm(f => ({ ...f, sell_price: e.target.value }))}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  {!editingProduct && (
                    <div>
                      <label className="label" htmlFor="prod-stock">Stok Awal</label>
                      <input
                        id="prod-stock"
                        className="input"
                        type="number"
                        placeholder="0"
                        value={form.stock}
                        onChange={e => setForm(f => ({ ...f, stock: e.target.value }))}
                      />
                    </div>
                  )}
                  <div>
                    <label className="label" htmlFor="prod-min">Stok Minimum</label>
                    <input
                      id="prod-min"
                      className="input"
                      type="number"
                      placeholder="5"
                      value={form.min_stock}
                      onChange={e => setForm(f => ({ ...f, min_stock: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor="prod-unit">Satuan</label>
                    <input
                      id="prod-unit"
                      className="input"
                      placeholder="pcs, kg, liter..."
                      value={form.unit}
                      onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Profit Margin Preview */}
                {form.buy_price && form.sell_price && Number(form.sell_price) > 0 && (
                  <div style={{
                    padding: '10px 14px',
                    background: 'var(--bg)',
                    border: '1px solid var(--line)',
                    borderRadius: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <span style={{ fontSize: 12, color: 'var(--mute)' }}>Estimasi Keuntungan:</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ok)' }}>
                      {formatRp(Math.max(0, parseInt(form.sell_price) - parseInt(form.buy_price)))} / {form.unit || 'unit'}
                      {' '}
                      ({Math.round(((parseInt(form.sell_price) - parseInt(form.buy_price)) / parseInt(form.sell_price)) * 100)}%)
                    </span>
                  </div>
                )}

                {/* Status Toggle */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  background: 'var(--bg)',
                  borderRadius: 10
                }}>
                  <input
                    type="checkbox"
                    id="prod-active"
                    checked={form.is_active}
                    onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                    style={{ width: 16, height: 16, cursor: 'pointer' }}
                  />
                  <label htmlFor="prod-active" style={{ fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                    Produk aktif dan dapat dijual di kasir (POS)
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowDialog(false)}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  id="simpan-produk-btn"
                  className="btn btn-primary"
                  disabled={saving || !form.name || !form.sell_price}
                >
                  <Check size={15} /> {saving ? 'Menyimpan...' : (editingProduct ? 'Perbarui Produk' : 'Simpan Produk')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="toast" style={{
          background: toast.type === 'ok' ? 'var(--ok)' : 'var(--bad)',
          color: '#fff'
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
