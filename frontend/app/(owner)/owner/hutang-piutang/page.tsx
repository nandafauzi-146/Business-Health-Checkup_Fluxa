import { createClient } from '@/lib/supabase/server'
import ReceivablesAnalysisClient from '@/components/owner/ReceivablesAnalysis'

export const metadata = { title: 'Monitoring Piutang — Fluxa Owner' }

export default async function OwnerHutangPiutangPage() {
  const supabase = await createClient()

  const { data: rawReceivables } = await supabase
    .from('receivables')
    .select(`
      id,
      total_amount,
      paid_amount,
      due_date,
      status,
      created_at,
      customers (name, phone)
    `)
    .neq('status', 'paid')
    .order('total_amount', { ascending: false })

  const now = new Date()
  let totalOutstanding = 0
  let agingCurrent = 0
  let aging1to30 = 0
  let aging30plus = 0

  const customerSet = new Set<string>()

  const formatted = (rawReceivables || []).map((r: any) => {
    const remaining = r.total_amount - r.paid_amount
    totalOutstanding += remaining
    if (r.customers?.name) customerSet.add(r.customers.name)

    let daysOverdue = 0
    if (r.due_date) {
      const dueDate = new Date(r.due_date)
      if (now > dueDate) {
        daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
      }
    }

    if (daysOverdue > 30) {
      aging30plus += remaining
    } else if (daysOverdue > 0) {
      aging1to30 += remaining
    } else {
      agingCurrent += remaining
    }

    return {
      id: r.id,
      customer_name: r.customers?.name || 'Pelanggan Umum',
      customer_phone: r.customers?.phone || null,
      total_amount: r.total_amount,
      paid_amount: r.paid_amount,
      remaining,
      due_date: r.due_date,
      status: r.status,
      days_overdue: daysOverdue
    }
  })

  return (
    <ReceivablesAnalysisClient
      totalOutstanding={totalOutstanding}
      totalCustomersWithDebt={customerSet.size}
      aging={{
        current: agingCurrent,
        overdue1to30: aging1to30,
        overdue30plus: aging30plus
      }}
      receivables={formatted}
    />
  )
}
