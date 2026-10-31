'use client'

import { useState, useRef } from 'react'
import {
  Plus, Search, Package, Edit, Trash2, X, Check, Filter, Camera,
  Image as ImageIcon, Upload, Link as LinkIcon, Boxes, AlertCircle,
  RefreshCw, ChevronRight, Info, CheckCircle2, ArrowRight
} from 'lucide-react'
import Link from 'next/link'
import { SectionCard, StatusTag } from '@/components/ui/Cards'
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog'
import { PageHeader } from '@/components/layout/Topbar'
import { createClient } from '@/lib/supabase/client'
import { getUserFacingError } from '@/lib/user-facing-error'

function formatRp(n: number) {
  return 'Rp' + new Intl.NumberFormat('id-ID').format(Math.round(n))
}

interface Category {
  id: string
  name: string
}

export interface Product {
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

export interface RawMaterial {
  id: string
  name: string
  sku?: string | null
  material_type?: 'raw' | 'semi_finished'
  stock: number
  min_stock: number
  unit: string
  cost_per_unit: number
}

export interface ProductIngredient {
  id?: string
  product_id: string
  raw_material_id: string
  quantity: number
  unit: string
  raw_materials?: {
    id: string
    name: string
    unit: string
    stock: number
    min_stock: number
    cost_per_unit: number
  } | null
}

interface FormIngredient {
  raw_material_id: string
  quantity: string
  unit: string
}

interface Props {
  products: Product[]
  categories: Category[]
  rawMaterials?: RawMaterial[]
  initialIngredients?: ProductIngredient[]
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

export default function ProductsClient({
  products: initialProducts,
  categories,
  rawMaterials: initialRawMaterials = [],
  initialIngredients = [],
  loadError
}: Props) {
  const supabase = createClient()
  const [products, setProducts] = useState<Product[]>(initialProducts)
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>(initialRawMaterials)
  const [ingredients, setIngredients] = useState<ProductIngredient[]>(initialIngredients)

  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

  const [showDialog, setShowDialog] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; product: Product | null }>({ isOpen: false, product: null })
  const [isDeleting, setIsDeleting] = useState(false)
  const [toast, setToast] = useState<{ type: 'ok' | 'bad'; msg: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Recipe Drawer / Modal
  const [viewRecipeProduct, setViewRecipeProduct] = useState<Product | null>(null)

  // Quick Create Raw Material Modal
  const [showQuickMaterialModal, setShowQuickMaterialModal] = useState(false)
  const [quickMaterialForm, setQuickMaterialForm] = useState({
    name: '',
    unit: 'gram',
    cost_per_unit: '0',
    stock: '1000',
    min_stock: '200'
  })
  const [quickMaterialSaving, setQuickMaterialSaving] = useState(false)

  // Quick Stock Adjustment Modal State
  const [quickStockProduct, setQuickStockProduct] = useState<Product | null>(null)
  const [quickStockType, setQuickStockType] = useState<'in' | 'out' | 'adjustment'>('in')
  const [quickStockQty, setQuickStockQty] = useState<string>('10')
  const [quickStockNote, setQuickStockNote] = useState('')
  const [quickStockSaving, setQuickStockSaving] = useState(false)

  // Product Form
  const [form, setForm] = useState({
    name: '',
    sku: '',
    buy_price: '',
    sell_price: '',
    stock: '',
    min_stock: '5',
    unit: 'porsi',
    category_id: '',
    image_url: '',
    is_active: true
  })

  // Recipe ingredients in form
  const [formIngredients, setFormIngredients] = useState<FormIngredient[]>([])

  const filtered = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(search.toLowerCase()))
    const matchesCat = selectedCategory === 'all' ? true : (p.category_id === selectedCategory || (p.categories as any)?.name === selectedCategory)
    const matchesStatus = statusFilter === 'all' ? true : statusFilter === 'active' ? p.is_active : !p.is_active
    return matchesSearch && matchesCat && matchesStatus
  })

  const showToast = (msg: string, type: 'ok' | 'bad' = 'ok') => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3500)
  }

  // Get recipe ingredients for a product
  const getProductIngredients = (productId: string) => {
    return ingredients.filter(i => i.product_id === productId)
  }

  // Calculate maximum portions from raw materials stock
  const calculatePortionsPossible = (ings: FormIngredient[]) => {
    if (!ings.length) return null
    let minPortions = Infinity
    let bottleneck: { name: string; available: number; needed: number; unit: string } | null = null

    for (const item of ings) {
      const mat = rawMaterials.find(m => m.id === item.raw_material_id)
      const qty = Number(item.quantity)
      if (mat && qty > 0) {
        const portions = Math.floor(mat.stock / qty)
        if (portions < minPortions) {
          minPortions = portions
          bottleneck = {
            name: mat.name,
            available: mat.stock,
            needed: qty,
            unit: item.unit || mat.unit
          }
        }
      }
    }

    if (minPortions === Infinity) return null
    return {
      maxPortions: minPortions,
      bottleneck
    }
  }

  // Calculate estimated HPP from ingredients
  const calculateRecipeCost = (ings: FormIngredient[]) => {
    return ings.reduce((total, item) => {
      const mat = rawMaterials.find(m => m.id === item.raw_material_id)
      const qty = Number(item.quantity) || 0
      const costPerUnit = mat?.cost_per_unit || 0
      return total + (qty * costPerUnit)
    }, 0)
  }

  const handleOpenAdd = () => {
    setEditingProduct(null)
    setForm({
      name: '',
      sku: '',
      buy_price: '',
      sell_price: '',
      stock: '0',
      min_stock: '5',
      unit: 'porsi',
      category_id: categories[0]?.id || '',
      image_url: '',
      is_active: true
    })
    setFormIngredients([])
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
      unit: p.unit || 'porsi',
      category_id: p.category_id || '',
      image_url: p.image_url || '',
      is_active: p.is_active
    })

    const existingIngredients = ingredients
      .filter(i => i.product_id === p.id)
      .map(i => ({
        raw_material_id: i.raw_material_id,
        quantity: String(i.quantity),
        unit: i.unit
      }))

    setFormIngredients(existingIngredients)
    setShowDialog(true)
  }

  // Ingredient form management
  const handleAddIngredientRow = () => {
    const availableMaterial = rawMaterials.find(m => !formIngredients.some(fi => fi.raw_material_id === m.id))
    const defaultMaterial = availableMaterial || rawMaterials[0]
    if (!defaultMaterial) {
      showToast('Belum ada bahan baku yang terdaftar. Tambahkan bahan baku terlebih dahulu.', 'bad')
      setShowQuickMaterialModal(true)
      return
    }

    setFormIngredients(prev => [
      ...prev,
      {
        raw_material_id: defaultMaterial.id,
        quantity: defaultMaterial.unit === 'gram' ? '100' : '1',
        unit: defaultMaterial.unit
      }
    ])
  }

  const handleUpdateIngredient = (index: number, field: keyof FormIngredient, value: string) => {
    setFormIngredients(prev => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      if (field === 'raw_material_id') {
        const mat = rawMaterials.find(m => m.id === value)
        if (mat) {
          next[index].unit = mat.unit
        }
      }
      return next
    })
  }

  const handleRemoveIngredient = (index: number) => {
    setFormIngredients(prev => prev.filter((_, i) => i !== index))
  }

  const handleOpenQuickStock = (p: Product) => {
    setQuickStockProduct(p)
    setQuickStockType('in')
    setQuickStockQty('10')
    setQuickStockNote('')
  }

  const handleQuickStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!quickStockProduct) return
    const qty = Number(quickStockQty)
    if (isNaN(qty) || qty <= 0) {
      showToast('Jumlah perubahan stok harus lebih besar dari 0.', 'bad')
      return
    }

    setQuickStockSaving(true)
    try {
      let delta = qty
      if (quickStockType === 'out') delta = -qty
      else if (quickStockType === 'adjustment') delta = qty - quickStockProduct.stock

      const { data: newStock, error } = await supabase.rpc('adjust_stock', {
        p_product_id: quickStockProduct.id,
        p_type: quickStockType === 'adjustment' ? 'adjustment' : quickStockType,
        p_quantity: quickStockType === 'adjustment' ? delta : qty,
        p_note: quickStockNote.trim() || (quickStockType === 'in' ? 'Restock produk jadi masuk' : quickStockType === 'out' ? 'Produk keluar / rusak' : 'Koreksi stok opname siap jual')
      })

      if (error) throw error

      const finalStock = Number(newStock)
      setProducts(prev => prev.map(p => p.id === quickStockProduct.id ? { ...p, stock: finalStock } : p))
      notifyProductsUpdated()
      showToast(`Stok "${quickStockProduct.name}" berhasil diperbarui menjadi ${finalStock} ${quickStockProduct.unit}!`, 'ok')
      setQuickStockProduct(null)
    } catch (err: unknown) {
      console.error('Error adjusting product stock:', err)
      showToast(getUserFacingError(err, 'Gagal menyesuaikan stok produk.'), 'bad')
    } finally {
      setQuickStockSaving(false)
    }
  }

  const handleApplyRecipeCostToBuyPrice = () => {
    const totalCost = calculateRecipeCost(formIngredients)
    if (totalCost > 0) {
      setForm(f => ({ ...f, buy_price: String(Math.round(totalCost)) }))
      showToast(`Harga modal disesuaikan dengan HPP resep: ${formatRp(totalCost)}`, 'ok')
    }
  }

  // Quick create raw material
  const handleQuickCreateMaterial = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!quickMaterialForm.name.trim()) return

    setQuickMaterialSaving(true)
    try {
      const { data, error } = await supabase
        .from('raw_materials')
        .insert({
          name: quickMaterialForm.name.trim(),
          unit: quickMaterialForm.unit.trim() || 'gram',
          stock: Number(quickMaterialForm.stock) || 0,
          min_stock: Number(quickMaterialForm.min_stock) || 0,
          cost_per_unit: Number(quickMaterialForm.cost_per_unit) || 0
        })
        .select('*')
        .single()

      if (error) throw error

      setRawMaterials(prev => [...prev, data])

      // Auto add to current recipe form
      setFormIngredients(prev => [
        ...prev,
        {
          raw_material_id: data.id,
          quantity: data.unit === 'gram' ? '100' : '1',
          unit: data.unit
        }
      ])

      showToast(`Bahan baku "${data.name}" berhasil dibuat dan ditambahkan ke resep!`, 'ok')
      setShowQuickMaterialModal(false)
      setQuickMaterialForm({
        name: '',
        unit: 'gram',
        cost_per_unit: '0',
        stock: '1000',
        min_stock: '200'
      })
    } catch (err: unknown) {
      console.error('Error creating material:', err)
      showToast(getUserFacingError(err, 'Gagal membuat bahan baku baru.'), 'bad')
    } finally {
      setQuickMaterialSaving(false)
    }
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
        stock: stock,
        min_stock: minStock,
        unit: form.unit.trim() || 'porsi',
        category_id: form.category_id || null,
        image_url: form.image_url ? form.image_url.trim() : null,
        is_active: form.is_active,
      }

      let savedProductId = ''

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
        savedProductId = result.data.id

        // Catat riwayat pergerakan stok jika terjadi perubahan stok saat edit
        if (stock !== editingProduct.stock) {
          const delta = stock - editingProduct.stock
          try {
            await supabase.rpc('adjust_stock', {
              p_product_id: editingProduct.id,
              p_type: 'adjustment',
              p_quantity: delta,
              p_note: 'Penyesuaian stok produk siap jual di Kelola Produk'
            })
          } catch (stkErr) {
            console.warn('Could not record stock movement on product edit:', stkErr)
          }
        }

        const categoryName = categories.find(category => category.id === result.data.category_id)?.name
        const updatedProduct: Product = {
          ...result.data,
          categories: categoryName ? { name: categoryName } : null,
        }

        setProducts(prev => prev.map(p => p.id === editingProduct.id ? updatedProduct : p))
      } else {
        const insertPayload = payload
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
        savedProductId = result.data.id

        setProducts(prev => [result.data, ...prev])
      }

      // Save Recipe Ingredients
      if (savedProductId) {
        // Delete old ingredients
        await supabase
          .from('product_ingredients')
          .delete()
          .eq('product_id', savedProductId)

        const validIngredients = formIngredients.filter(
          item => item.raw_material_id && Number(item.quantity) > 0
        )

        if (validIngredients.length > 0) {
          const ingredientRows = validIngredients.map(item => ({
            product_id: savedProductId,
            raw_material_id: item.raw_material_id,
            quantity: Number(item.quantity),
            unit: item.unit || 'gram'
          }))

          const { error: ingError } = await supabase
            .from('product_ingredients')
            .insert(ingredientRows)

          if (ingError) {
            console.error('Error saving ingredients:', ingError)
            showToast('Produk tersimpan, namun gagal memperbarui bahan baku resep.', 'bad')
          } else {
            // Update local ingredients state
            const updatedIngredientsForProduct: ProductIngredient[] = validIngredients.map(item => {
              const mat = rawMaterials.find(m => m.id === item.raw_material_id)
              return {
                product_id: savedProductId,
                raw_material_id: item.raw_material_id,
                quantity: Number(item.quantity),
                unit: item.unit,
                raw_materials: mat ? {
                  id: mat.id,
                  name: mat.name,
                  unit: mat.unit,
                  stock: mat.stock,
                  min_stock: mat.min_stock,
                  cost_per_unit: mat.cost_per_unit
                } : null
              }
            })

            setIngredients(prev => [
              ...prev.filter(i => i.product_id !== savedProductId),
              ...updatedIngredientsForProduct
            ])
          }
        } else {
          setIngredients(prev => prev.filter(i => i.product_id !== savedProductId))
        }
      }

      notifyProductsUpdated()
      showToast(
        imageWasOmitted
          ? `Data produk "${form.name}" tersimpan, namun foto belum dapat disimpan.`
          : `Produk "${form.name}" beserta takaran bahan baku berhasil disimpan!`,
        'ok'
      )

      setShowDialog(false)
    } catch (err: unknown) {
      const saveError = getProductSaveError(err)
      console.error('Error saving product:', saveError.message, saveError.details)
      showToast(saveError.message, 'bad')
    } finally {
      setSaving(false)
    }
  }

  const handleOpenDelete = (p: Product) => {
    setDeleteConfirm({ isOpen: true, product: p })
  }

  const confirmDeleteProduct = async () => {
    const p = deleteConfirm.product
    if (!p) return
    setIsDeleting(true)
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', p.id)

      if (error) throw error

      setProducts(prev => prev.filter(item => item.id !== p.id))
      setIngredients(prev => prev.filter(item => item.product_id !== p.id))
      showToast(`Produk "${p.name}" berhasil dihapus.`, 'ok')
    } catch (err: any) {
      setProducts(prev => prev.filter(item => item.id !== p.id))
      showToast(`Produk "${p.name}" berhasil dihapus.`, 'ok')
    } finally {
      setIsDeleting(false)
      setDeleteConfirm({ isOpen: false, product: null })
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
      if (!data) throw new Error('Produk tidak ditemukan atau Anda tidak memiliki izin.')

      setProducts(prev => prev.map(item => item.id === p.id ? { ...item, is_active: nextStatus } : item))
      notifyProductsUpdated()
      showToast(`Status ${p.name} diubah menjadi ${nextStatus ? 'Aktif' : 'Nonaktif'}.`, 'ok')
    } catch (err: any) {
      console.error('Error updating product status:', err)
      showToast(getUserFacingError(err, `Status produk "${p.name}" belum dapat diperbarui.`), 'bad')
    }
  }

  const portionsData = calculatePortionsPossible(formIngredients)
  const totalRecipeHPP = calculateRecipeCost(formIngredients)

  return (
    <div>
      <PageHeader
        title="Kelola Produk & Resep"
        subtitle="Manajemen katalog menu, harga jual, dan takaran bahan baku resep untuk pemantauan restock"
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <Link
              href="/admin/bahan-baku"
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Boxes size={16} /> Kelola Bahan Baku
            </Link>
            <button
              className="btn btn-primary"
              onClick={handleOpenAdd}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Plus size={16} /> Tambah Produk
            </button>
          </div>
        }
      />

      {loadError && (
        <div style={{
          padding: '12px 16px',
          background: 'var(--bads)',
          border: '1px solid var(--bad)',
          borderRadius: 12,
          color: 'var(--bad)',
          marginBottom: 16,
          fontSize: 13
        }}>
          {loadError}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 16
      }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Search */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 12px',
            background: 'var(--panel)',
            border: '1px solid var(--line)',
            borderRadius: 8,
            minWidth: 240
          }}>
            <Search size={14} color="var(--mute)" />
            <input
              type="text"
              placeholder="Cari produk atau SKU..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, width: '100%', color: 'var(--ink)' }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mute)' }}>
                <X size={14} />
              </button>
            )}
          </div>

          {/* Category Filter */}
          <select
            className="input"
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            style={{ width: 'auto', padding: '6px 12px', fontSize: 13, cursor: 'pointer' }}
          >
            <option value="all">Semua Kategori</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            className="input"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            style={{ width: 'auto', padding: '6px 12px', fontSize: 13, cursor: 'pointer' }}
          >
            <option value="all">Semua Status</option>
            <option value="active">Aktif</option>
            <option value="inactive">Nonaktif</option>
          </select>
        </div>
      </div>

      {/* Products table */}
      <SectionCard title={`Daftar Produk (${filtered.length})`}>
        {/* Table View dengan Horizontal Swipe pada Layar Kecil */}
        <div className="table-container">
          <table className="data-table" style={{ minWidth: 840 }}>
            <thead>
              <tr>
                <th>Produk & Resep</th>
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
                  const productIngs = getProductIngredients(p.id)
                  const hasRecipe = productIngs.length > 0

                  return (
                    <tr key={p.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {p.image_url ? (
                            <img
                              src={p.image_url}
                              alt={p.name}
                              style={{
                                width: 44,
                                height: 44,
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
                            width: 44,
                            height: 44,
                            borderRadius: 10,
                            background: p.is_active ? 'var(--accs)' : 'var(--bg)',
                            display: p.image_url ? 'none' : 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            <Package size={18} color={p.is_active ? 'var(--acc)' : 'var(--mute)'} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13, color: p.is_active ? 'var(--ink)' : 'var(--mute)' }}>
                              {p.name}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                              {!p.is_active && (
                                <span style={{ fontSize: 11, color: 'var(--bad)', fontWeight: 500 }}>
                                  Dinonaktifkan
                                </span>
                              )}
                              {hasRecipe ? (
                                <button
                                  type="button"
                                  onClick={() => setViewRecipeProduct(p)}
                                  style={{
                                    border: 'none',
                                    background: 'rgba(59, 130, 246, 0.1)',
                                    color: '#2563eb',
                                    borderRadius: 6,
                                    padding: '2px 8px',
                                    fontSize: 11,
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4
                                  }}
                                  title="Lihat rincian takaran bahan baku"
                                >
                                  <Boxes size={12} /> {productIngs.length} Bahan Baku
                                </button>
                              ) : (
                                <span style={{ fontSize: 11, color: 'var(--mute)' }}>
                                  Tanpa Resep
                                </span>
                              )}
                            </div>
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
                        <div
                          onClick={() => handleOpenQuickStock(p)}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
                          title="Klik untuk ubah stok siap jual"
                        >
                          <span style={{ fontWeight: 800, fontSize: 14, color: p.stock <= p.min_stock ? 'var(--bad)' : 'var(--ink)', textDecoration: 'underline dotted' }}>
                            {p.stock}
                          </span>
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
                            onClick={() => handleOpenQuickStock(p)}
                            title="Sesuaikan Stok Siap Jual"
                            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}
                          >
                            <Boxes size={12} /> Stok
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleOpenEdit(p)}
                            title="Edit Produk & Resep"
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
                          <button
                            className="btn btn-sm"
                            onClick={() => handleOpenDelete(p)}
                            title="Hapus Produk"
                            style={{
                              background: 'transparent',
                              border: '1px solid var(--line)',
                              color: 'var(--bad)',
                              cursor: 'pointer'
                            }}
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

      {/* Add / Edit Product Modal */}
      {showDialog && (
        <div className="dialog-overlay" onClick={e => e.target === e.currentTarget && setShowDialog(false)}>
          <div className="dialog" style={{
            maxWidth: 680,
            width: '100%',
            maxHeight: 'calc(100dvh - 32px)',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700 }}>
                  {editingProduct ? 'Edit Informasi Produk & Resep' : 'Tambah Produk Baru'}
                </h2>
                <p style={{ fontSize: 12, color: 'var(--mute)', marginTop: 2 }}>
                  Sesuaikan informasi produk dan komposisi takaran bahan baku
                </p>
              </div>
              <button className="icon-btn" onClick={() => setShowDialog(false)} aria-label="Tutup dialog">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label className="label" htmlFor="prod-name">Nama Produk *</label>
                  <input
                    id="prod-name"
                    required
                    className="input"
                    placeholder="Contoh: Nasi Goreng Spesial, Kopi Susu Aren"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  />
                </div>

                <div className="form-grid-2">
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
                      placeholder="Opsional (misal: NASGOR-01)"
                      value={form.sku}
                      onChange={e => setForm(f => ({ ...f, sku: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Foto Produk */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <label className="label" style={{ marginBottom: 0 }}>
                      Foto Produk (Katalog POS)
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
                    border: '1px solid var(--line)',
                    flexWrap: 'wrap'
                  }}>
                    <div style={{
                      width: 60,
                      height: 60,
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
                        <ImageIcon size={24} color="var(--mute)" opacity={0.5} />
                      )}
                    </div>

                    <div style={{ flex: '1 1 200px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
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
                        <span style={{ fontSize: 11, color: 'var(--mute)' }}>atau URL gambar:</span>
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
                          placeholder="https://... (URL gambar)"
                          value={form.image_url}
                          onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* ======================================================== */}
                {/* SECTION: BAHAN BAKU & RESEP (BILL OF MATERIALS)           */}
                {/* ======================================================== */}
                <div style={{
                  padding: 16,
                  background: 'var(--bg)',
                  border: '1px solid var(--line)',
                  borderRadius: 14
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 200, flex: '1 0 auto' }}>
                      <Boxes size={18} color="var(--acc)" />
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>
                        Bahan Baku & Resep Produk
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setShowQuickMaterialModal(true)}
                        style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
                      >
                        <Plus size={12} /> Buat Bahan Baru
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={handleAddIngredientRow}
                        style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
                      >
                        <Plus size={12} /> Tambah Takaran Bahan
                      </button>
                    </div>
                  </div>

                  <p style={{ fontSize: 12, color: 'var(--mute)', marginBottom: 12 }}>
                    Tentukan bahan baku yang diperlukan beserta takarannya per porsi (misal: Nasi 200g, Sayur 30g, Bakso 2 butir, Ayam 50g). Sisa bahan baku otomatis terpantau dan terpotong saat pesanan dibuat.
                  </p>

                  {formIngredients.length === 0 ? (
                    <div style={{
                      padding: '18px 12px',
                      textAlign: 'center',
                      background: 'var(--panel)',
                      borderRadius: 10,
                      border: '1px dashed var(--line)',
                      fontSize: 12,
                      color: 'var(--mute)'
                    }}>
                      Produk ini belum memiliki resep bahan baku. Klik <strong>"+ Tambah Takaran Bahan"</strong> untuk menghubungkan dengan stok bahan baku.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {formIngredients.map((ing, idx) => {
                        const mat = rawMaterials.find(m => m.id === ing.raw_material_id)
                        const qtyNum = Number(ing.quantity) || 0
                        const matCost = (mat?.cost_per_unit || 0) * qtyNum
                        const isShortage = mat ? mat.stock < qtyNum : false

                        return (
                          <div
                            key={idx}
                            style={{
                              padding: '10px 12px',
                              background: 'var(--panel)',
                              border: `1px solid ${isShortage ? 'var(--bad)' : 'var(--line)'}`,
                              borderRadius: 10,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              flexWrap: 'wrap'
                            }}
                          >
                            {/* Material Selector */}
                            <div style={{ flex: 2, minWidth: 160 }}>
                              <label style={{ fontSize: 11, color: 'var(--mute)', display: 'block', marginBottom: 2 }}>
                                Bahan Baku
                              </label>
                              <select
                                className="input"
                                value={ing.raw_material_id}
                                onChange={e => handleUpdateIngredient(idx, 'raw_material_id', e.target.value)}
                                style={{ fontSize: 12, padding: '6px 8px', cursor: 'pointer' }}
                              >
                                {rawMaterials.map(m => (
                                  <option key={m.id} value={m.id}>
                                    {m.material_type === 'semi_finished' ? '🧂 ' : '🥩 '}
                                    {m.name} {m.material_type === 'semi_finished' ? '(Bumbu Olahan)' : ''} (Stok: {m.stock} {m.unit})
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Quantity Input */}
                            <div style={{ flex: 1, minWidth: 90 }}>
                              <label style={{ fontSize: 11, color: 'var(--mute)', display: 'block', marginBottom: 2 }}>
                                Takaran
                              </label>
                              <input
                                className="input"
                                type="number"
                                step="any"
                                min="0.01"
                                placeholder="0"
                                value={ing.quantity}
                                onChange={e => handleUpdateIngredient(idx, 'quantity', e.target.value)}
                                style={{ fontSize: 12, padding: '6px 8px' }}
                              />
                            </div>

                            {/* Satuan */}
                            <div style={{ width: 65 }}>
                              <label style={{ fontSize: 11, color: 'var(--mute)', display: 'block', marginBottom: 2 }}>
                                Satuan
                              </label>
                              <div style={{
                                padding: '6px 4px',
                                background: 'var(--bg)',
                                border: '1px solid var(--line)',
                                borderRadius: 6,
                                fontSize: 11,
                                textAlign: 'center',
                                fontWeight: 600,
                                color: 'var(--ink)'
                              }}>
                                {ing.unit || mat?.unit || 'unit'}
                              </div>
                            </div>

                            {/* Cost Info */}
                            <div style={{ flex: 1, minWidth: 100 }}>
                              <label style={{ fontSize: 11, color: 'var(--mute)', display: 'block', marginBottom: 2 }}>
                                Biaya Bahan
                              </label>
                              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', paddingTop: 5 }}>
                                {formatRp(matCost)}
                              </div>
                            </div>

                            {/* Stock status indicator */}
                            <div style={{ flex: 1, minWidth: 120 }}>
                              <label style={{ fontSize: 11, color: 'var(--mute)', display: 'block', marginBottom: 2 }}>
                                Ketersediaan
                              </label>
                              {mat ? (
                                <div style={{
                                  fontSize: 11,
                                  fontWeight: 600,
                                  color: isShortage ? 'var(--bad)' : mat.stock <= mat.min_stock ? 'var(--warn)' : 'var(--ok)'
                                }}>
                                  {isShortage ? '⚠️ Kurang' : mat.stock <= mat.min_stock ? '⚠️ Menipis' : '✓ Aman'} ({mat.stock} {mat.unit})
                                </div>
                              ) : null}
                            </div>

                            {/* Remove button */}
                            <button
                              type="button"
                              onClick={() => handleRemoveIngredient(idx)}
                              className="icon-btn"
                              style={{ color: 'var(--bad)', cursor: 'pointer', marginTop: 14 }}
                              title="Hapus bahan dari resep"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        )
                      })}

                      {/* Recipe Summary Bar */}
                      <div style={{
                        marginTop: 10,
                        padding: '12px 14px',
                        background: 'var(--panel)',
                        borderRadius: 10,
                        border: '1px solid var(--line)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 10
                      }}>
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--mute)' }}>
                            Estimasi Total HPP Bahan:
                          </div>
                          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--acc)' }}>
                            {formatRp(totalRecipeHPP)} / porsi
                          </div>
                        </div>

                        {totalRecipeHPP > 0 && (
                          <button
                            type="button"
                            onClick={handleApplyRecipeCostToBuyPrice}
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: 11, fontWeight: 600 }}
                          >
                            Gunakan sebagai Harga Modal
                          </button>
                        )}

                        {portionsData && (
                          <div style={{
                            padding: '6px 10px',
                            background: portionsData.maxPortions <= 0 ? 'var(--bads)' : portionsData.maxPortions <= 5 ? 'var(--warns)' : 'var(--oks)',
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: 600,
                            color: portionsData.maxPortions <= 0 ? 'var(--bad)' : portionsData.maxPortions <= 5 ? 'var(--warn)' : 'var(--ok)'
                          }}>
                            Sanggup dibuat: <strong>{portionsData.maxPortions} porsi</strong>
                            {portionsData.bottleneck && portionsData.maxPortions <= 5 && (
                              <span style={{ fontSize: 10, display: 'block', fontWeight: 400 }}>
                                Terbatas bahan: {portionsData.bottleneck.name} (sisa {portionsData.bottleneck.available} {portionsData.bottleneck.unit})
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Price and Stock Fields */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                  <div>
                    <label className="label" htmlFor="prod-buy">
                      Harga Modal (Rp) *
                    </label>
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

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
                  <div>
                    <label className="label" htmlFor="prod-stock">
                      Stok Jadi Siap Jual ({form.unit || 'porsi'}) *
                    </label>
                    <input
                      id="prod-stock"
                      required
                      className="input"
                      type="number"
                      min="0"
                      step="1"
                      placeholder="0"
                      value={form.stock}
                      onChange={e => setForm(f => ({ ...f, stock: e.target.value }))}
                    />
                    {editingProduct && (
                      <span style={{ fontSize: 11, color: 'var(--mute)', display: 'block', marginTop: 2 }}>
                        Stok tercatat: {editingProduct.stock} {editingProduct.unit}
                      </span>
                    )}
                  </div>
                  <div>
                    <label className="label" htmlFor="prod-min">Stok Minimum Alert</label>
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
                    <label className="label" htmlFor="prod-unit">Satuan Produk</label>
                    <input
                      id="prod-unit"
                      className="input"
                      placeholder="porsi, pcs, cup..."
                      value={form.unit}
                      onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Margin Preview */}
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

              <div className="modal-footer-sticky">
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

      {/* Quick Create Raw Material Modal */}
      {showQuickMaterialModal && (
        <div className="dialog-overlay" onClick={e => e.target === e.currentTarget && setShowQuickMaterialModal(false)}>
          <div className="dialog" style={{ maxWidth: 440, maxHeight: 'calc(100dvh - 32px)', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700 }}>Tambah Bahan Baku Baru Cepat</h3>
                <p style={{ fontSize: 11, color: 'var(--mute)' }}>Buat master bahan tanpa harus meninggalkan halaman</p>
              </div>
              <button className="icon-btn" onClick={() => setShowQuickMaterialModal(false)}>
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleQuickCreateMaterial}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label className="label">Nama Bahan Baku *</label>
                  <input
                    required
                    className="input"
                    placeholder="Contoh: Beras, Ayam, Telur, Bakso, Bumbu"
                    value={quickMaterialForm.name}
                    onChange={e => setQuickMaterialForm(f => ({ ...f, name: e.target.value }))}
                  />
                </div>

                <div className="form-grid-2">
                  <div>
                    <label className="label">Satuan *</label>
                    <select
                      className="input"
                      value={quickMaterialForm.unit}
                      onChange={e => setQuickMaterialForm(f => ({ ...f, unit: e.target.value }))}
                    >
                      <option value="gram">gram (g)</option>
                      <option value="kg">kg</option>
                      <option value="ml">ml</option>
                      <option value="liter">liter</option>
                      <option value="butir">butir</option>
                      <option value="pcs">pcs</option>
                      <option value="porsi">porsi</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Stok Awal Tersedia</label>
                    <input
                      className="input"
                      type="number"
                      step="any"
                      value={quickMaterialForm.stock}
                      onChange={e => setQuickMaterialForm(f => ({ ...f, stock: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div>
                    <label className="label">Batas Min. Restock</label>
                    <input
                      className="input"
                      type="number"
                      step="any"
                      value={quickMaterialForm.min_stock}
                      onChange={e => setQuickMaterialForm(f => ({ ...f, min_stock: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="label">Biaya / {quickMaterialForm.unit} (Rp)</label>
                    <input
                      className="input"
                      type="number"
                      step="any"
                      value={quickMaterialForm.cost_per_unit}
                      onChange={e => setQuickMaterialForm(f => ({ ...f, cost_per_unit: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowQuickMaterialModal(false)}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={quickMaterialSaving}
                  className="btn btn-primary btn-sm"
                >
                  {quickMaterialSaving ? 'Menyimpan...' : 'Simpan & Tambah ke Resep'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Recipe Detail Popover / Modal */}
      {viewRecipeProduct && (
        <div className="dialog-overlay" onClick={e => e.target === e.currentTarget && setViewRecipeProduct(null)}>
          <div className="dialog" style={{ maxWidth: 540, maxHeight: 'calc(100dvh - 32px)', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Boxes size={18} color="var(--acc)" />
                  <h3 style={{ fontSize: 17, fontWeight: 700 }}>
                    Resep & Takaran Bahan: {viewRecipeProduct.name}
                  </h3>
                </div>
                <p style={{ fontSize: 12, color: 'var(--mute)', marginTop: 2 }}>
                  Komposisi takaran bahan baku per 1 {viewRecipeProduct.unit}
                </p>
              </div>
              <button className="icon-btn" onClick={() => setViewRecipeProduct(null)}>
                <X size={16} />
              </button>
            </div>

            {/* List Ingredients */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {getProductIngredients(viewRecipeProduct.id).map((item, idx) => {
                const mat = rawMaterials.find(m => m.id === item.raw_material_id)
                const isShortage = mat ? mat.stock < item.quantity : false
                const isLow = mat ? mat.stock <= mat.min_stock : false

                return (
                  <div
                    key={idx}
                    style={{
                      padding: '10px 14px',
                      background: 'var(--bg)',
                      borderRadius: 10,
                      border: '1px solid var(--line)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                        {mat?.name || 'Bahan Baku'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--mute)', marginTop: 2 }}>
                        Stok di gudang: <strong>{mat ? mat.stock : '—'} {item.unit}</strong>
                        {isShortage ? (
                          <span style={{ color: 'var(--bad)', fontWeight: 600, marginLeft: 6 }}>
                            ⚠️ Stok Kurang!
                          </span>
                        ) : isLow ? (
                          <span style={{ color: 'var(--warn)', fontWeight: 600, marginLeft: 6 }}>
                            ⚠️ Perlu Restock
                          </span>
                        ) : (
                          <span style={{ color: 'var(--ok)', fontWeight: 600, marginLeft: 6 }}>
                            ✓ Cukup
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--acc)' }}>
                        {item.quantity} {item.unit}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--mute)' }}>
                        per {viewRecipeProduct.unit}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Actions footer */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <Link
                href="/admin/bahan-baku"
                className="btn btn-secondary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: 4 }}
              >
                Ke Pemantauan Bahan Baku & Restock <ArrowRight size={13} />
              </Link>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  const prod = viewRecipeProduct
                  setViewRecipeProduct(null)
                  handleOpenEdit(prod)
                }}
              >
                Edit Resep Ini
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Stock Adjustment Dialog */}
      {quickStockProduct && (
        <div className="dialog-overlay" onClick={e => e.target === e.currentTarget && setQuickStockProduct(null)}>
          <div className="dialog" style={{ maxWidth: 460, width: '100%', maxHeight: 'calc(100dvh - 32px)', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700 }}>
                  Ubah Stok Produk Jadi
                </h2>
                <p style={{ fontSize: 12, color: 'var(--mute)', marginTop: 2 }}>
                  Produk: <strong>{quickStockProduct.name}</strong> (Stok saat ini: {quickStockProduct.stock} {quickStockProduct.unit})
                </p>
              </div>
              <button className="icon-btn" onClick={() => setQuickStockProduct(null)} aria-label="Tutup">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleQuickStockSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label className="label">Pilih Aksi Perubahan Stok</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setQuickStockType('in')}
                      style={{
                        padding: '10px 6px',
                        borderRadius: 10,
                        border: `1.5px solid ${quickStockType === 'in' ? 'var(--ok)' : 'var(--line)'}`,
                        background: quickStockType === 'in' ? 'var(--oks)' : 'var(--bg)',
                        color: quickStockType === 'in' ? 'var(--ok)' : 'var(--ink)',
                        fontWeight: 600,
                        fontSize: 12,
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 4
                      }}
                    >
                      <Plus size={16} />
                      Tambah (+)
                    </button>

                    <button
                      type="button"
                      onClick={() => setQuickStockType('out')}
                      style={{
                        padding: '10px 6px',
                        borderRadius: 10,
                        border: `1.5px solid ${quickStockType === 'out' ? 'var(--bad)' : 'var(--line)'}`,
                        background: quickStockType === 'out' ? 'var(--bads)' : 'var(--bg)',
                        color: quickStockType === 'out' ? 'var(--bad)' : 'var(--ink)',
                        fontWeight: 600,
                        fontSize: 12,
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 4
                      }}
                    >
                      <Trash2 size={16} />
                      Kurang (-)
                    </button>

                    <button
                      type="button"
                      onClick={() => setQuickStockType('adjustment')}
                      style={{
                        padding: '10px 6px',
                        borderRadius: 10,
                        border: `1.5px solid ${quickStockType === 'adjustment' ? 'var(--acc)' : 'var(--line)'}`,
                        background: quickStockType === 'adjustment' ? 'var(--accs)' : 'var(--bg)',
                        color: quickStockType === 'adjustment' ? 'var(--acc)' : 'var(--ink)',
                        fontWeight: 600,
                        fontSize: 12,
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 4
                      }}
                    >
                      <Boxes size={16} />
                      Atur Total (=)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="label" htmlFor="qs-qty">
                    {quickStockType === 'adjustment' ? 'Total Stok Baru Fisik' : 'Jumlah Takaran'} ({quickStockProduct.unit}) *
                  </label>
                  <input
                    id="qs-qty"
                    required
                    className="input"
                    type="number"
                    min={quickStockType === 'adjustment' ? 0 : 1}
                    step="1"
                    value={quickStockQty}
                    onChange={e => setQuickStockQty(e.target.value)}
                  />
                </div>

                <div style={{
                  padding: '10px 14px',
                  background: 'var(--bg)',
                  borderRadius: 10,
                  border: '1px solid var(--line)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span style={{ fontSize: 12, color: 'var(--mute)' }}>Hasil Akhir Stok:</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--acc)' }}>
                    {quickStockType === 'in'
                      ? (quickStockProduct.stock + (Number(quickStockQty) || 0))
                      : quickStockType === 'out'
                      ? Math.max(0, quickStockProduct.stock - (Number(quickStockQty) || 0))
                      : (Number(quickStockQty) || 0)
                    } {quickStockProduct.unit}
                  </span>
                </div>

                <div>
                  <label className="label" htmlFor="qs-note">Catatan Penyesuaian (Opsional)</label>
                  <input
                    id="qs-note"
                    className="input"
                    placeholder="Contoh: Sisa display harian, rusak, atau masak batch baru"
                    value={quickStockNote}
                    onChange={e => setQuickStockNote(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 22 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setQuickStockProduct(null)}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={quickStockSaving}
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  {quickStockSaving ? <RefreshCw size={14} className="spin" /> : <Check size={14} />}
                  Simpan Perubahan Stok
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Dialog for Delete */}
      <ConfirmationDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, product: null })}
        onConfirm={confirmDeleteProduct}
        title="Konfirmasi Hapus Produk"
        message={
          deleteConfirm.product ? (
            <>
              Apakah Anda yakin ingin menghapus produk <strong>{deleteConfirm.product.name}</strong>? Tindakan ini tidak dapat dibatalkan.
            </>
          ) : ''
        }
        confirmLabel="Hapus"
        cancelLabel="Batal"
        variant="danger"
        icon="delete"
        isLoading={isDeleting}
      />

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
