import { createClient } from '@/lib/supabase/server'
import SupplierPayablesClient from '@/components/admin/SupplierPayables'

export const metadata = { title: 'Hutang ke Supplier — Fluxa Owner' }

export default async function OwnerHutangSupplierPage() {
  const supabase = await createClient()

  let payables: any[] = []
  try {
    const { data, error } = await supabase
      .from('supplier_payables')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)

    if (!error && data) {
      payables = data
    }
  } catch {
    // Demo fallback inside component
  }

  return <SupplierPayablesClient initialData={payables} />
}
