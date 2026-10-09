import { createClient } from '@/lib/supabase/server'
import StockValuationClient from '@/components/owner/StockValuation'

export const metadata = { title: 'Valuasi Inventaris — Fluxa Owner' }

export default async function OwnerStokPage() {
  const supabase = await createClient()

  const { data: rawProducts } = await supabase
    .from('products')
    .select(`
      id,
      name,
      stock,
      min_stock,
      unit,
      buy_price,
      sell_price,
      categories (name)
    `)
    .eq('is_active', true)
    .order('name')

  let totalAssetValue = 0
  let totalPotentialRevenue = 0
  let totalPotentialProfit = 0
  let lowStockCount = 0

  const products = (rawProducts || []).map((p: any) => {
    const asset_value = p.stock * p.buy_price
    const potential_revenue = p.stock * p.sell_price
    const potential_profit = potential_revenue - asset_value

    totalAssetValue += asset_value
    totalPotentialRevenue += potential_revenue
    totalPotentialProfit += potential_profit

    if (p.stock <= p.min_stock) lowStockCount++

    return {
      id: p.id,
      name: p.name,
      category_name: p.categories?.name || null,
      stock: p.stock,
      min_stock: p.min_stock,
      unit: p.unit,
      buy_price: p.buy_price,
      sell_price: p.sell_price,
      asset_value,
      potential_revenue,
      potential_profit
    }
  })

  return (
    <StockValuationClient
      totalAssetValue={totalAssetValue}
      totalPotentialRevenue={totalPotentialRevenue}
      totalPotentialProfit={totalPotentialProfit}
      lowStockCount={lowStockCount}
      products={products}
    />
  )
}
