import { createClient } from '@/lib/supabase/server'
import StockManagementClient from '@/components/admin/StockManagement'

export const metadata = { title: 'Kelola Stok & Mutasi — Fluxa Admin' }

export default async function AdminStokPage() {
  const supabase = await createClient()

  const [productsRes, movementsRes] = await Promise.all([
    supabase
      .from('products')
      .select(`
        id,
        name,
        sku,
        stock,
        min_stock,
        unit,
        sell_price,
        categories (name)
      `)
      .order('name'),
    supabase
      .from('stock_movements')
      .select(`
        id,
        created_at,
        type,
        quantity,
        previous_stock,
        current_stock,
        note,
        products (name)
      `)
      .order('created_at', { ascending: false })
      .limit(100)
  ])

  const formattedProducts = (productsRes.data || []).map((p: any) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    stock: p.stock,
    min_stock: p.min_stock,
    unit: p.unit,
    sell_price: p.sell_price,
    category_name: p.categories?.name || null
  }))

  const formattedMovements = (movementsRes.data || []).map((m: any) => ({
    id: m.id,
    created_at: m.created_at,
    type: m.type,
    quantity: m.quantity,
    previous_stock: m.previous_stock,
    current_stock: m.current_stock,
    note: m.note,
    product_name: m.products?.name || 'Produk'
  }))

  return (
    <StockManagementClient
      initialProducts={formattedProducts}
      initialMovements={formattedMovements}
    />
  )
}
