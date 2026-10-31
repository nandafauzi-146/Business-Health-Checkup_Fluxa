import { createClient } from '@/lib/supabase/server'
import ProductsClient from '@/components/admin/Products'

export const metadata = { title: 'Fluxa | Produk' }

export default async function ProdukPage() {
  const supabase = await createClient()

  const [productsRes, categoriesRes, rawMaterialsRes, ingredientsRes] = await Promise.all([
    supabase
      .from('products')
      .select('*, categories(name)')
      .order('name'),
    supabase
      .from('categories')
      .select('id, name')
      .order('name'),
    supabase
      .from('raw_materials')
      .select('*')
      .order('name'),
    supabase
      .from('product_ingredients')
      .select('id, product_id, raw_material_id, quantity, unit, raw_materials(id, name, unit, stock, min_stock, cost_per_unit)')
  ])

  const loadError = productsRes.error || categoriesRes.error
    ? 'Data produk belum dapat dimuat. Silakan coba lagi.'
    : null

  const formattedIngredients = (ingredientsRes.data || []).map((i: any) => ({
    id: i.id,
    product_id: i.product_id,
    raw_material_id: i.raw_material_id,
    quantity: Number(i.quantity) || 0,
    unit: i.unit,
    raw_materials: Array.isArray(i.raw_materials)
      ? i.raw_materials[0] || null
      : i.raw_materials || null
  }))

  return (
    <ProductsClient
      products={productsRes.data || []}
      categories={categoriesRes.data || []}
      rawMaterials={rawMaterialsRes.data || []}
      initialIngredients={formattedIngredients}
      loadError={loadError}
    />
  )
}
