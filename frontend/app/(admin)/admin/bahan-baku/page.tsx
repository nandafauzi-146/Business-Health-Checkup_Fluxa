import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import RawMaterialsClient, { type RawMaterialItem, type RawMaterialMovement } from '@/components/admin/RawMaterials'

export const metadata = { title: 'Fluxa | Bahan Baku' }

export default async function BahanBakuPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, approval_status, business_id')
    .eq('id', user.id)
    .single()

  if (!profile || profile.approval_status !== 'approved') {
    redirect('/login')
  }

  // Jika owner membuka link pengelolaan bahan baku admin, alihkan ke halaman monitoring riwayat khusus owner
  if (profile.role === 'owner') {
    redirect('/owner/bahan-baku')
  }

  // Pengelolaan bahan baku dan resep hanya dapat digunakan oleh admin
  if (profile.role !== 'admin' && profile.role !== 'super_admin') {
    redirect('/login')
  }

  const [materialsRes, movementsRes, ingredientsRes, subIngredientsRes] = await Promise.all([
    supabase
      .from('raw_materials')
      .select('*')
      .order('name'),
    supabase
      .from('raw_material_movements')
      .select(`
        id,
        raw_material_id,
        type,
        quantity,
        previous_stock,
        current_stock,
        note,
        created_at,
        raw_materials (name)
      `)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('product_ingredients')
      .select(`
        raw_material_id,
        products (id, name)
      `),
    supabase
      .from('raw_material_sub_ingredients')
      .select(`
        id,
        parent_material_id,
        sub_material_id,
        quantity,
        unit,
        sub_materials:sub_material_id (id, name, unit, stock, cost_per_unit, density)
      `)
  ])

  const loadError = materialsRes.error
    ? 'Data bahan baku belum dapat dimuat. Pastikan migrasi database terbaru telah diterapkan.'
    : null

  // Map product usage to raw materials
  const productMap: Record<string, { id: string; name: string }[]> = {}
  if (ingredientsRes.data) {
    for (const item of ingredientsRes.data as any[]) {
      if (item.raw_material_id && item.products) {
        if (!productMap[item.raw_material_id]) {
          productMap[item.raw_material_id] = []
        }
        productMap[item.raw_material_id].push({
          id: item.products.id,
          name: item.products.name
        })
      }
    }
  }

  // Map sub-ingredients (rempah penyusun bumbu olahan)
  const subMap: Record<string, any[]> = {}
  if (subIngredientsRes.data) {
    for (const sub of subIngredientsRes.data as any[]) {
      if (!subMap[sub.parent_material_id]) {
        subMap[sub.parent_material_id] = []
      }
      subMap[sub.parent_material_id].push({
        id: sub.id,
        sub_material_id: sub.sub_material_id,
        quantity: Number(sub.quantity) || 0,
        unit: sub.unit,
        sub_material: Array.isArray(sub.sub_materials)
          ? sub.sub_materials[0] || null
          : sub.sub_materials || null
      })
    }
  }

  const formattedMaterials: RawMaterialItem[] = (materialsRes.data || []).map((m: any) => ({
    id: m.id,
    name: m.name,
    sku: m.sku || null,
    material_type: m.material_type || 'raw',
    stock: Number(m.stock) || 0,
    min_stock: Number(m.min_stock) || 0,
    unit: m.unit || 'gram',
    cost_per_unit: Number(m.cost_per_unit) || 0,
    batch_yield: m.batch_yield ? Number(m.batch_yield) : 1000,
    updated_at: m.updated_at,
    products: productMap[m.id] || [],
    sub_ingredients: subMap[m.id] || []
  }))

  const formattedMovements: RawMaterialMovement[] = (movementsRes.data || []).map((mov: any) => ({
    id: mov.id,
    raw_material_id: mov.raw_material_id,
    type: mov.type,
    quantity: Number(mov.quantity) || 0,
    previous_stock: Number(mov.previous_stock) || 0,
    current_stock: Number(mov.current_stock) || 0,
    note: mov.note || null,
    created_at: mov.created_at,
    raw_material_name: mov.raw_materials?.name || 'Bahan Baku'
  }))

  return (
    <RawMaterialsClient
      initialMaterials={formattedMaterials}
      initialMovements={formattedMovements}
      loadError={loadError}
    />
  )
}
