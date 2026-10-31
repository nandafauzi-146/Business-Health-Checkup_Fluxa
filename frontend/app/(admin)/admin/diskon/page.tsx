import { createClient } from '@/lib/supabase/server'
import AdminDiscountsClient, { Promotion } from '@/components/admin/Discounts'

export const metadata = { title: 'Fluxa | Diskon & Promo' }

export default async function AdminDiskonPage() {
  const supabase = await createClient()

  let promotions: Promotion[] = []
  try {
    const { data, error } = await supabase
      .from('promotions')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data) {
      promotions = data as Promotion[]
    }
  } catch (err) {
    console.warn('Could not fetch promotions from database:', err)
  }

  return <AdminDiscountsClient initialPromotions={promotions} />
}
