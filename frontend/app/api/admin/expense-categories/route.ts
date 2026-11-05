import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdminClient } from '@backend/index'

const categorySchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).nullable().optional(),
})
const updateCategorySchema = categorySchema.extend({ id: z.string().uuid() })
const deleteCategorySchema = z.object({ id: z.string().uuid() })

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return null
  }
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
    const user = await requireAdminOrOwner()
    if (!user) return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 })

    const admin = getSupabaseAdminClient()
    const { data, error } = await admin
      .from('expense_categories')
      .select('id, name, description, created_at')
      .order('name')
      .limit(100)
    if (error) throw error
    return NextResponse.json({ categories: data ?? [] }, {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch (error) {
    console.error('Unable to load expense categories:', error)
    return NextResponse.json({ error: 'Gagal memuat kategori.' }, { status: 500 })
  }
}

// POST — tambah kategori baru
export async function POST(req: Request) {
  try {
    const user = await requireAdminOrOwner()
    if (!user) return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 })

    const parsed = categorySchema.safeParse(await readJson(req))
    if (!parsed.success) return NextResponse.json({ error: 'Data kategori tidak valid.' }, { status: 400 })

    const admin = getSupabaseAdminClient()
    const { data, error } = await admin
      .from('expense_categories')
      .insert({ name: parsed.data.name, description: parsed.data.description || null })
      .select('id, name, description, created_at')
      .single()
    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'Nama kategori sudah ada.' }, { status: 409 })
      throw error
    }
    return NextResponse.json({ category: data }, { status: 201 })
  } catch (error) {
    console.error('Unable to create expense category:', error)
    return NextResponse.json({ error: 'Gagal menambah kategori.' }, { status: 500 })
  }
}

// PATCH — edit kategori
export async function PATCH(req: Request) {
  try {
    const user = await requireAdminOrOwner()
    if (!user) return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 })

    const parsed = updateCategorySchema.safeParse(await readJson(req))
    if (!parsed.success) return NextResponse.json({ error: 'Data kategori tidak valid.' }, { status: 400 })

    const admin = getSupabaseAdminClient()
    const { data, error } = await admin
      .from('expense_categories')
      .update({ name: parsed.data.name, description: parsed.data.description || null })
      .eq('id', parsed.data.id)
      .select('id, name, description, created_at')
      .single()
    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'Nama kategori sudah ada.' }, { status: 409 })
      throw error
    }
    return NextResponse.json({ category: data })
  } catch (error) {
    console.error('Unable to update expense category:', error)
    return NextResponse.json({ error: 'Gagal memperbarui kategori.' }, { status: 500 })
  }
}

// DELETE — hapus kategori
export async function DELETE(req: Request) {
  try {
    const user = await requireAdminOrOwner()
    if (!user) return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 })

    const parsed = deleteCategorySchema.safeParse(await readJson(req))
    if (!parsed.success) return NextResponse.json({ error: 'ID kategori tidak valid.' }, { status: 400 })

    const admin = getSupabaseAdminClient()

    // Cek apakah kategori masih dipakai
    const { count, error: countError } = await admin
      .from('expenses')
      .select('id', { count: 'exact', head: true })
      .eq('category_id', parsed.data.id)
    if (countError) throw countError
    if (count && count > 0) {
      return NextResponse.json(
        { error: `Kategori tidak bisa dihapus karena masih digunakan oleh ${count} catatan biaya.` },
        { status: 409 }
      )
    }

    const { error } = await admin.from('expense_categories').delete().eq('id', parsed.data.id)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Unable to delete expense category:', error)
    return NextResponse.json({ error: 'Gagal menghapus kategori.' }, { status: 500 })
  }
}
