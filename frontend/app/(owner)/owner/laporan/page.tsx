import { createClient } from '@/lib/supabase/server'
import FinancialReportClient from '@/components/owner/FinancialReport'

export const metadata = { title: 'Laporan Laba Rugi — Fluxa Owner' }

export default async function OwnerLaporanPage() {
  const supabase = await createClient()

  // Ambil view bulanan pendapatan dan HPP
  const [monthlyRes, expensesRes] = await Promise.all([
    supabase
      .from('v_monthly_revenue_cogs')
      .select('*')
      .order('month', { ascending: false }),
    supabase
      .from('expenses')
      .select('amount, expense_date')
  ])

  const monthlyData = monthlyRes.data || []
  const allExpenses = expensesRes.data || []

  // Agregasikan pengeluaran per bulan
  const expenseMap: Record<string, number> = {}
  allExpenses.forEach((e: any) => {
    const m = e.expense_date.slice(0, 7) // 'YYYY-MM'
    expenseMap[m] = (expenseMap[m] || 0) + e.amount
  })

  // Format reports
  const reports = monthlyData.map((row: any) => {
    const expenses = expenseMap[row.month] || 0
    const net_profit = row.gross_profit - expenses
    const margin_gross = row.gross_revenue > 0 ? (row.gross_profit / row.gross_revenue) * 100 : 0
    const margin_net = row.gross_revenue > 0 ? (net_profit / row.gross_revenue) * 100 : 0

    return {
      month: row.month,
      total_orders: row.total_orders,
      gross_revenue: row.gross_revenue,
      cogs: row.cogs,
      gross_profit: row.gross_profit,
      expenses,
      net_profit,
      margin_gross,
      margin_net
    }
  })

  // Jika data view kosong, berikan fallback bulan saat ini
  const currentMonthStr = new Date().toISOString().slice(0, 7)
  if (reports.length === 0) {
    reports.push({
      month: currentMonthStr,
      total_orders: 0,
      gross_revenue: 0,
      cogs: 0,
      gross_profit: 0,
      expenses: 0,
      net_profit: 0,
      margin_gross: 0,
      margin_net: 0
    })
  }

  return <FinancialReportClient reports={reports} />
}
