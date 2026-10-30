import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import AdminDashboardClient from '@/components/admin/AdminDashboard'
import AdminDashboardSkeleton from '@/components/admin/AdminDashboardSkeleton'

export const metadata = { title: 'Dashboard Admin — Fluxa' }

export default async function AdminDashboardPage() {
  return (
    <Suspense fallback={<AdminDashboardSkeleton />}>
      <AdminDashboardData />
    </Suspense>
  )
}

async function AdminDashboardData() {
  const supabase = await createClient()

  const [
    dailySalesResult,
    lowStockResult,
    recentSalesResult,
    productsResult,
    voidedSalesResult,
    materialsResult
  ] = await Promise.all([
    supabase
      .from('v_daily_sales_summary')
      .select('*')
      .order('sale_date', { ascending: false })
      .limit(7),
    supabase
      .from('v_low_stock_products')
      .select('*')
      .eq('is_low_stock', true)
      .limit(10),
    supabase
      .from('sales')
      .select('id, invoice_number, total_amount, final_amount, payment_method, status, created_at')
      .order('created_at', { ascending: false })
      .limit(8),
    supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true),
    supabase
      .from('sales')
      .select('id, invoice_number, total_amount, final_amount, payment_method, status, void_reason, voided_at, created_at, profiles:cashier_id(full_name)')
      .eq('status', 'voided')
      .order('voided_at', { ascending: false })
      .limit(6),
    supabase
      .from('raw_materials')
      .select('id, name, stock, min_stock, unit')
      .order('stock', { ascending: true })
  ])

  if (dailySalesResult.error || lowStockResult.error || recentSalesResult.error || productsResult.error || voidedSalesResult.error) {
    throw new Error('Data dashboard belum dapat dimuat. Silakan muat ulang halaman.')
  }

  const dailySales = dailySalesResult.data
  const lowStockProducts = lowStockResult.data
  const recentSales = recentSalesResult.data
  const totalProducts = productsResult.count
  const voidedSales = voidedSalesResult.data
  const todayDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
  const todaySummary = dailySales?.find((sale) => sale.sale_date === todayDate) ?? null

  const lowStockMaterials = (materialsResult.data || [])
    .filter(m => Number(m.stock) <= Number(m.min_stock))
    .map(m => ({
      id: m.id,
      name: m.name,
      stock: Number(m.stock),
      min_stock: Number(m.min_stock),
      unit: m.unit
    }))

  return (
    <AdminDashboardClient
      dailySales={[...(dailySales || [])].reverse()}
      lowStockProducts={lowStockProducts || []}
      lowStockMaterials={lowStockMaterials}
      recentSales={recentSales || []}
      voidedSales={voidedSales || []}
      todaySummary={todaySummary}
      totalProducts={totalProducts}
    />
  )
}
