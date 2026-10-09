import { createClient } from '@/lib/supabase/server'
import OwnerDashboardClient from '@/components/owner/OwnerDashboard'

export const metadata = {
  title: 'Dashboard Owner — Fluxa',
}

export default async function OwnerDashboardPage() {
  const supabase = await createClient()

  // Fetch monthly revenue/COGS summary
  const { data: monthlySummary } = await supabase
    .from('v_monthly_revenue_cogs')
    .select('*')
    .order('month', { ascending: false })
    .limit(6)

  // Fetch daily sales (last 7 days)
  const { data: dailySales } = await supabase
    .from('v_daily_sales_summary')
    .select('*')
    .order('sale_date', { ascending: false })
    .limit(7)

  // Latest checkup
  const { data: checkups } = await supabase
    .from('checkups')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)

  // Low stock count
  const { count: lowStockCount } = await supabase
    .from('v_low_stock_products')
    .select('*', { count: 'exact', head: true })
    .eq('is_low_stock', true)

  // Pending receivables
  const { data: pendingReceivables } = await supabase
    .from('receivables')
    .select('total_amount, remaining_amount')
    .in('status', ['unpaid', 'partial'])

  const totalPendingReceivables = pendingReceivables?.reduce((sum, r) => sum + r.remaining_amount, 0) || 0

  const latestMonth = monthlySummary?.[0]
  const prevMonth = monthlySummary?.[1]

  return (
    <OwnerDashboardClient
      currentMonth={latestMonth}
      prevMonth={prevMonth}
      monthlySummary={monthlySummary?.reverse() || []}
      dailySales={dailySales?.reverse() || []}
      latestCheckup={checkups?.[0]}
      lowStockCount={lowStockCount || 0}
      totalPendingReceivables={totalPendingReceivables}
    />
  )
}
