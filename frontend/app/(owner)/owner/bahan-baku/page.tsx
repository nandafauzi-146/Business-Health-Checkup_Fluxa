import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import OwnerRawMaterialsHistoryClient, {
  type OwnerRawMaterialItem,
  type OwnerRawMaterialMovement
} from '@/components/owner/OwnerRawMaterialsHistory'

export const metadata = { title: 'Monitoring & Riwayat Bahan Baku — Fluxa Owner' }

export default async function OwnerBahanBakuPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, approval_status, business_id')
    .eq('id', user.id)
    .single()

  if (profileError) {
    throw new Error('Profil pengguna belum dapat diverifikasi.')
  }

  if (profile?.role !== 'owner' && profile?.role !== 'super_admin') {
    redirect('/login')
  }

  const businessId = profile.business_id

  if (!businessId) {
    return (
      <OwnerRawMaterialsHistoryClient
        materials={[]}
        movements={[]}
        loadError="Bisnis Anda belum terdaftar atau belum disetujui."
      />
    )
  }

  // Fetch Bahan Baku & Riwayat Mutasi (Terisolasi strictly untuk tenant owner ini)
  const [materialsRes, movementsRes, ingredientsRes, subIngredientsRes] = await Promise.all([
    supabase
      .from('raw_materials')
      .select('*')
      .eq('business_id', businessId)
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
        created_by,
        raw_materials (name, unit)
      `)
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('product_ingredients')
      .select('raw_material_id, product_id')
      .eq('business_id', businessId),
    supabase
      .from('raw_material_sub_ingredients')
      .select(`
        id,
        parent_material_id,
        sub_material_id,
        quantity,
        unit,
        sub_materials:sub_material_id (id, name, unit, cost_per_unit)
      `)
      .eq('business_id', businessId)
  ])

  const loadError = materialsRes.error
    ? 'Data bahan baku belum dapat dimuat.'
    : null

  // Fetch creator names for movements (Admin/Kasir di bisnis yang sama)
  const creatorIds = [
    ...new Set(
      (movementsRes.data || [])
        .map((m: any) => m.created_by)
        .filter((id): id is string => Boolean(id))
    )
  ]

  let creatorById = new Map<string, { full_name: string; role: string }>()
  if (creatorIds.length > 0) {
    const { data: creators } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('business_id', businessId)
      .in('id', creatorIds)

    if (creators) {
      creatorById = new Map(creators.map(c => [c.id, { full_name: c.full_name, role: c.role }]))
    }
  }

  // Product usage count
  const usageCountMap: Record<string, number> = {}
  if (ingredientsRes.data) {
    for (const item of ingredientsRes.data as any[]) {
      if (item.raw_material_id) {
        usageCountMap[item.raw_material_id] = (usageCountMap[item.raw_material_id] || 0) + 1
      }
    }
  }

  // Sub ingredients map
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

  const formattedMaterials: OwnerRawMaterialItem[] = (materialsRes.data || []).map((m: any) => ({
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
    products_count: usageCountMap[m.id] || 0,
    sub_ingredients: subMap[m.id] || []
  }))

  const formattedMovements: OwnerRawMaterialMovement[] = (movementsRes.data || []).map((mov: any) => {
    const creator = mov.created_by ? creatorById.get(mov.created_by) : null
    return {
      id: mov.id,
      raw_material_id: mov.raw_material_id,
      raw_material_name: mov.raw_materials?.name || 'Bahan Baku',
      unit: mov.raw_materials?.unit || 'gram',
      type: mov.type,
      quantity: Number(mov.quantity) || 0,
      previous_stock: Number(mov.previous_stock) || 0,
      current_stock: Number(mov.current_stock) || 0,
      note: mov.note || null,
      created_at: mov.created_at,
      creator_name: creator?.full_name || 'Staf Toko',
      creator_role: creator?.role || 'admin'
    }
  })

  return (
    <OwnerRawMaterialsHistoryClient
      materials={formattedMaterials}
      movements={formattedMovements}
      loadError={loadError}
    />
  )
}

