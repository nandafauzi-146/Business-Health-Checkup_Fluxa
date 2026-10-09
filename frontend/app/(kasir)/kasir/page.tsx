import { createClient } from '@/lib/supabase/server'
import POSClient from '@/components/pos/POSClient'

export const metadata = { title: 'Kasir / POS — Fluxa' }

export default async function KasirPage() {
  const supabase = await createClient()

  const { data: products } = await supabase
    .from('products')
    .select('*, categories(name)')
    .eq('is_active', true)
    .order('name')

  const { data: customers } = await supabase
    .from('customers')
    .select('id, name, phone')
    .order('name')

  // Check active shift
  const { data: { user } } = await supabase.auth.getUser()
  let activeShift = null
  if (user) {
    const { data: shifts } = await supabase
      .from('shifts')
      .select('*')
      .eq('cashier_id', user.id)
      .eq('status', 'open')
      .limit(1)
    activeShift = shifts?.[0] || null
  }

  return (
    <POSClient
      products={products || []}
      customers={customers || []}
      activeShift={activeShift}
      userId={user?.id || ''}
    />
  )
}
