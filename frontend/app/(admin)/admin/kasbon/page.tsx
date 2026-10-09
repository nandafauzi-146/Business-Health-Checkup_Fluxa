import { createClient } from '@/lib/supabase/server'
import ReceivablesClient from '@/components/admin/Receivables'

export const metadata = { title: 'Kelola Kasbon & Piutang — Fluxa Admin' }

export default async function AdminKasbonPage() {
  const supabase = await createClient()

  const [receivablesRes, customersRes] = await Promise.all([
    supabase
      .from('receivables')
      .select(`
        id,
        customer_id,
        total_amount,
        paid_amount,
        due_date,
        status,
        note,
        created_at,
        customers (name, phone)
      `)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('customers')
      .select('id, name, phone')
      .order('name')
  ])

  const formattedReceivables = (receivablesRes.data || []).map((r: any) => ({
    id: r.id,
    customer_id: r.customer_id,
    customer_name: r.customers?.name || 'Pelanggan Umum',
    customer_phone: r.customers?.phone || null,
    total_amount: r.total_amount,
    paid_amount: r.paid_amount,
    remaining_amount: r.total_amount - r.paid_amount,
    due_date: r.due_date,
    status: r.status,
    note: r.note,
    created_at: r.created_at
  }))

  return (
    <ReceivablesClient
      initialReceivables={formattedReceivables}
      customers={customersRes.data || []}
    />
  )
}
