import { createClient } from '@/lib/supabase/server'
import DebtReceivablesClient, { DebtReceivableItem } from '@/components/admin/DebtReceivables'

export const metadata = { title: 'Kelola Hutang & Piutang Usaha — Fluxa Admin' }

export default async function AdminHutangPiutangPage() {
  const supabase = await createClient()

  let items: DebtReceivableItem[] = []
  try {
    const { data, error } = await supabase
      .from('supplier_payables')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)

    if (!error && data) {
      items = data.map((d: any) => ({
        id: d.id,
        type: (d.type || 'payable') as 'payable' | 'receivable',
        party_name: d.party_name || d.supplier_name || 'Mitra Usaha',
        category: d.category || 'Supplier / Bahan Baku',
        description: d.description || '',
        total_amount: d.total_amount || 0,
        paid_amount: d.paid_amount || 0,
        remaining_amount: (d.total_amount || 0) - (d.paid_amount || 0),
        due_date: d.due_date || null,
        status: (d.status || 'unpaid') as 'unpaid' | 'partial' | 'paid',
        note: d.note || null,
        created_at: d.created_at
      }))
    }
  } catch {
    // Demo fallback inside component
  }

  return <DebtReceivablesClient initialData={items} />
}
