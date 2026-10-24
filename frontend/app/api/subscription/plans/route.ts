import { NextResponse } from 'next/server'
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('Konfigurasi Supabase server belum lengkap.')
  return createSupabaseAdminClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function GET() {
  try {
    const admin = getServiceClient()
    const { data: plans, error } = await admin
      .from('subscription_plans')
      .select('id, name, description, price, duration_days, max_users, features')
      .eq('is_active', true)
      .order('price', { ascending: true })

    if (error) throw error

    return NextResponse.json({ plans: plans ?? [] }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    })
  } catch (error) {
    console.error('Error loading public subscription plans:', error)
    return NextResponse.json({ error: 'Gagal memuat paket langganan.' }, { status: 500 })
  }
}
