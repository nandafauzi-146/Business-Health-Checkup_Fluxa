import { createClient } from '@/lib/supabase/server'
import CashflowClient from '@/components/owner/Cashflow'

export const metadata = { title: 'Cashflow — Fluxa Owner' }

export default async function OwnerCashflowPage() {
  const supabase = await createClient()

  // Ambil data penjualan (kas masuk)
  const [salesRes, expensesRes, payRes] = await Promise.all([
    supabase
      .from('sales')
      .select('id, created_at, final_amount, payment_method, invoice_number')
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('expenses')
      .select('id, expense_date, amount, description, created_at')
      .order('expense_date', { ascending: false })
      .limit(100),
    supabase
      .from('receivable_payments')
      .select('id, payment_date, amount, payment_method, note')
      .order('payment_date', { ascending: false })
      .limit(50)
  ])

  const sales = salesRes.data || []
  const expenses = expensesRes.data || []
  const payments = payRes.data || []

  // Hitung total kas masuk: penjualan (kecuali piutang/credit yang belum cair) + pelunasan piutang
  const cashSalesIn = sales
    .filter((s: any) => s.payment_method !== 'credit')
    .reduce((sum: number, s: any) => sum + s.final_amount, 0)

  const receivablePaymentsIn = payments
    .reduce((sum: number, p: any) => sum + p.amount, 0)

  const totalIn = cashSalesIn + receivablePaymentsIn
  const totalOut = expenses.reduce((sum: number, e: any) => sum + e.amount, 0)
  const netCashflow = totalIn - totalOut

  // Susun data grafik per tanggal (7 hari terakhir atau tanggal unik)
  const dateMap: Record<string, { date: string; cash_in: number; cash_out: number; net: number }> = {}

  sales.forEach((s: any) => {
    if (s.payment_method === 'credit') return
    const d = s.created_at.split('T')[0]
    if (!dateMap[d]) dateMap[d] = { date: d, cash_in: 0, cash_out: 0, net: 0 }
    dateMap[d].cash_in += s.final_amount
    dateMap[d].net += s.final_amount
  })

  payments.forEach((p: any) => {
    const d = p.payment_date.split('T')[0]
    if (!dateMap[d]) dateMap[d] = { date: d, cash_in: 0, cash_out: 0, net: 0 }
    dateMap[d].cash_in += p.amount
    dateMap[d].net += p.amount
  })

  expenses.forEach((e: any) => {
    const d = e.expense_date
    if (!dateMap[d]) dateMap[d] = { date: d, cash_in: 0, cash_out: 0, net: 0 }
    dateMap[d].cash_out += e.amount
    dateMap[d].net -= e.amount
  })

  const chartData = Object.values(dateMap)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-14)

  // Gabungkan aktivitas terbaru
  const activities: any[] = [
    ...sales.slice(0, 15).map((s: any) => ({
      id: s.id,
      date: s.created_at,
      type: 'in',
      title: `Penjualan ${s.invoice_number}`,
      amount: s.final_amount,
      method: s.payment_method
    })),
    ...expenses.slice(0, 15).map((e: any) => ({
      id: e.id,
      date: e.created_at || e.expense_date,
      type: 'out',
      title: e.description,
      amount: e.amount,
      method: 'Cash/Transfer'
    }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 20)

  return (
    <CashflowClient
      totalIn={totalIn}
      totalOut={totalOut}
      netCashflow={netCashflow}
      chartData={chartData}
      recentActivities={activities}
    />
  )
}
