import { createClient } from '@/lib/supabase/server'
import CashflowClient from '@/components/owner/Cashflow'
import type { CashflowProps } from '@/components/owner/Cashflow'

export const metadata = { title: 'Fluxa | Cashflow' }

interface PageResult<T> {
  data: T[] | null
  error: { message: string } | null
}

async function loadAllRows<T>(
  fetchPage: (from: number, to: number) => PromiseLike<PageResult<T>>
) {
  const rows: T[] = []
  const pageSize = 1000

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1)
    if (error) throw new Error(`Gagal memuat data arus kas: ${error.message}`)

    const page = data ?? []
    rows.push(...page)
    if (page.length < pageSize) return rows
  }
}

function getJakartaDate(value: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value))
  const part = (type: string) => parts.find(item => item.type === type)?.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

export default async function OwnerCashflowPage() {
  const supabase = await createClient()
  const dateParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const year = Number(dateParts.find(part => part.type === 'year')?.value)
  const month = Number(dateParts.find(part => part.type === 'month')?.value)
  const today = `${year}-${String(month).padStart(2, '0')}-${String(Number(dateParts.find(part => part.type === 'day')?.value)).padStart(2, '0')}`
  const periodStart = `${year}-${String(month).padStart(2, '0')}-01`
  const periodEndExclusive = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10)
  const startTimestamp = new Date(`${periodStart}T00:00:00+07:00`).toISOString()
  const endTimestamp = new Date(`${periodEndExclusive}T00:00:00+07:00`).toISOString()

  const [sales, expenses, payments] = await Promise.all([
    loadAllRows((from, to) => supabase
      .from('sales')
      .select('id, created_at, final_amount, payment_method, invoice_number')
      .eq('status', 'completed')
      .gte('created_at', startTimestamp)
      .lt('created_at', endTimestamp)
      .order('created_at', { ascending: false })
      .range(from, to)),
    loadAllRows((from, to) => supabase
      .from('expenses')
      .select('id, expense_date, amount, description, created_at')
      .gte('expense_date', periodStart)
      .lt('expense_date', periodEndExclusive)
      .order('expense_date', { ascending: false })
      .range(from, to)),
    loadAllRows((from, to) => supabase
      .from('receivable_payments')
      .select('id, payment_date, amount, payment_method, note')
      .gte('payment_date', startTimestamp)
      .lt('payment_date', endTimestamp)
      .order('payment_date', { ascending: false })
      .range(from, to)),
  ])

  // Hitung total bulanan: penjualan tunai/non-tunai dan pelunasan piutang.
  const cashSalesIn = sales.reduce((sum, sale) => sum + sale.final_amount, 0)

  const receivablePaymentsIn = payments.reduce((sum, payment) => sum + payment.amount, 0)

  const totalIn = cashSalesIn + receivablePaymentsIn
  const totalOut = expenses.reduce((sum, expense) => sum + expense.amount, 0)
  const netCashflow = totalIn - totalOut

  // Tampilkan semua tanggal dari awal bulan sampai hari ini, termasuk hari tanpa transaksi.
  const dateMap: Record<string, { date: string; cash_in: number; cash_out: number; net: number }> = {}
  const startDate = new Date(`${periodStart}T00:00:00Z`)
  const endDate = new Date(`${today}T00:00:00Z`)
  for (const cursor = new Date(startDate); cursor <= endDate; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const date = cursor.toISOString().slice(0, 10)
    dateMap[date] = { date, cash_in: 0, cash_out: 0, net: 0 }
  }

  sales.forEach(sale => {
    const d = getJakartaDate(sale.created_at)
    if (!dateMap[d]) dateMap[d] = { date: d, cash_in: 0, cash_out: 0, net: 0 }
    dateMap[d].cash_in += sale.final_amount
    dateMap[d].net += sale.final_amount
  })

  payments.forEach(payment => {
    const d = getJakartaDate(payment.payment_date)
    if (!dateMap[d]) dateMap[d] = { date: d, cash_in: 0, cash_out: 0, net: 0 }
    dateMap[d].cash_in += payment.amount
    dateMap[d].net += payment.amount
  })

  expenses.forEach(expense => {
    const d = expense.expense_date
    if (!dateMap[d]) dateMap[d] = { date: d, cash_in: 0, cash_out: 0, net: 0 }
    dateMap[d].cash_out += expense.amount
    dateMap[d].net -= expense.amount
  })

  const chartData = Object.values(dateMap)
    .sort((a, b) => a.date.localeCompare(b.date))

  // Gabungkan aktivitas terbaru
  const activities: CashflowProps['recentActivities'] = [
    ...sales.map(sale => ({
      id: sale.id,
      date: sale.created_at,
      type: 'in' as const,
      title: `Transaksi ${sale.invoice_number}`,
      amount: sale.final_amount,
      method: sale.payment_method === 'cash'
        ? 'Tunai'
        : 'Non-Tunai'
    })),
    ...payments.map(payment => ({
      id: payment.id,
      date: payment.payment_date,
      type: 'in' as const,
      title: payment.note || 'Pelunasan piutang',
      amount: payment.amount,
      method: payment.payment_method === 'cash' ? 'Tunai' : 'Non-Tunai',
    })),
    ...expenses.map(expense => ({
      id: expense.id,
      date: expense.created_at || expense.expense_date,
      type: 'out' as const,
      title: expense.description,
      amount: expense.amount,
      method: 'Cash/Transfer'
    }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 20)

  return (
    <CashflowClient
      periodLabel="Bulan ini"
      totalIn={totalIn}
      totalOut={totalOut}
      netCashflow={netCashflow}
      chartData={chartData}
      recentActivities={activities}
    />
  )
}
