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
    const { data: categories, error } = await admin
      .from('expense_categories')
      .select('id, name, description')
      .order('name', { ascending: true })

    if (error) throw error

    return NextResponse.json({ categories: categories ?? [] }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    })
  } catch (error) {
    console.error('Error loading expense categories:', error)
    return NextResponse.json({ error: 'Gagal memuat kategori pengeluaran.' }, { status: 500 })
  }
}
