import { createClient } from '@/lib/supabase/server'
import AdminDashboardClient from '@/components/admin/AdminDashboard'

export const metadata = { title: 'Dashboard Admin — Fluxa' }

export default async function AdminDashboardPage() {
  const supabase = await createClient()

  const { data: dailySales } = await supabase
    .from('v_daily_sales_summary')
    .select('*')
    .order('sale_date', { ascending: false })
    .limit(7)

  const { data: lowStockProducts } = await supabase
    .from('v_low_stock_products')
    .select('*')
    .eq('is_low_stock', true)
    .limit(10)

  const { data: recentSales } = await supabase
    .from('sales')
    .select('id, invoice_number, total_amount, final_amount, payment_method, status, created_at, customers(name)')
    .order('created_at', { ascending: false })
    .limit(8)

  const { count: totalProducts } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)

  const { data: voidedSales } = await supabase
    .from('sales')
    .select('id, invoice_number, total_amount, final_amount, payment_method, status, void_reason, voided_at, created_at, profiles:cashier_id(full_name), customers(name)')
    .eq('status', 'voided')
    .order('voided_at', { ascending: false })
    .limit(6)

  const todaySummary = dailySales?.[0]

  return (
    <AdminDashboardClient
      dailySales={dailySales?.reverse() || []}
      lowStockProducts={lowStockProducts || []}
      recentSales={recentSales || []}
      voidedSales={voidedSales || []}
      todaySummary={todaySummary}
      totalProducts={totalProducts || 0}
    />
  )
}
