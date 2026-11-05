import { createClient } from '@/lib/supabase/server'
import FinancialReportClient from '@/components/owner/FinancialReport'
import { redirect } from 'next/navigation'

export const metadata = { title: 'Fluxa | Laporan' }

export default async function OwnerLaporanPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('full_name, business_id')
    .eq('id', user.id)
    .single()
  if (profileError) throw new Error('Profil Owner belum dapat dimuat.')
  const { data: business, error: businessError } = profile.business_id
    ? await supabase.from('businesses').select('name').eq('id', profile.business_id).maybeSingle()
    : { data: null, error: null }
  if (businessError) throw new Error('Informasi usaha belum dapat dimuat.')

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

  return (
    <FinancialReportClient
      reports={reports}
      businessName={business?.name ?? undefined}
      generatedBy={profile.full_name}
    />
  )
}
