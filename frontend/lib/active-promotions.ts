import type { createClient } from '@/lib/supabase/client'

type SupabaseBrowserClient = ReturnType<typeof createClient>

export interface ActivePromotion {
  id: string
  code: string
  name: string
  type: 'percentage' | 'fixed'
  value: number
  min_purchase: number
  max_discount: number | null
  start_date: string
  end_date: string | null
  is_active: boolean
  description: string | null
  created_at: string
  updated_at: string
}

export async function fetchActivePromotions(
  supabase: SupabaseBrowserClient,
): Promise<ActivePromotion[]> {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
  }).format(new Date())
  const { data, error } = await supabase
    .from('promotions')
    .select('*')
    .eq('is_active', true)
    .lte('start_date', today)
    .or(`end_date.is.null,end_date.gte.${today}`)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}
