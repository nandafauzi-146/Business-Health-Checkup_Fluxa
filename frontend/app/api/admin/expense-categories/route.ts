import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('Konfigurasi Supabase server belum lengkap.')
  return createSupabaseAdminClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function requireAdminOrOwner() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, approval_status')
    .eq('id', user.id)
    .single()
  if (!profile || profile.approval_status !== 'approved') return null
  if (!['admin', 'owner'].includes(profile.role)) return null
  return user
}

// GET — daftar semua kategori
export async function GET() {
  try {
    const admin = getServiceClient()
    const { data, error } = await admin
      .from('expense_categories')
      .select('id, name, description, created_at')
      .order('name')
    if (error) throw error
    return NextResponse.json({ categories: data ?? [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Gagal memuat kategori.' }, { status: 500 })
  }
}

// POST — tambah kategori baru
export async function POST(req: Request) {
  try {
    const user = await requireAdminOrOwner()
    if (!user) return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 })

    const { name, description } = await req.json()
    if (!name?.trim()) return NextResponse.json({ error: 'Nama kategori wajib diisi.' }, { status: 400 })

    const admin = getServiceClient()
    const { data, error } = await admin
      .from('expense_categories')
      .insert({ name: name.trim(), description: description?.trim() || null })
      .select('id, name, description, created_at')
      .single()
    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'Nama kategori sudah ada.' }, { status: 409 })
      throw error
    }
    return NextResponse.json({ category: data }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Gagal menambah kategori.' }, { status: 500 })
  }
}

// PATCH — edit kategori
export async function PATCH(req: Request) {
  try {
    const user = await requireAdminOrOwner()
    if (!user) return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 })

    const { id, name, description } = await req.json()
    if (!id) return NextResponse.json({ error: 'ID kategori wajib ada.' }, { status: 400 })
    if (!name?.trim()) return NextResponse.json({ error: 'Nama kategori wajib diisi.' }, { status: 400 })

    const admin = getServiceClient()
    const { data, error } = await admin
      .from('expense_categories')
      .update({ name: name.trim(), description: description?.trim() || null })
      .eq('id', id)
      .select('id, name, description, created_at')
      .single()
    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'Nama kategori sudah ada.' }, { status: 409 })
      throw error
    }
    return NextResponse.json({ category: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Gagal memperbarui kategori.' }, { status: 500 })
  }
}

// DELETE — hapus kategori
export async function DELETE(req: Request) {
  try {
    const user = await requireAdminOrOwner()
    if (!user) return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 })

    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: 'ID kategori wajib ada.' }, { status: 400 })

    const admin = getServiceClient()

    // Cek apakah kategori masih dipakai
    const { count } = await admin
      .from('expenses')
      .select('id', { count: 'exact', head: true })
      .eq('category_id', id)
    if (count && count > 0) {
      return NextResponse.json(
        { error: `Kategori tidak bisa dihapus karena masih digunakan oleh ${count} catatan biaya.` },
        { status: 409 }
      )
    }

    const { error } = await admin.from('expense_categories').delete().eq('id', id)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Gagal menghapus kategori.' }, { status: 500 })
  }
}
