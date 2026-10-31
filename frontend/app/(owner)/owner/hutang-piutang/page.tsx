import { createClient } from '@/lib/supabase/server'
import DebtReceivablesClient, { DebtReceivableItem } from '@/components/admin/DebtReceivables'

export const metadata = { title: 'Fluxa | Hutang & Piutang' }

export default async function OwnerHutangPiutangPage() {
  const supabase = await createClient()

  const [{ data, error }, { data: catData }] = await Promise.all([
    supabase
      .from('supplier_payables')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('debt_categories')
      .select('id, name')
      .order('name', { ascending: true })
  ])

  const items: DebtReceivableItem[] = (data || []).map((item) => ({
    id: item.id,
    type: item.type || 'payable',
    party_name: item.party_name || item.supplier_name || 'Mitra Usaha',
    category: item.category || 'Supplier / Bahan Baku',
    description: item.description || '',
    total_amount: item.total_amount || 0,
    paid_amount: item.paid_amount || 0,
    remaining_amount: (item.total_amount || 0) - (item.paid_amount || 0),
    due_date: item.due_date || null,
    status: item.status || 'unpaid',
    note: item.note || null,
    created_at: item.created_at
  }))

  const categories = (catData || []).map((c) => ({ id: c.id, name: c.name }))

  return (
    <DebtReceivablesClient
      initialData={items}
      initialCategories={categories}
      loadError={error ? 'Data hutang dan piutang belum dapat dimuat. Silakan coba lagi.' : null}
    />
  )
}
