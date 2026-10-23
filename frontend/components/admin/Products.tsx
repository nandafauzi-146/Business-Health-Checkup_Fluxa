'use client'

import { useState, useRef } from 'react'
import { Plus, Search, Package, Edit, Trash2, X, Check, Filter, Camera, Image as ImageIcon, Upload, Link as LinkIcon } from 'lucide-react'
import { SectionCard, StatusTag } from '@/components/ui/Cards'
import { PageHeader } from '@/components/layout/Topbar'
import { createClient } from '@/lib/supabase/client'
import { getUserFacingError } from '@/lib/user-facing-error'

function formatRp(n: number) {
  return 'Rp' + new Intl.NumberFormat('id-ID').format(n)
}

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
  image_url?: string | null
}

interface Props {
  products: Product[]
  categories: Category[]
  loadError?: string | null
}

function getProductSaveError(error: unknown): { message: string; details: Record<string, unknown> } {
  if (!error || typeof error !== 'object') {
    return {
      message: getUserFacingError(error, 'Produk belum dapat disimpan. Periksa kembali data dan coba lagi.'),
      details: {},
    }
  }

  const read = (key: string): unknown => {
    return Reflect.get(error, key)
  }
  const details = Object.fromEntries(
    ['name', 'message', 'code', 'details', 'hint', 'status', 'statusCode']
      .flatMap(key => {
        const value = read(key)
        return typeof value === 'string' || typeof value === 'number' ? [[key, value]] : []
      }),
  )
  const errorMessage = read('message')
  if (read('code') === 'PGRST204' && typeof errorMessage === 'string' && errorMessage.includes('image_url')) {
    return {
      message: 'Foto produk belum dapat disimpan saat ini. Silakan coba lagi atau hubungi Admin.',
      details,
    }
  }

  return {
    message: getUserFacingError(error, 'Produk belum dapat disimpan. Periksa kembali data dan coba lagi.'),
    details,
  }
}

function isMissingImageUrlColumn(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const code = Reflect.get(error, 'code')
  const message = Reflect.get(error, 'message')
  return code === 'PGRST204' &&
    typeof message === 'string' &&
    message.includes('image_url')
}

function notifyProductsUpdated() {
  window.dispatchEvent(new Event('fluxa_products_updated'))
  try {
    localStorage.setItem('fluxa_products_updated', String(Date.now()))
  } catch (err) {
    console.error('Could not broadcast product update:', err)
  }
}

export default function ProductsClient({ products: initialProducts, categories, loadError }: Props) {
  const supabase = createClient()
  const [products, setProducts] = useState<Product[]>(initialProducts)
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

  const [showDialog, setShowDialog] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ type: 'ok' | 'bad'; msg: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    name: '',
    sku: '',
    buy_price: '',
    sell_price: '',
    stock: '',
    min_stock: '5',
    unit: 'pcs',
    category_id: '',
    image_url: '',
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
      image_url: '',
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
      image_url: p.image_url || '',
      is_active: p.is_active
    })
    setShowDialog(true)
  }

  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      showToast('Format file harus berupa gambar (JPG, PNG, WebP)', 'bad')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const maxDim = 400
        let width = img.width
        let height = img.height

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width)
            width = maxDim
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height)
            height = maxDim
          }
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height)
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82)
          setForm(f => ({ ...f, image_url: compressedDataUrl }))
          showToast('Foto produk berhasil dipilih!', 'ok')
        } else {
          setForm(f => ({ ...f, image_url: event.target?.result as string }))
          showToast('Foto produk berhasil dipilih!', 'ok')
        }
      }
      img.src = event.target?.result as string
    }
    reader.readAsDataURL(file)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const sellPrice = Number(form.sell_price)
    const buyPrice = form.buy_price ? Number(form.buy_price) : 0
    const stock = form.stock ? Number(form.stock) : 0
    const minStock = form.min_stock ? Number(form.min_stock) : 5
    if (!form.name.trim() || !form.sell_price || !Number.isInteger(sellPrice) || sellPrice <= 0) {
      showToast('Nama produk dan harga jual berupa angka bulat lebih besar dari 0 wajib diisi.', 'bad')
      return
    }
    if (![buyPrice, stock, minStock].every(value => Number.isInteger(value) && value >= 0)) {
      showToast('Harga modal, stok, dan batas stok harus berupa angka bulat nol atau lebih.', 'bad')
      return
    }
    setSaving(true)

    try {
      let imageWasOmitted = false
      const payload = {
        name: form.name.trim(),
        sku: form.sku.trim() || null,
        buy_price: buyPrice,
        sell_price: sellPrice,
        min_stock: minStock,
        unit: form.unit.trim() || 'pcs',
        category_id: form.category_id || null,
        image_url: form.image_url ? form.image_url.trim() : null,
        is_active: form.is_active,
      }

      if (editingProduct) {
        let result = await supabase
          .from('products')
          .update(payload)
          .eq('id', editingProduct.id)
          .select('*')
          .single()

        if (isMissingImageUrlColumn(result.error)) {
          const { image_url: omittedImageUrl, ...payloadWithoutImage } = payload
          void omittedImageUrl
          result = await supabase
            .from('products')
            .update(payloadWithoutImage)
            .eq('id', editingProduct.id)
            .select('*')
            .single()
          imageWasOmitted = true
        }

        if (result.error) throw result.error
        const categoryName = categories.find(category => category.id === result.data.category_id)?.name

        const updatedProduct: Product = {
          ...result.data,
          categories: categoryName ? { name: categoryName } : null,
        }

        setProducts(prev => prev.map(p => p.id === editingProduct.id ? updatedProduct : p))
        notifyProductsUpdated()

        showToast(
          imageWasOmitted
            ? `Data produk "${form.name}" tersimpan, tetapi foto belum dapat disimpan saat ini.`
            : `Produk "${form.name}" berhasil diperbarui.`,
          imageWasOmitted ? 'bad' : 'ok',
        )
      } else {
        const insertPayload = { ...payload, stock }
        let result = await supabase
          .from('products')
          .insert(insertPayload)
          .select('*, categories(name)')
          .single()

        if (isMissingImageUrlColumn(result.error)) {
          const { image_url: omittedImageUrl, ...payloadWithoutImage } = insertPayload
          void omittedImageUrl
          result = await supabase
            .from('products')
            .insert(payloadWithoutImage)
            .select('*, categories(name)')
            .single()
          imageWasOmitted = true
        }

        if (result.error) throw result.error

        setProducts(prev => [result.data, ...prev])
        notifyProductsUpdated()
        showToast(
          imageWasOmitted
            ? `Produk "${form.name}" tersimpan, tetapi foto belum dapat disimpan saat ini.`
            : `Produk "${form.name}" berhasil ditambahkan.`,
          imageWasOmitted ? 'bad' : 'ok',
        )
      }

      setShowDialog(false)
    } catch (err: unknown) {
      const saveError = getProductSaveError(err)
      console.error('Error saving product:', saveError.message, saveError.details)
      showToast(saveError.message, 'bad')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleStatus = async (p: Product) => {
    const nextStatus = !p.is_active
    try {
      const { data, error } = await supabase
        .from('products')
        .update({ is_active: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', p.id)
        .select('id')
        .maybeSingle()

      if (error) throw error
      if (!data) throw new Error('Produk tidak ditemukan atau Anda tidak memiliki izin untuk mengubahnya.')

      setProducts(prev => prev.map(item => item.id === p.id ? { ...item, is_active: nextStatus } : item))
      notifyProductsUpdated()
      showToast(`Status ${p.name} diubah menjadi ${nextStatus ? 'Aktif' : 'Nonaktif'}.`, 'ok')
    } catch (err: any) {
      console.error('Error updating product status:', err)
      showToast(getUserFacingError(err, `Status produk "${p.name}" belum dapat diperbarui. Silakan coba lagi.`), 'bad')
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

      {loadError && (
        <div role="alert" style={{ marginBottom: 16, padding: 12, borderRadius: 10, color: 'var(--bad)', background: 'var(--bads)' }}>
          Data produk belum dapat dimuat. Silakan coba lagi.
        </div>
      )}

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
                          {p.image_url ? (
                            <img
                              src={p.image_url}
                              alt={p.name}
                              style={{
                                width: 40,
                                height: 40,
                                borderRadius: 10,
                                objectFit: 'cover',
                                border: '1px solid var(--line)',
                                flexShrink: 0
                              }}
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                                const fallback = (e.target as HTMLElement).nextElementSibling;
                                if (fallback) (fallback as HTMLElement).style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div style={{
                            width: 40,
                            height: 40,
                            borderRadius: 10,
                            background: p.is_active ? 'var(--accs)' : 'var(--bg)',
                            display: p.image_url ? 'none' : 'flex',
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

                {/* Foto Produk */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <label className="label" style={{ marginBottom: 0 }}>
                      Foto Produk (Tampil di Katalog Kasir)
                    </label>
                    {form.image_url && (
                      <button
                        type="button"
                        onClick={() => setForm(f => ({ ...f, image_url: '' }))}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--bad)',
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                      >
                        <Trash2 size={12} /> Hapus Foto
                      </button>
                    )}
                  </div>

                  <div style={{
                    display: 'flex',
                    gap: 12,
                    alignItems: 'center',
                    padding: 12,
                    background: 'var(--bg)',
                    borderRadius: 12,
                    border: '1px solid var(--line)'
                  }}>
                    {/* Preview Box */}
                    <div style={{
                      width: 68,
                      height: 68,
                      borderRadius: 10,
                      background: 'var(--panel)',
                      border: '1px solid var(--line)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      flexShrink: 0
                    }}>
                      {form.image_url ? (
                        <img
                          src={form.image_url}
                          alt="Preview Produk"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <ImageIcon size={26} color="var(--mute)" opacity={0.5} />
                      )}
                    </div>

                    {/* Input Controls */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <input
                          type="file"
                          ref={fileInputRef}
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={handleImageFileUpload}
                        />
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => fileInputRef.current?.click()}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
                        >
                          <Camera size={13} /> Upload Foto
                        </button>
                        <span style={{ fontSize: 11, color: 'var(--mute)' }}>atau masukkan link/URL gambar:</span>
                      </div>

                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        background: 'var(--panel)',
                        border: '1px solid var(--line)',
                        borderRadius: 8,
                        padding: '0 8px'
                      }}>
                        <LinkIcon size={12} color="var(--mute)" />
                        <input
                          className="input"
                          style={{ border: 'none', padding: '6px 0', fontSize: 12, background: 'transparent', width: '100%' }}
                          placeholder="https://... (URL foto gambar web)"
                          value={form.image_url}
                          onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))}
                        />
                      </div>
                    </div>
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
