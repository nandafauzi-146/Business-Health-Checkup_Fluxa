import { createClient } from '@/lib/supabase/server'
import OwnerDashboardClient from '@/components/owner/OwnerDashboard'

export const metadata = {
  title: 'Dashboard Owner — Fluxa',
}

function splitIntoBatches(ids: string[], batchSize = 100) {
  return Array.from({ length: Math.ceil(ids.length / batchSize) }, (_, index) =>
    ids.slice(index * batchSize, (index + 1) * batchSize))
}

export default async function OwnerDashboardPage() {
  const supabase = await createClient()
  const now = new Date()
  const jakartaDateParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const year = Number(jakartaDateParts.find((part) => part.type === 'year')?.value)
  const month = Number(jakartaDateParts.find((part) => part.type === 'month')?.value)
  const day = Number(jakartaDateParts.find((part) => part.type === 'day')?.value)
  const sevenDayStart = new Date(Date.UTC(year, month - 1, day - 6, -7)).toISOString()

  const [monthlySummaryResult, dailySalesResult, checkupsResult, lowStockResult, receivablesResult, completedSalesResult] = await Promise.all([
    supabase
      .from('v_monthly_revenue_cogs')
      .select('*')
      .order('month', { ascending: false })
      .limit(6),
    supabase
      .from('v_daily_sales_summary')
      .select('*')
      .order('sale_date', { ascending: false })
      .limit(7),
    supabase
      .from('checkups')
      .select('overall_score, health_status, metrics, ai_recommendations, period_start, period_end, created_at')
      .order('created_at', { ascending: false })
      .limit(1),
    supabase
      .from('v_low_stock_products')
      .select('*', { count: 'exact', head: true })
      .eq('is_low_stock', true),
    supabase
      .from('receivables')
      .select('total_amount, paid_amount')
      .in('status', ['unpaid', 'partial']),
    supabase
      .from('sales')
      .select('id, invoice_number, final_amount, created_at')
      .eq('status', 'completed')
      .gte('created_at', sevenDayStart),
  ])

  if (monthlySummaryResult.error) throw new Error(`Gagal memuat ringkasan bulanan: ${monthlySummaryResult.error.message}`)
  if (dailySalesResult.error) throw new Error(`Gagal memuat penjualan harian: ${dailySalesResult.error.message}`)
  if (checkupsResult.error) throw new Error(`Gagal memuat rapor kesehatan bisnis: ${checkupsResult.error.message}`)
  if (lowStockResult.error) throw new Error(`Gagal memuat peringatan stok: ${lowStockResult.error.message}`)
  if (receivablesResult.error) throw new Error(`Gagal memuat piutang tertunda: ${receivablesResult.error.message}`)
  if (completedSalesResult.error) throw new Error(`Gagal memuat transaksi tujuh hari terakhir: ${completedSalesResult.error.message}`)

  const saleIds = completedSalesResult.data.map((sale) => sale.id)
  const saleItemResults = await Promise.all(splitIntoBatches(saleIds).map((saleIdBatch) =>
    supabase
      .from('sale_items')
      .select('product_id, quantity, subtotal')
      .in('sale_id', saleIdBatch)))

  for (const result of saleItemResults) {
    if (result.error) throw new Error(`Gagal memuat detail produk terjual: ${result.error.message}`)
  }

  const saleItems = saleItemResults.flatMap((result) => result.data ?? [])
  const productIds = [...new Set(saleItems.map((item) => item.product_id))]
  const productResults = await Promise.all(splitIntoBatches(productIds).map((productIdBatch) =>
    supabase
      .from('products')
      .select('id, name, category_id')
      .in('id', productIdBatch)))

  for (const result of productResults) {
    if (result.error) throw new Error(`Gagal memuat nama produk terlaris: ${result.error.message}`)
  }

  const products = productResults.flatMap((result) => result.data ?? [])
  const categoryIds = [...new Set(products
    .map((product) => product.category_id)
    .filter((categoryId): categoryId is string => categoryId !== null))]
  const categoryResults = await Promise.all(splitIntoBatches(categoryIds).map((categoryIdBatch) =>
    supabase
      .from('categories')
      .select('id, name')
      .in('id', categoryIdBatch)))

  for (const result of categoryResults) {
    if (result.error) throw new Error(`Gagal memuat kategori produk: ${result.error.message}`)
  }

  const monthlySummary = monthlySummaryResult.data
  const dailySales = dailySalesResult.data
  const totalPendingReceivables = receivablesResult.data.reduce(
    (sum, receivable) => sum + (receivable.total_amount - receivable.paid_amount),
    0
  )
  const productsById = new Map(products.map((product) => [product.id, product]))
  const categoriesById = new Map(categoryResults.flatMap((result) => result.data ?? []).map((category) => [category.id, category.name]))
  const productTotals = new Map<string, { name: string; quantity: number; revenue: number }>()
  const categoryTotals = new Map<string, { name: string; revenue: number }>()

  for (const item of saleItems) {
    const product = productsById.get(item.product_id)
    if (!product) continue

    const productTotal = productTotals.get(product.id) ?? { name: product.name, quantity: 0, revenue: 0 }
    productTotal.quantity += item.quantity
    productTotal.revenue += item.subtotal
    productTotals.set(product.id, productTotal)

    const categoryId = product.category_id ?? 'uncategorized'
    const categoryTotal = categoryTotals.get(categoryId) ?? {
      name: product.category_id ? categoriesById.get(product.category_id) ?? 'Kategori lain' : 'Tanpa kategori',
      revenue: 0,
    }
    categoryTotal.revenue += item.subtotal
    categoryTotals.set(categoryId, categoryTotal)
  }

  const bestSellingProducts = [...productTotals.entries()]
    .map(([id, product]) => ({ id, ...product }))
    .sort((left, right) => right.quantity - left.quantity || right.revenue - left.revenue)
    .slice(0, 5)
  const categorySales = [...categoryTotals.entries()]
    .map(([id, category]) => ({ id, ...category }))
    .sort((left, right) => right.revenue - left.revenue)

  return (
    <OwnerDashboardClient
      currentMonth={monthlySummary[0] ?? null}
      prevMonth={monthlySummary[1] ?? null}
      monthlySummary={[...monthlySummary].reverse()}
      dailySales={[...dailySales].reverse()}
      latestCheckup={checkupsResult.data[0] ?? null}
      lowStockCount={lowStockResult.count ?? 0}
      totalPendingReceivables={totalPendingReceivables}
      bestSellingProducts={bestSellingProducts}
      categorySales={categorySales}
      recentSales={[...completedSalesResult.data]
        .sort((left, right) => right.created_at.localeCompare(left.created_at))
        .slice(0, 5)}
    />
  )
}
