import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Silakan login.' }, { status: 401 })

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('approval_status, role')
      .eq('id', user.id)
      .single()
    if (profileError || profile?.approval_status !== 'approved') {
      return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 })
    }

    const { data: categories, error } = await supabase
      .from('expense_categories')
      .select('id, name, description')
      .order('name', { ascending: true })

    if (error) throw error

    return NextResponse.json({ categories: categories ?? [] }, {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch (error) {
    console.error('Error loading expense categories:', error)
    return NextResponse.json({ error: 'Gagal memuat kategori pengeluaran.' }, { status: 500 })
  }
}
