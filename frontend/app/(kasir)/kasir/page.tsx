import { createClient } from '@/lib/supabase/server'
import POSClient from '@/components/pos/POSClient'

export const metadata = { title: 'Fluxa | Kasir' }

export default async function KasirPage() {
  const supabase = await createClient()

  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('*, categories(name)')
    .eq('is_active', true)
    .order('name')

  // Check active shift
  const { data: { user } } = await supabase.auth.getUser()
  let activeShift = null
  let cashierName = 'Kasir'
  if (user) {
    const [{ data: shifts }, { data: profile, error: profileError }] = await Promise.all([
      supabase
        .from('shifts')
        .select('*')
        .eq('cashier_id', user.id)
        .eq('status', 'open')
        .limit(1),
      supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single(),
    ])
    if (profileError) console.error('Error fetching cashier name for POS receipt:', profileError)
    activeShift = shifts?.[0] || null
    cashierName = profile?.full_name || 'Kasir'
  }

  return (
    <POSClient
      products={products || []}
      productsError={productsError ? 'Data produk belum dapat dimuat.' : null}
      activeShift={activeShift}
      userId={user?.id || ''}
      cashierName={cashierName}
    />
  )
}
