import { createClient } from '@/lib/supabase/server'
import SupplierPayablesClient from '@/components/admin/SupplierPayables'

export const metadata = { title: 'Hutang ke Supplier — Fluxa Admin' }

export default async function HutangSupplierPage() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('supplier_payables')
    .select('id, supplier_name, description, total_amount, paid_amount, due_date, status, note, created_at')
    .order('created_at', { ascending: false })
    .limit(100)

  // Jika tabel belum ada (migrasi 0013 belum diterapkan), gunakan array kosong (demo mode)
  const formattedData = error ? [] : (data || []).map((r: any) => ({
    ...r,
    remaining_amount: r.total_amount - r.paid_amount,
  }))

  return <SupplierPayablesClient initialData={formattedData} />
}
