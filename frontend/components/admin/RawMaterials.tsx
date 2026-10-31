'use client'

import { useState } from 'react'
import {
  Boxes, Plus, Search, AlertCircle, RefreshCw, Edit, Trash2,
  X, Check, History, ArrowDownRight, ArrowUpRight, ArrowRight,
  TrendingDown, Package, Layers, UtensilsCrossed, Sparkles, ChefHat
} from 'lucide-react'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/Topbar'
import { SectionCard, StatusTag } from '@/components/ui/Cards'
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog'
import { createClient } from '@/lib/supabase/client'
import { getUserFacingError } from '@/lib/user-facing-error'

function formatRp(n: number) {
  return 'Rp' + new Intl.NumberFormat('id-ID').format(Math.round(n))
}

export interface SubIngredientItem {
  id?: string
  sub_material_id: string
  quantity: number
  unit: string
  sub_material?: {
    id: string
    name: string
    unit: string
    stock: number
    cost_per_unit: number
  } | null
}

export interface RawMaterialItem {
  id: string
  name: string
  sku: string | null
  material_type: 'raw' | 'semi_finished'
  stock: number
  min_stock: number
  unit: string
  cost_per_unit: number
  batch_yield: number | null
  updated_at: string
  products?: { id: string; name: string }[]
  sub_ingredients?: SubIngredientItem[]
}

export interface RawMaterialMovement {
  id: string
  raw_material_id: string
  type: string
  quantity: number
  previous_stock: number
  current_stock: number
  note: string | null
  created_at: string
  raw_material_name?: string
}

interface FormSubIngredient {
  sub_material_id: string
  quantity: string
  unit: string
}

interface Props {
  initialMaterials: RawMaterialItem[]
  initialMovements: RawMaterialMovement[]
  loadError?: string | null
}

export default function RawMaterialsClient({
  initialMaterials,
  initialMovements,
  loadError
}: Props) {
  const supabase = createClient()
  const [materials, setMaterials] = useState<RawMaterialItem[]>(initialMaterials)
  const [movements, setMovements] = useState<RawMaterialMovement[]>(initialMovements)
  const [search, setSearch] = useState('')
  const [filterTab, setFilterTab] = useState<'all' | 'raw' | 'semi_finished' | 'need_restock' | 'out_of_stock'>('all')

  // Modals
  const [showAddEditDialog, setShowAddEditDialog] = useState(false)
  const [editingMaterial, setEditingMaterial] = useState<RawMaterialItem | null>(null)
  const [saving, setSaving] = useState(false)

  // Adjust / Restock Modal
  const [adjustModalOpen, setAdjustModalOpen] = useState(false)
  const [selectedMaterial, setSelectedMaterial] = useState<RawMaterialItem | null>(null)
  const [adjustType, setAdjustType] = useState<'in' | 'out' | 'adjustment'>('in')
  const [adjustQty, setAdjustQty] = useState<string>('100')
  const [adjustNote, setAdjustNote] = useState('')
  const [adjusting, setAdjusting] = useState(false)

  // Produce Bumbu / Batch Production Modal
  const [produceModalOpen, setProduceModalOpen] = useState(false)
  const [produceMaterial, setProduceMaterial] = useState<RawMaterialItem | null>(null)
  const [produceQty, setProduceQty] = useState<string>('1000')
  const [produceNote, setProduceNote] = useState('')
  const [producing, setProducing] = useState(false)

  // Movements History Modal
  const [historyModalOpen, setHistoryModalOpen] = useState(false)
  const [historyMaterial, setHistoryMaterial] = useState<RawMaterialItem | null>(null)

  // Delete Confirm
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; material: RawMaterialItem | null }>({
    isOpen: false,
    material: null
  })
  const [isDeleting, setIsDeleting] = useState(false)

  // Toast
  const [toast, setToast] = useState<{ type: 'ok' | 'bad'; msg: string } | null>(null)

  // Form State
  const [form, setForm] = useState({
    name: '',
    sku: '',
    material_type: 'raw' as 'raw' | 'semi_finished',
    stock: '0',
    min_stock: '100',
    unit: 'gram',
    cost_per_unit: '0',
    batch_yield: '1000'
  })

  // Sub-ingredients in Form (untuk Bumbu Olahan)
  const [formSubIngredients, setFormSubIngredients] = useState<FormSubIngredient[]>([])

  const showToast = (msg: string, type: 'ok' | 'bad' = 'ok') => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3500)
  }

  // Summary Metrics
  const totalCount = materials.length
  const rawCount = materials.filter(m => m.material_type !== 'semi_finished').length
  const semiCount = materials.filter(m => m.material_type === 'semi_finished').length
  const needRestockCount = materials.filter(m => m.stock <= m.min_stock && m.stock > 0).length
  const outOfStockCount = materials.filter(m => m.stock <= 0).length
  const totalValue = materials.reduce((acc, m) => acc + (m.stock * m.cost_per_unit), 0)

  // Filtered List
  const filteredMaterials = materials.filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(search.toLowerCase()) ||
      (m.sku && m.sku.toLowerCase().includes(search.toLowerCase()))

    let matchesStatus = true
    if (filterTab === 'raw') {
      matchesStatus = m.material_type !== 'semi_finished'
    } else if (filterTab === 'semi_finished') {
      matchesStatus = m.material_type === 'semi_finished'
    } else if (filterTab === 'need_restock') {
      matchesStatus = m.stock <= m.min_stock
    } else if (filterTab === 'out_of_stock') {
      matchesStatus = m.stock <= 0
    }

    return matchesSearch && matchesStatus
  })

  // Calculate Sub-ingredients total cost & HPP per unit
  const calculateSubRecipeCost = (subs: FormSubIngredient[], yieldQty: number) => {
    const totalCost = subs.reduce((acc, item) => {
      const mat = materials.find(m => m.id === item.sub_material_id)
      const qty = Number(item.quantity) || 0
      return acc + (qty * (mat?.cost_per_unit || 0))
    }, 0)
    const costPerUnit = yieldQty > 0 ? totalCost / yieldQty : 0
    return { totalCost, costPerUnit }
  }

  // Handlers
  const handleOpenAdd = () => {
    setEditingMaterial(null)
    setForm({
      name: '',
      sku: '',
      material_type: 'raw',
      stock: '0',
      min_stock: '100',
      unit: 'gram',
      cost_per_unit: '0',
      batch_yield: '1000'
    })
    setFormSubIngredients([])
    setShowAddEditDialog(true)
  }

  const handleOpenEdit = (m: RawMaterialItem) => {
    setEditingMaterial(m)
    setForm({
      name: m.name,
      sku: m.sku || '',
      material_type: m.material_type || 'raw',
      stock: String(m.stock),
      min_stock: String(m.min_stock),
      unit: m.unit,
      cost_per_unit: String(m.cost_per_unit),
      batch_yield: String(m.batch_yield || 1000)
    })

    const existingSubs = (m.sub_ingredients || []).map(s => ({
      sub_material_id: s.sub_material_id,
      quantity: String(s.quantity),
      unit: s.unit
    }))
    setFormSubIngredients(existingSubs)
    setShowAddEditDialog(true)
  }

  const handleAddSubRow = () => {
    // Only raw materials can be used as sub-materials to prevent loops
    const rawList = materials.filter(m => m.id !== editingMaterial?.id)
    const available = rawList.find(m => !formSubIngredients.some(fs => fs.sub_material_id === m.id))
    const chosen = available || rawList[0]

    if (!chosen) {
      showToast('Belum ada bahan mentah penyusun yang terdaftar. Buat bahan mentah terlebih dahulu.', 'bad')
      return
    }

    setFormSubIngredients(prev => [
      ...prev,
      {
        sub_material_id: chosen.id,
        quantity: chosen.unit === 'gram' ? '100' : '1',
        unit: chosen.unit
      }
    ])
  }

  const handleUpdateSubRow = (index: number, field: keyof FormSubIngredient, value: string) => {
    setFormSubIngredients(prev => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      if (field === 'sub_material_id') {
        const mat = materials.find(m => m.id === value)
        if (mat) next[index].unit = mat.unit
      }
      return next
    })
  }

  const handleRemoveSubRow = (index: number) => {
    setFormSubIngredients(prev => prev.filter((_, i) => i !== index))
  }

  const handleSaveMaterial = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = form.name.trim()
    const stock = Number(form.stock) || 0
    const minStock = Number(form.min_stock) || 0
    const unit = form.unit.trim() || 'gram'
    const sku = form.sku.trim() || null
    const batchYield = Number(form.batch_yield) || 1000

    if (!name) {
      showToast('Nama bahan baku wajib diisi.', 'bad')
      return
    }

    // Auto calculate HPP per unit if semi-finished with sub-ingredients
    let costPerUnit = Number(form.cost_per_unit) || 0
    if (form.material_type === 'semi_finished' && formSubIngredients.length > 0) {
      const { costPerUnit: calculatedCost } = calculateSubRecipeCost(formSubIngredients, batchYield)
      if (calculatedCost > 0) {
        costPerUnit = Math.round(calculatedCost * 100) / 100
      }
    }

    setSaving(true)
    try {
      let savedId = ''

      if (editingMaterial) {
        const { data, error } = await supabase
          .from('raw_materials')
          .update({
            name,
            sku,
            material_type: form.material_type,
            min_stock: minStock,
            unit,
            cost_per_unit: costPerUnit,
            batch_yield: form.material_type === 'semi_finished' ? batchYield : null,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingMaterial.id)
          .select('*')
          .single()

        if (error) throw error
        savedId = data.id

        setMaterials(prev => prev.map(item => item.id === editingMaterial.id ? { ...item, ...data } : item))
      } else {
        const initialStock = Number(form.stock) || 0
        const isSemi = form.material_type === 'semi_finished'
        const validSubs = formSubIngredients.filter(s => s.sub_material_id && Number(s.quantity) > 0)
        const hasSubs = isSemi && validSubs.length > 0

        // Jika bumbu olahan dengan stok awal > 0 dan memiliki rempah penyusun:
        // Validasi ketersediaan stok seluruh bahan mentah penyusun sebelum simpan
        if (isSemi && hasSubs && initialStock > 0) {
          const ratio = initialStock / batchYield
          for (const s of validSubs) {
            const mat = materials.find(m => m.id === s.sub_material_id)
            const needed = Number(s.quantity) * ratio
            if (mat && mat.stock < needed) {
              showToast(`Stok bahan mentah "${mat.name}" tidak mencukupi untuk membuat stok awal ${initialStock} ${unit} bumbu (sisa: ${mat.stock} ${mat.unit}, butuh: ${needed} ${mat.unit}).`, 'bad')
              setSaving(false)
              return
            }
          }
        }

        const { data, error } = await supabase
          .from('raw_materials')
          .insert({
            name,
            sku,
            material_type: form.material_type,
            stock: (isSemi && hasSubs && initialStock > 0) ? 0 : initialStock,
            min_stock: minStock,
            unit,
            cost_per_unit: costPerUnit,
            batch_yield: isSemi ? batchYield : null
          })
          .select('*')
          .single()

        if (error) throw error
        savedId = data.id

        // Simpan sub-ingredients untuk bumbu olahan
        if (savedId && isSemi && validSubs.length > 0) {
          const subRows = validSubs.map(s => ({
            parent_material_id: savedId,
            sub_material_id: s.sub_material_id,
            quantity: Number(s.quantity),
            unit: s.unit || 'gram'
          }))

          await supabase.from('raw_material_sub_ingredients').insert(subRows)

          // Jika stok awal > 0, jalankan RPC produce_semi_finished_material agar rempah di database otomatis terpotong
          if (initialStock > 0) {
            const { data: producedStock, error: prodErr } = await supabase.rpc('produce_semi_finished_material', {
              p_material_id: savedId,
              p_produced_quantity: initialStock,
              p_note: 'Stok awal bumbu olahan saat pendaftaran'
            })
            if (prodErr) {
              console.error('Error auto-producing initial bumbu stock:', prodErr)
            } else if (producedStock !== null) {
              data.stock = Number(producedStock)
            }

            // Kurangi stok bahan mentah penyusun di state lokal
            const ratio = initialStock / batchYield
            setMaterials(prev => prev.map(m => {
              const sub = validSubs.find(s => s.sub_material_id === m.id)
              if (sub) {
                const used = Number(sub.quantity) * ratio
                return { ...m, stock: Math.max(0, m.stock - used) }
              }
              return m
            }))
          }

          // Format sub ingredients untuk state lokal
          const formattedSubs: SubIngredientItem[] = validSubs.map(s => {
            const mat = materials.find(m => m.id === s.sub_material_id)
            return {
              sub_material_id: s.sub_material_id,
              quantity: Number(s.quantity),
              unit: s.unit,
              sub_material: mat ? {
                id: mat.id,
                name: mat.name,
                unit: mat.unit,
                stock: mat.stock,
                cost_per_unit: mat.cost_per_unit
              } : null
            }
          })

          data.sub_ingredients = formattedSubs
        }

        setMaterials(prev => [data, ...prev])
      }

      // Update sub-ingredients saat edit bumbu olahan yang sudah ada
      if (editingMaterial && savedId && form.material_type === 'semi_finished') {
        await supabase
          .from('raw_material_sub_ingredients')
          .delete()
          .eq('parent_material_id', savedId)

        const validSubs = formSubIngredients.filter(s => s.sub_material_id && Number(s.quantity) > 0)
        if (validSubs.length > 0) {
          const subRows = validSubs.map(s => ({
            parent_material_id: savedId,
            sub_material_id: s.sub_material_id,
            quantity: Number(s.quantity),
            unit: s.unit || 'gram'
          }))

          await supabase.from('raw_material_sub_ingredients').insert(subRows)

          const formattedSubs: SubIngredientItem[] = validSubs.map(s => {
            const mat = materials.find(m => m.id === s.sub_material_id)
            return {
              sub_material_id: s.sub_material_id,
              quantity: Number(s.quantity),
              unit: s.unit,
              sub_material: mat ? {
                id: mat.id,
                name: mat.name,
                unit: mat.unit,
                stock: mat.stock,
                cost_per_unit: mat.cost_per_unit
              } : null
            }
          })

          setMaterials(prev => prev.map(m => m.id === savedId ? {
            ...m,
            cost_per_unit: costPerUnit,
            sub_ingredients: formattedSubs
          } : m))
        }
      }

      showToast(`Bahan baku "${name}" berhasil disimpan dengan HPP ${formatRp(costPerUnit)}/${unit}!`, 'ok')
      setShowAddEditDialog(false)
    } catch (err: unknown) {
      console.error('Error saving raw material:', err)
      showToast(getUserFacingError(err, 'Gagal menyimpan bahan baku.'), 'bad')
    } finally {
      setSaving(false)
    }
  }

  // Restock / Adjust Stock
  const handleOpenAdjust = (m: RawMaterialItem) => {
    setSelectedMaterial(m)
    setAdjustType('in')
    setAdjustQty(m.unit === 'gram' ? '1000' : '10')
    setAdjustNote('')
    setAdjustModalOpen(true)
  }

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedMaterial) return
    const qty = Number(adjustQty)
    if (isNaN(qty) || qty < 0) {
      showToast('Jumlah takaran harus angka positif.', 'bad')
      return
    }

    setAdjusting(true)
    try {
      const { data: newStock, error } = await supabase.rpc('adjust_raw_material_stock', {
        p_raw_material_id: selectedMaterial.id,
        p_type: adjustType,
        p_quantity: qty,
        p_note: adjustNote.trim() || null
      })

      if (error) throw error

      const finalStock = Number(newStock)
      const isSemi = selectedMaterial.material_type === 'semi_finished'
      const addedQty = adjustType === 'in' ? qty : adjustType === 'adjustment' ? qty - selectedMaterial.stock : 0

      if (isSemi && addedQty > 0 && selectedMaterial.sub_ingredients && selectedMaterial.sub_ingredients.length > 0) {
        const batchYield = selectedMaterial.batch_yield || 1000
        const ratio = addedQty / batchYield
        setMaterials(prev => prev.map(m => {
          if (m.id === selectedMaterial.id) {
            return { ...m, stock: finalStock }
          }
          const sub = selectedMaterial.sub_ingredients?.find(s => s.sub_material_id === m.id)
          if (sub) {
            const used = sub.quantity * ratio
            return { ...m, stock: Math.max(0, m.stock - used) }
          }
          return m
        }))
      } else {
        setMaterials(prev => prev.map(m => m.id === selectedMaterial.id ? { ...m, stock: finalStock } : m))
      }

      const newMov: RawMaterialMovement = {
        id: Math.random().toString(),
        raw_material_id: selectedMaterial.id,
        raw_material_name: selectedMaterial.name,
        type: adjustType,
        quantity: adjustType === 'in' ? qty : adjustType === 'out' ? -qty : qty - selectedMaterial.stock,
        previous_stock: selectedMaterial.stock,
        current_stock: finalStock,
        note: adjustNote.trim() || (adjustType === 'in' ? 'Restock bahan baku' : adjustType === 'out' ? 'Penyusutan bahan' : 'Penyesuaian stok opname'),
        created_at: new Date().toISOString()
      }
      setMovements(prev => [newMov, ...prev])

      showToast(`Stok ${selectedMaterial.name} berhasil diperbarui menjadi ${finalStock} ${selectedMaterial.unit}.`, 'ok')
      setAdjustModalOpen(false)
    } catch (err: unknown) {
      console.error('Error adjusting material stock:', err)
      showToast(getUserFacingError(err, 'Gagal menyesuaikan stok bahan baku.'), 'bad')
    } finally {
      setAdjusting(false)
    }
  }

  // Produce Bumbu Olahan / Batch Production
  const handleOpenProduce = (m: RawMaterialItem) => {
    setProduceMaterial(m)
    setProduceQty(String(m.batch_yield || 1000))
    setProduceNote('')
    setProduceModalOpen(true)
  }

  const handleProduceSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!produceMaterial) return
    const qty = Number(produceQty)
    if (isNaN(qty) || qty <= 0) {
      showToast('Jumlah produksi olahan harus lebih besar dari 0.', 'bad')
      return
    }

    setProducing(true)
    try {
      const { data: newStock, error } = await supabase.rpc('produce_semi_finished_material', {
        p_material_id: produceMaterial.id,
        p_produced_quantity: qty,
        p_note: produceNote.trim() || null
      })

      if (error) throw error

      const finalStock = Number(newStock)

      // Calculate ratio to deduct local sub-material stocks
      const batchYield = produceMaterial.batch_yield || 1000
      const ratio = qty / batchYield

      setMaterials(prev => prev.map(m => {
        if (m.id === produceMaterial.id) {
          return { ...m, stock: finalStock }
        }
        // Deduct raw spices
        const sub = produceMaterial.sub_ingredients?.find(s => s.sub_material_id === m.id)
        if (sub) {
          const used = sub.quantity * ratio
          return { ...m, stock: Math.max(0, m.stock - used) }
        }
        return m
      }))

      showToast(`Berhasil memproduksi ${qty} ${produceMaterial.unit} ${produceMaterial.name}! Stok rempah-rempah otomatis terpotong.`, 'ok')
      setProduceModalOpen(false)
    } catch (err: unknown) {
      console.error('Error producing material:', err)
      showToast(getUserFacingError(err, 'Gagal memproduksi bumbu olahan. Pastikan stok rempah mencukupi.'), 'bad')
    } finally {
      setProducing(false)
    }
  }

  const confirmDeleteMaterial = async () => {
    const m = deleteConfirm.material
    if (!m) return
    setIsDeleting(true)
    try {
      const { error } = await supabase
        .from('raw_materials')
        .delete()
        .eq('id', m.id)

      if (error) throw error

      setMaterials(prev => prev.filter(item => item.id !== m.id))
      showToast(`Bahan baku "${m.name}" berhasil dihapus.`, 'ok')
    } catch (err: unknown) {
      console.error('Error deleting material:', err)
      showToast(getUserFacingError(err, 'Gagal menghapus bahan baku. Kemungkinan sedang digunakan dalam resep produk atau bumbu olahan.'), 'bad')
    } finally {
      setIsDeleting(false)
      setDeleteConfirm({ isOpen: false, material: null })
    }
  }

  const handleOpenHistory = (m: RawMaterialItem) => {
    setHistoryMaterial(m)
    setHistoryModalOpen(true)
  }

  const subRecipeCalculations = calculateSubRecipeCost(
    formSubIngredients,
    Number(form.batch_yield) || 1000
  )

  return (
    <div>
      <PageHeader
        title="Bahan Baku & Bumbu Olahan"
        subtitle="Manajemen stok bahan mentah, resep bumbu olahan (setengah jadi), dan pemantauan restock otomatis"
        actions={
          <button
            className="btn btn-primary"
            onClick={handleOpenAdd}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={16} /> Tambah Bahan / Bumbu
          </button>
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

      {toast && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 9999,
          padding: '12px 18px',
          background: toast.type === 'ok' ? 'var(--ok)' : 'var(--bad)',
          color: '#fff',
          borderRadius: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
          fontSize: 13,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          animation: 'slideUp 0.2s ease-out'
        }}>
          {toast.type === 'ok' ? <Check size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* Restock Urgent Banner */}
      {(needRestockCount > 0 || outOfStockCount > 0) && (
        <div style={{
          padding: '16px 20px',
          background: outOfStockCount > 0 ? 'rgba(239, 68, 68, 0.08)' : 'rgba(245, 158, 11, 0.08)',
          border: `1px solid ${outOfStockCount > 0 ? 'var(--bad)' : 'var(--warn)'}`,
          borderRadius: 14,
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: outOfStockCount > 0 ? 'var(--bads)' : 'var(--warns)',
              color: outOfStockCount > 0 ? 'var(--bad)' : 'var(--warn)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <AlertCircle size={22} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>
                Peringatan Restock Bahan Baku!
              </div>
              <div style={{ fontSize: 12, color: 'var(--mute)', marginTop: 2 }}>
                Terdapat {outOfStockCount > 0 ? `${outOfStockCount} bahan habis (0)` : ''}
                {outOfStockCount > 0 && needRestockCount > 0 ? ' dan ' : ''}
                {needRestockCount > 0 ? `${needRestockCount} bahan menipis di bawah batas minimum.` : ' segera lakukan pengadaan.'}
              </div>
            </div>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setFilterTab('need_restock')}
            style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            Filter Bahan Perlu Restock <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
        <div style={{ padding: '16px 18px', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--mute)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Boxes size={15} /> Total Bahan ({rawCount} Mentah, {semiCount} Bumbu)
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, marginTop: 6, color: 'var(--ink)' }}>
            {totalCount} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--mute)' }}>item</span>
          </div>
        </div>

        <div style={{
          padding: '16px 18px',
          background: needRestockCount > 0 ? 'var(--warns)' : 'var(--panel)',
          border: `1px solid ${needRestockCount > 0 ? 'var(--warn)' : 'var(--line)'}`,
          borderRadius: 14
        }}>
          <div style={{ fontSize: 12, color: needRestockCount > 0 ? 'var(--warn)' : 'var(--mute)', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
            <AlertCircle size={15} /> Perlu Restock
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, marginTop: 6, color: needRestockCount > 0 ? 'var(--warn)' : 'var(--ink)' }}>
            {needRestockCount} <span style={{ fontSize: 13, fontWeight: 500 }}>bahan</span>
          </div>
        </div>

        <div style={{
          padding: '16px 18px',
          background: outOfStockCount > 0 ? 'var(--bads)' : 'var(--panel)',
          border: `1px solid ${outOfStockCount > 0 ? 'var(--bad)' : 'var(--line)'}`,
          borderRadius: 14
        }}>
          <div style={{ fontSize: 12, color: outOfStockCount > 0 ? 'var(--bad)' : 'var(--mute)', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
            <TrendingDown size={15} /> Stok Habis (0)
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, marginTop: 6, color: outOfStockCount > 0 ? 'var(--bad)' : 'var(--ink)' }}>
            {outOfStockCount} <span style={{ fontSize: 13, fontWeight: 500 }}>bahan</span>
          </div>
        </div>

        <div style={{ padding: '16px 18px', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--mute)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Package size={15} /> Total Nilai Bahan
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 6, color: 'var(--acc)' }}>
            {formatRp(totalValue)}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 16
      }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, background: 'var(--bg)', padding: 4, borderRadius: 10, border: '1px solid var(--line)', flexWrap: 'wrap' }}>
          <button
            onClick={() => setFilterTab('all')}
            className={`btn btn-sm ${filterTab === 'all' ? 'btn-primary' : ''}`}
            style={{ fontSize: 12, border: 'none', background: filterTab === 'all' ? undefined : 'transparent', color: filterTab === 'all' ? undefined : 'var(--mute)' }}
          >
            Semua ({totalCount})
          </button>
          <button
            onClick={() => setFilterTab('raw')}
            className={`btn btn-sm ${filterTab === 'raw' ? 'btn-primary' : ''}`}
            style={{ fontSize: 12, border: 'none', background: filterTab === 'raw' ? undefined : 'transparent', color: filterTab === 'raw' ? undefined : 'var(--mute)' }}
          >
            Bahan Mentah ({rawCount})
          </button>
          <button
            onClick={() => setFilterTab('semi_finished')}
            className={`btn btn-sm ${filterTab === 'semi_finished' ? 'btn-primary' : ''}`}
            style={{ fontSize: 12, border: 'none', background: filterTab === 'semi_finished' ? undefined : 'transparent', color: filterTab === 'semi_finished' ? undefined : 'var(--mute)' }}
          >
            🧂 Bumbu Olahan ({semiCount})
          </button>
          <button
            onClick={() => setFilterTab('need_restock')}
            className={`btn btn-sm ${filterTab === 'need_restock' ? 'btn-primary' : ''}`}
            style={{
              fontSize: 12,
              border: 'none',
              background: filterTab === 'need_restock' ? undefined : 'transparent',
              color: needRestockCount > 0 ? 'var(--warn)' : 'var(--mute)',
              fontWeight: needRestockCount > 0 ? 700 : 500
            }}
          >
            Perlu Restock ({needRestockCount})
          </button>
          <button
            onClick={() => setFilterTab('out_of_stock')}
            className={`btn btn-sm ${filterTab === 'out_of_stock' ? 'btn-primary' : ''}`}
            style={{
              fontSize: 12,
              border: 'none',
              background: filterTab === 'out_of_stock' ? undefined : 'transparent',
              color: outOfStockCount > 0 ? 'var(--bad)' : 'var(--mute)'
            }}
          >
            Habis ({outOfStockCount})
          </button>
        </div>

        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 240 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 12px',
            background: 'var(--panel)',
            border: '1px solid var(--line)',
            borderRadius: 8,
            width: '100%'
          }}>
            <Search size={14} color="var(--mute)" />
            <input
              type="text"
              placeholder="Cari bahan atau bumbu..."
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
        </div>
      </div>

      {/* Materials Table */}
      <SectionCard title={`Daftar Bahan Baku & Bumbu (${filteredMaterials.length})`}>
        <div className="table-container">
          <table className="data-table" style={{ minWidth: 840 }}>
            <thead>
              <tr>
                <th>Nama Bahan / Bumbu</th>
                <th>Tipe</th>
                <th>Stok Saat Ini</th>
                <th>Batas Min. Restock</th>
                <th>Harga Modal / Satuan</th>
                <th>Total Nilai</th>
                <th>Penggunaan / Komposisi</th>
                <th style={{ textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredMaterials.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '36px 0', color: 'var(--mute)' }}>
                    Tidak ada bahan baku yang cocok dengan filter / pencarian
                  </td>
                </tr>
              ) : (
                filteredMaterials.map(m => {
                  const isOutOfStock = m.stock <= 0
                  const isLowStock = m.stock <= m.min_stock
                  const isSemi = m.material_type === 'semi_finished'
                  const statusTag = isOutOfStock ? 'kritis' : isLowStock ? 'menipis' : 'aman'
                  const statusLabel = isOutOfStock ? 'Habis' : isLowStock ? 'Perlu Restock' : 'Aman'

                  return (
                    <tr key={m.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 36,
                            height: 36,
                            borderRadius: 8,
                            background: isSemi ? 'rgba(168, 85, 247, 0.12)' : isOutOfStock ? 'var(--bads)' : isLowStock ? 'var(--warns)' : 'var(--accs)',
                            color: isSemi ? '#9333ea' : isOutOfStock ? 'var(--bad)' : isLowStock ? 'var(--warn)' : 'var(--acc)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            {isSemi ? <ChefHat size={18} /> : <Boxes size={18} />}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>
                              {m.name}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--mute)' }}>
                              Satuan: <strong>{m.unit}</strong> {m.sku ? `• SKU: ${m.sku}` : ''}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 600,
                          background: isSemi ? 'rgba(168, 85, 247, 0.1)' : 'var(--bg)',
                          color: isSemi ? '#9333ea' : 'var(--mute)',
                          border: `1px solid ${isSemi ? 'rgba(168, 85, 247, 0.3)' : 'var(--line)'}`
                        }}>
                          {isSemi ? '🧂 Bumbu Olahan' : '🥩 Bahan Mentah'}
                        </span>
                      </td>

                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{
                            fontWeight: 800,
                            fontSize: 14,
                            color: isOutOfStock ? 'var(--bad)' : isLowStock ? 'var(--warn)' : 'var(--ink)'
                          }}>
                            {new Intl.NumberFormat('id-ID').format(m.stock)}
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--mute)' }}>{m.unit}</span>
                          <StatusTag status={statusTag} label={statusLabel} />
                        </div>
                      </td>

                      <td>
                        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--mute)' }}>
                          {new Intl.NumberFormat('id-ID').format(m.min_stock)} {m.unit}
                        </span>
                      </td>

                      <td style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 600 }}>
                        {formatRp(m.cost_per_unit)} / {m.unit}
                      </td>

                      <td style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>
                        {formatRp(m.stock * m.cost_per_unit)}
                      </td>

                      <td>
                        {isSemi ? (
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: '#9333ea', marginBottom: 2 }}>
                              Dari: {m.sub_ingredients?.length || 0} rempah
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                              {m.sub_ingredients?.map((s, idx) => (
                                <span
                                  key={idx}
                                  style={{
                                    fontSize: 10,
                                    padding: '1px 5px',
                                    borderRadius: 4,
                                    background: 'var(--bg)',
                                    color: 'var(--ink)',
                                    border: '1px solid var(--line)'
                                  }}
                                >
                                  {s.sub_material?.name || 'Rempah'} ({s.quantity}{s.unit})
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : m.products && m.products.length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {m.products.map(p => (
                              <span
                                key={p.id}
                                style={{
                                  fontSize: 11,
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                  background: 'var(--bg)',
                                  color: 'var(--ink)',
                                  border: '1px solid var(--line)'
                                }}
                              >
                                {p.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--mute)' }}>—</span>
                        )}
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          {isSemi ? (
                            <>
                              <button
                                className="btn btn-sm"
                                onClick={() => handleOpenProduce(m)}
                                title="Olah / Restock Bumbu Basah dari Bahan Mentah"
                                style={{
                                  background: '#9333ea',
                                  color: '#fff',
                                  fontWeight: 600,
                                  fontSize: 11,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 4
                                }}
                              >
                                <ChefHat size={12} /> Restock / Olah Bumbu
                              </button>
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleOpenAdjust(m)}
                                title="Koreksi / Sesuaikan Stok Bumbu"
                              >
                                <RefreshCw size={12} />
                              </button>
                            </>
                          ) : (
                            <button
                              className="btn btn-sm"
                              onClick={() => handleOpenAdjust(m)}
                              title="Restock / Sesuaikan Stok"
                              style={{
                                background: isLowStock ? 'var(--warn)' : 'var(--acc)',
                                color: '#fff',
                                fontWeight: 600,
                                fontSize: 11,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4
                              }}
                            >
                              <RefreshCw size={12} /> Restock
                            </button>
                          )}
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleOpenHistory(m)}
                            title="Riwayat Mutasi Bahan"
                          >
                            <History size={12} />
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleOpenEdit(m)}
                            title="Edit Bahan Baku"
                          >
                            <Edit size={12} />
                          </button>
                          <button
                            className="btn btn-sm"
                            onClick={() => setDeleteConfirm({ isOpen: true, material: m })}
                            title="Hapus Bahan Baku"
                            style={{ background: 'transparent', border: '1px solid var(--line)', color: 'var(--bad)', cursor: 'pointer' }}
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

      {/* Add / Edit Material Modal */}
      {showAddEditDialog && (
        <div className="dialog-overlay" onClick={e => e.target === e.currentTarget && setShowAddEditDialog(false)}>
          <div className="dialog" style={{ maxWidth: 640, maxHeight: 'calc(100dvh - 32px)', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700 }}>
                  {editingMaterial ? 'Edit Bahan / Bumbu' : 'Tambah Bahan Baku / Bumbu Olahan'}
                </h2>
                <p style={{ fontSize: 12, color: 'var(--mute)', marginTop: 2 }}>
                  Tentukan tipe bahan, takaran satuan, dan batas restock untuk pemantauan inventaris
                </p>
              </div>
              <button className="icon-btn" onClick={() => setShowAddEditDialog(false)} aria-label="Tutup dialog">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveMaterial}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Tipe Bahan Selector */}
                <div>
                  <label className="label">Tipe Bahan</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, material_type: 'raw' }))}
                      style={{
                        padding: '12px 14px',
                        borderRadius: 12,
                        border: `1.5px solid ${form.material_type === 'raw' ? 'var(--acc)' : 'var(--line)'}`,
                        background: form.material_type === 'raw' ? 'var(--accs)' : 'var(--bg)',
                        color: form.material_type === 'raw' ? 'var(--acc)' : 'var(--ink)',
                        cursor: 'pointer',
                        textAlign: 'left'
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Boxes size={15} /> Bahan Mentah Biasa
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--mute)', marginTop: 3 }}>
                        Beras, Daging, Telur, Kunyit, Bawang, Minyak, Garam
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, material_type: 'semi_finished' }))}
                      style={{
                        padding: '12px 14px',
                        borderRadius: 12,
                        border: `1.5px solid ${form.material_type === 'semi_finished' ? '#9333ea' : 'var(--line)'}`,
                        background: form.material_type === 'semi_finished' ? 'rgba(168, 85, 247, 0.12)' : 'var(--bg)',
                        color: form.material_type === 'semi_finished' ? '#9333ea' : 'var(--ink)',
                        cursor: 'pointer',
                        textAlign: 'left'
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <ChefHat size={15} /> Bumbu Olahan / Setengah Jadi
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--mute)', marginTop: 3 }}>
                        Bumbu Kuning, Kuah Soto, Saus Balado, Adonan Bakso
                      </div>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="label" htmlFor="mat-name">
                    {form.material_type === 'semi_finished' ? 'Nama Bumbu Olahan *' : 'Nama Bahan Baku *'}
                  </label>
                  <input
                    id="mat-name"
                    required
                    className="input"
                    placeholder={form.material_type === 'semi_finished' ? "Contoh: Bumbu Kuning Basah, Kuah Kaldu Spesial" : "Contoh: Beras, Bawang Merah, Kunyit, Daging Ayam"}
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  />
                </div>

                <div className="form-grid-2">
                  <div>
                    <label className="label" htmlFor="mat-sku">SKU / Kode Bahan</label>
                    <input
                      id="mat-sku"
                      className="input"
                      placeholder="Opsional (misal: BB-KNG-01)"
                      value={form.sku}
                      onChange={e => setForm(f => ({ ...f, sku: e.target.value }))}
                    />
                  </div>

                  <div>
                    <label className="label" htmlFor="mat-unit">Satuan Takaran *</label>
                    <select
                      id="mat-unit"
                      className="input"
                      value={form.unit}
                      onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                      style={{ cursor: 'pointer' }}
                    >
                      <option value="gram">gram (g)</option>
                      <option value="kg">kilogram (kg)</option>
                      <option value="ml">mililiter (ml)</option>
                      <option value="liter">liter (l)</option>
                      <option value="butir">butir</option>
                      <option value="pcs">pcs / biji</option>
                      <option value="porsi">porsi</option>
                    </select>
                  </div>
                </div>

                {/* ======================================================== */}
                {/* SUB-RESEP BUMBU OLAHAN (JIKA TIPE SEMI_FINISHED)         */}
                {/* ======================================================== */}
                {form.material_type === 'semi_finished' && (
                  <div style={{
                    padding: 16,
                    background: 'rgba(168, 85, 247, 0.05)',
                    border: '1px solid rgba(168, 85, 247, 0.25)',
                    borderRadius: 14
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <ChefHat size={18} color="#9333ea" />
                        <span style={{ fontSize: 13.5, fontWeight: 700, color: '#9333ea' }}>
                          Komposisi Rempah Pembuat Bumbu
                        </span>
                      </div>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={handleAddSubRow}
                        style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
                      >
                        <Plus size={12} /> Tambah Rempah
                      </button>
                    </div>

                    <p style={{ fontSize: 11.5, color: 'var(--mute)', marginBottom: 12 }}>
                      Tentukan bahan mentah dasar (misal kunir, bawang merah, bawang putih, kemiri) untuk membuat 1 batch bumbu olahan ini. HPP bumbu akan dihitung secara otomatis.
                    </p>

                    <div style={{ marginBottom: 12 }}>
                      <label className="label" style={{ fontSize: 11.5 }}>
                        Hasil Jadi 1 Batch ({form.unit})
                      </label>
                      <input
                        className="input"
                        type="number"
                        step="any"
                        value={form.batch_yield}
                        onChange={e => setForm(f => ({ ...f, batch_yield: e.target.value }))}
                        placeholder="1000"
                      />
                    </div>

                    {formSubIngredients.length === 0 ? (
                      <div style={{
                        padding: 14,
                        textAlign: 'center',
                        background: 'var(--panel)',
                        borderRadius: 10,
                        border: '1px dashed var(--line)',
                        fontSize: 12,
                        color: 'var(--mute)'
                      }}>
                        Belum ada rempah penyusun. Klik <strong>"+ Tambah Rempah"</strong> di atas.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {formSubIngredients.map((sub, idx) => {
                          const mat = materials.find(m => m.id === sub.sub_material_id)
                          const qty = Number(sub.quantity) || 0
                          const subCost = (mat?.cost_per_unit || 0) * qty

                          return (
                            <div
                              key={idx}
                              style={{
                                padding: '8px 10px',
                                background: 'var(--panel)',
                                border: '1px solid var(--line)',
                                borderRadius: 10,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8
                              }}
                            >
                              <div style={{ flex: 2 }}>
                                <select
                                  className="input"
                                  value={sub.sub_material_id}
                                  onChange={e => handleUpdateSubRow(idx, 'sub_material_id', e.target.value)}
                                  style={{ fontSize: 12, padding: '5px 8px' }}
                                >
                                  {materials
                                    .filter(m => m.id !== editingMaterial?.id)
                                    .map(m => (
                                      <option key={m.id} value={m.id}>
                                        {m.name} ({m.stock} {m.unit} @ {formatRp(m.cost_per_unit)}/{m.unit})
                                      </option>
                                    ))}
                                </select>
                              </div>

                              <div style={{ width: 90 }}>
                                <input
                                  className="input"
                                  type="number"
                                  step="any"
                                  value={sub.quantity}
                                  onChange={e => handleUpdateSubRow(idx, 'quantity', e.target.value)}
                                  style={{ fontSize: 12, padding: '5px 8px' }}
                                />
                              </div>

                              <span style={{ fontSize: 11, color: 'var(--mute)', width: 45 }}>
                                {sub.unit}
                              </span>

                              <div style={{ width: 90, fontSize: 12, fontWeight: 700, textAlign: 'right', color: 'var(--ink)' }}>
                                {formatRp(subCost)}
                              </div>

                              <button
                                type="button"
                                onClick={() => handleRemoveSubRow(idx)}
                                className="icon-btn"
                                style={{ color: 'var(--bad)', cursor: 'pointer' }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )
                        })}

                        {/* Calculation preview */}
                        <div style={{
                          padding: '10px 12px',
                          background: 'var(--bg)',
                          borderRadius: 10,
                          border: '1px solid rgba(168, 85, 247, 0.3)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginTop: 6
                        }}>
                          <span style={{ fontSize: 12, color: 'var(--mute)' }}>
                            Total Biaya 1 Batch ({form.batch_yield} {form.unit}):
                          </span>
                          <span style={{ fontSize: 13, fontWeight: 800, color: '#9333ea' }}>
                            {formatRp(subRecipeCalculations.totalCost)} &rarr; HPP: {formatRp(subRecipeCalculations.costPerUnit)} / {form.unit}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="form-grid-2">
                  {!editingMaterial && (
                    <div>
                      <label className="label" htmlFor="mat-stock">Stok Awal Siap Pakai</label>
                      <input
                        id="mat-stock"
                        className="input"
                        type="number"
                        step="any"
                        placeholder="0"
                        value={form.stock}
                        onChange={e => setForm(f => ({ ...f, stock: e.target.value }))}
                      />
                    </div>
                  )}

                  <div>
                    <label className="label" htmlFor="mat-min">
                      Batas Min. Stok (Restock Alert) *
                    </label>
                    <input
                      id="mat-min"
                      required
                      className="input"
                      type="number"
                      step="any"
                      placeholder="100"
                      value={form.min_stock}
                      onChange={e => setForm(f => ({ ...f, min_stock: e.target.value }))}
                    />
                  </div>

                  {form.material_type !== 'semi_finished' && (
                    <div>
                      <label className="label" htmlFor="mat-cost">
                        Biaya Modal Beli per {form.unit} (Rp)
                      </label>
                      <input
                        id="mat-cost"
                        className="input"
                        type="number"
                        step="any"
                        placeholder="0"
                        value={form.cost_per_unit}
                        onChange={e => setForm(f => ({ ...f, cost_per_unit: e.target.value }))}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-footer-sticky">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAddEditDialog(false)}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  {saving ? <RefreshCw size={14} className="spin" /> : <Check size={14} />}
                  {editingMaterial ? 'Simpan Perubahan' : 'Simpan Bahan / Bumbu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Produce Semi-Finished Material Modal (Olah Bumbu Basah) */}
      {produceModalOpen && produceMaterial && (
        <div className="dialog-overlay" onClick={e => e.target === e.currentTarget && setProduceModalOpen(false)}>
          <div className="dialog" style={{ maxWidth: 540, maxHeight: 'calc(100dvh - 32px)', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ChefHat size={20} color="#9333ea" />
                  <h2 style={{ fontSize: 18, fontWeight: 700 }}>
                    Olah / Masak: {produceMaterial.name}
                  </h2>
                </div>
                <p style={{ fontSize: 12, color: 'var(--mute)', marginTop: 2 }}>
                  Produksi bumbu olahan dari stok rempah mentah di gudang
                </p>
              </div>
              <button className="icon-btn" onClick={() => setProduceModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleProduceSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label className="label">
                    Jumlah yang Ingin Dibuat ({produceMaterial.unit}) *
                  </label>
                  <input
                    required
                    className="input"
                    type="number"
                    step="any"
                    value={produceQty}
                    onChange={e => setProduceQty(e.target.value)}
                  />
                </div>

                {/* Spices Required Preview */}
                <div>
                  <label className="label" style={{ marginBottom: 6 }}>
                    Rempah yang Akan Dipotong dari Stok Gudang:
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {(produceMaterial.sub_ingredients || []).map((sub, idx) => {
                      const mat = materials.find(m => m.id === sub.sub_material_id)
                      const batchYield = produceMaterial.batch_yield || 1000
                      const ratio = (Number(produceQty) || 0) / batchYield
                      const needed = Math.round(sub.quantity * ratio * 100) / 100
                      const isShort = mat ? mat.stock < needed : false

                      return (
                        <div
                          key={idx}
                          style={{
                            padding: '8px 12px',
                            borderRadius: 8,
                            background: 'var(--bg)',
                            border: `1px solid ${isShort ? 'var(--bad)' : 'var(--line)'}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                          }}
                        >
                          <div>
                            <span style={{ fontWeight: 600, fontSize: 12.5, color: 'var(--ink)' }}>
                              {mat?.name || 'Rempah'}
                            </span>
                            <span style={{ fontSize: 11, color: isShort ? 'var(--bad)' : 'var(--mute)', marginLeft: 8 }}>
                              (Sisa stok: {mat ? mat.stock : 0} {sub.unit})
                            </span>
                          </div>

                          <div style={{ fontWeight: 700, fontSize: 13, color: isShort ? 'var(--bad)' : 'var(--ink)' }}>
                            -{needed} {sub.unit} {isShort && '⚠️ Kurang'}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <label className="label">Catatan Olahan (Opsional)</label>
                  <input
                    className="input"
                    placeholder="Contoh: Batch masak untuk persiapan akhir pekan"
                    value={produceNote}
                    onChange={e => setProduceNote(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setProduceModalOpen(false)}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={producing}
                  className="btn btn-primary"
                  style={{ background: '#9333ea', borderColor: '#9333ea', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  {producing ? <RefreshCw size={14} className="spin" /> : <Check size={14} />}
                  Konfirmasi Selesai Masak
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Restock / Adjust Stock Modal */}
      {adjustModalOpen && selectedMaterial && (
        <div className="dialog-overlay" onClick={e => e.target === e.currentTarget && setAdjustModalOpen(false)}>
          <div className="dialog" style={{ maxWidth: 480, maxHeight: 'calc(100dvh - 32px)', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700 }}>
                  Restock / Sesuaikan Stok Bahan Baku
                </h2>
                <p style={{ fontSize: 12, color: 'var(--mute)', marginTop: 2 }}>
                  Bahan: <strong>{selectedMaterial.name}</strong> (Sisa stok: {selectedMaterial.stock} {selectedMaterial.unit})
                </p>
              </div>
              <button className="icon-btn" onClick={() => setAdjustModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAdjustSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label className="label">Pilih Aksi Stok</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setAdjustType('in')}
                      style={{
                        padding: '10px 8px',
                        borderRadius: 10,
                        border: `1.5px solid ${adjustType === 'in' ? 'var(--ok)' : 'var(--line)'}`,
                        background: adjustType === 'in' ? 'var(--oks)' : 'var(--bg)',
                        color: adjustType === 'in' ? 'var(--ok)' : 'var(--ink)',
                        fontWeight: 600,
                        fontSize: 12,
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 4
                      }}
                    >
                      <ArrowDownRight size={16} />
                      Restock Masuk (+)
                    </button>

                    <button
                      type="button"
                      onClick={() => setAdjustType('out')}
                      style={{
                        padding: '10px 8px',
                        borderRadius: 10,
                        border: `1.5px solid ${adjustType === 'out' ? 'var(--bad)' : 'var(--line)'}`,
                        background: adjustType === 'out' ? 'var(--bads)' : 'var(--bg)',
                        color: adjustType === 'out' ? 'var(--bad)' : 'var(--ink)',
                        fontWeight: 600,
                        fontSize: 12,
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 4
                      }}
                    >
                      <ArrowUpRight size={16} />
                      Penyusutan / Rusak (-)
                    </button>

                    <button
                      type="button"
                      onClick={() => setAdjustType('adjustment')}
                      style={{
                        padding: '10px 8px',
                        borderRadius: 10,
                        border: `1.5px solid ${adjustType === 'adjustment' ? 'var(--acc)' : 'var(--line)'}`,
                        background: adjustType === 'adjustment' ? 'var(--accs)' : 'var(--bg)',
                        color: adjustType === 'adjustment' ? 'var(--acc)' : 'var(--ink)',
                        fontWeight: 600,
                        fontSize: 12,
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 4
                      }}
                    >
                      <RefreshCw size={16} />
                      Opname Fisik (=)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="label" htmlFor="adj-qty">
                    Jumlah ({selectedMaterial.unit}) *
                  </label>
                  <input
                    id="adj-qty"
                    required
                    className="input"
                    type="number"
                    step="any"
                    value={adjustQty}
                    onChange={e => setAdjustQty(e.target.value)}
                  />
                </div>

                <div style={{
                  padding: '12px 14px',
                  background: 'var(--bg)',
                  borderRadius: 10,
                  border: '1px solid var(--line)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span style={{ fontSize: 12, color: 'var(--mute)' }}>Stok Setelah Penyesuaian:</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--acc)' }}>
                    {adjustType === 'in'
                      ? (selectedMaterial.stock + (Number(adjustQty) || 0))
                      : adjustType === 'out'
                      ? Math.max(0, selectedMaterial.stock - (Number(adjustQty) || 0))
                      : (Number(adjustQty) || 0)
                    } {selectedMaterial.unit}
                  </span>
                </div>

                <div>
                  <label className="label" htmlFor="adj-note">Catatan Penyesuaian (Opsional)</label>
                  <input
                    id="adj-note"
                    className="input"
                    placeholder="Contoh: Beli dari Pasar 5 kg, atau bahan kadaluarsa"
                    value={adjustNote}
                    onChange={e => setAdjustNote(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setAdjustModalOpen(false)}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={adjusting}
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  {adjusting ? <RefreshCw size={14} className="spin" /> : <Check size={14} />}
                  Konfirmasi Update Stok
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Modal */}
      {historyModalOpen && historyMaterial && (
        <div className="dialog-overlay" onClick={e => e.target === e.currentTarget && setHistoryModalOpen(false)}>
          <div className="dialog" style={{ maxWidth: 640, maxHeight: 'calc(100dvh - 32px)', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700 }}>
                  Riwayat Mutasi: {historyMaterial.name}
                </h2>
                <p style={{ fontSize: 12, color: 'var(--mute)', marginTop: 2 }}>
                  Log otomatis pemakaian saat penjualan di kasir, produksi bumbu, dan restock
                </p>
              </div>
              <button className="icon-btn" onClick={() => setHistoryModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ maxHeight: 380, overflowY: 'auto' }}>
              {movements.filter(m => m.raw_material_id === historyMaterial.id).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--mute)', fontSize: 13 }}>
                  Belum ada catatan mutasi untuk bahan baku ini.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {movements
                    .filter(m => m.raw_material_id === historyMaterial.id)
                    .map(mov => (
                      <div
                        key={mov.id}
                        style={{
                          padding: '10px 14px',
                          borderRadius: 10,
                          border: '1px solid var(--line)',
                          background: 'var(--bg)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                            {mov.note || (mov.type === 'in' ? 'Restock bahan' : mov.type === 'sale_usage' ? 'Pemakaian penjualan' : mov.type === 'production' ? 'Produksi bumbu' : 'Penyesuaian stok')}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--mute)', marginTop: 2 }}>
                            {new Date(mov.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                            {' • '}
                            Stok: {mov.previous_stock} &rarr; <strong>{mov.current_stock}</strong> {historyMaterial.unit}
                          </div>
                        </div>

                        <div style={{
                          fontWeight: 700,
                          fontSize: 13,
                          color: mov.quantity > 0 ? 'var(--ok)' : 'var(--bad)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4
                        }}>
                          {mov.quantity > 0 ? `+${mov.quantity}` : mov.quantity} {historyMaterial.unit}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setHistoryModalOpen(false)}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmationDialog
        isOpen={deleteConfirm.isOpen}
        title="Hapus Bahan Baku?"
        message={`Apakah Anda yakin ingin menghapus bahan baku "${deleteConfirm.material?.name}"? Produk atau resep bumbu yang menggunakan bahan ini mungkin akan terpengaruh.`}
        confirmLabel="Hapus Bahan"
        cancelLabel="Batal"
        variant="danger"
        icon="delete"
        isLoading={isDeleting}
        onConfirm={confirmDeleteMaterial}
        onClose={() => setDeleteConfirm({ isOpen: false, material: null })}
      />
    </div>
  )
}
