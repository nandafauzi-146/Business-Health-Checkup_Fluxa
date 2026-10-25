import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    return null
  }

  return createSupabaseAdminClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

// GET: Ambil daftar promosi
export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Silakan login.' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, approval_status')
      .eq('id', user.id)
      .single()
    if (profile?.approval_status !== 'approved' || !['kasir', 'admin', 'owner'].includes(profile.role)) {
      return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const activeOnly = searchParams.get('active') === 'true'

    const { data: promotions, error } = await supabase
      .from('promotions')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error

    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
    const result = activeOnly
      ? (promotions || []).filter((promotion: any) =>
          promotion.is_active &&
          promotion.start_date <= today &&
          (!promotion.end_date || promotion.end_date >= today))
      : promotions || []
    return NextResponse.json(
      { success: true, data: result },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    )
  } catch (error: any) {
    console.error('Error loading promotions:', error)
    if (error?.code === 'PGRST205') {
      return NextResponse.json(
        { error: 'Layanan promo belum tersedia saat ini. Silakan coba lagi atau hubungi Admin.' },
        { status: 503 },
      )
    }
    return NextResponse.json(
      { error: 'Promo belum dapat dimuat. Silakan coba lagi.' },
      { status: 500 },
    )
  }
}

// POST: Buat promo baru (Admin & Owner)
export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Silakan login.' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, approval_status')
      .eq('id', user.id)
      .single()

    if (profile?.approval_status !== 'approved' || !['admin', 'owner'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden: Hanya Admin atau Owner yang dapat mengelola promo.' }, { status: 403 })
    }

    const body = await req.json()
    const {
      code,
      name,
      type,
      value,
      min_purchase = 0,
      max_discount = null,
      start_date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date()),
      end_date = null,
      is_active = true,
      description = ''
    } = body

    if (!code || !name || !type || value === undefined) {
      return NextResponse.json({ error: 'Kode, nama promo, tipe, dan nilai diskon wajib diisi.' }, { status: 400 })
    }

    const cleanCode = code.trim().toUpperCase()
    const numValue = parseInt(value)
    const numMin = parseInt(min_purchase) || 0
    const numMax = max_discount ? parseInt(max_discount) : null

    if (numValue <= 0) {
      return NextResponse.json({ error: 'Nilai diskon harus lebih besar dari 0.' }, { status: 400 })
    }

    if (type === 'percentage' && numValue > 100) {
      return NextResponse.json({ error: 'Diskon persentase tidak boleh melebihi 100%.' }, { status: 400 })
    }

    const adminClient = getAdminClient() || supabase
    const { data: newPromoItem, error: insertError } = await adminClient
      .from('promotions')
      .insert({
        code: cleanCode,
        name: name.trim(),
        type,
        value: numValue,
        min_purchase: numMin,
        max_discount: numMax,
        start_date,
        end_date: end_date || null,
        is_active: Boolean(is_active),
        description: description?.trim() || null,
        created_by: user.id
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error saving promotion to database:', insertError)
      return NextResponse.json({ error: 'Promo belum dapat disimpan. Silakan coba lagi.' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Promo ${cleanCode} berhasil disimpan dan aktif untuk terminal Kasir.`,
      data: newPromoItem
    })
  } catch (error: any) {
    console.error('Error creating promotion:', error)
    return NextResponse.json({ error: 'Promo belum dapat disimpan. Silakan coba lagi.' }, { status: 500 })
  }
}

// PATCH: Update promo / toggle status aktif
export async function PATCH(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Data promo tidak valid.' }, { status: 400 })
    }
    const { id } = body

    if (typeof id !== 'string' || !id) {
      return NextResponse.json({ error: 'ID promo wajib disertakan' }, { status: 400 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, approval_status')
      .eq('id', user.id)
      .single()

    if (profile?.approval_status !== 'approved' || !['admin', 'owner'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden: Hanya Admin atau Owner yang dapat mengelola promo.' }, { status: 403 })
    }

    const allowedFields = ['code', 'name', 'type', 'value', 'min_purchase', 'max_discount', 'start_date', 'end_date', 'is_active', 'description'] as const
    const updates: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (Object.hasOwn(body, field)) updates[field] = body[field]
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Tidak ada data promo yang diperbarui.' }, { status: 400 })
    }
    if (typeof updates.code === 'string') updates.code = updates.code.trim().toUpperCase()
    if (typeof updates.name === 'string') updates.name = updates.name.trim()
    for (const field of ['value', 'min_purchase', 'max_discount'] as const) {
      if (updates[field] !== undefined && updates[field] !== null) {
        const value = Number(updates[field])
        if (!Number.isInteger(value) || value < (field === 'value' ? 1 : 0)) {
          return NextResponse.json({ error: `Nilai ${field} harus bilangan bulat yang valid.` }, { status: 400 })
        }
        updates[field] = value
      }
    }
    if (updates.type !== undefined && !['percentage', 'fixed'].includes(String(updates.type))) {
      return NextResponse.json({ error: 'Tipe promo tidak valid.' }, { status: 400 })
    }
    if (updates.value !== undefined && updates.type === 'percentage' && Number(updates.value) > 100) {
      return NextResponse.json({ error: 'Diskon persentase tidak boleh melebihi 100%.' }, { status: 400 })
    }
    if (updates.is_active !== undefined && typeof updates.is_active !== 'boolean') {
      return NextResponse.json({ error: 'Status aktif promo tidak valid.' }, { status: 400 })
    }
    if (updates.description !== undefined && updates.description !== null && typeof updates.description !== 'string') {
      return NextResponse.json({ error: 'Deskripsi promo tidak valid.' }, { status: 400 })
    }
    updates.updated_at = new Date().toISOString()

    const adminClient = getAdminClient() || supabase
    const { data: updatedPromo, error: updateError } = await adminClient
      .from('promotions')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle()

    if (updateError) {
      console.error('Error updating promotion:', updateError)
      return NextResponse.json({ error: 'Promo belum dapat diperbarui. Silakan coba lagi.' }, { status: 500 })
    }
    if (!updatedPromo) {
      return NextResponse.json({ error: 'Promo tidak ditemukan.' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      message: 'Status promo berhasil diperbarui dan disinkronkan ke Kasir.',
      data: updatedPromo
    })
  } catch (error: any) {
    console.error('Unexpected error updating promotion:', error)
    return NextResponse.json({ error: 'Promo belum dapat diperbarui. Silakan coba lagi.' }, { status: 500 })
  }
}

// DELETE: Hapus promo
export async function DELETE(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID promo wajib disertakan' }, { status: 400 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, approval_status')
      .eq('id', user.id)
      .single()

    if (profile?.approval_status !== 'approved' || !['admin', 'owner'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden: Hanya Admin atau Owner yang dapat mengelola promo.' }, { status: 403 })
    }

    const adminClient = getAdminClient() || supabase
    const { data: deletedPromo, error: deleteError } = await adminClient
      .from('promotions')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle()

    if (deleteError) {
      console.error('Error deleting promotion:', deleteError)
      return NextResponse.json({ error: 'Promo belum dapat dihapus. Silakan coba lagi.' }, { status: 500 })
    }
    if (!deletedPromo) {
      return NextResponse.json({ error: 'Promo tidak ditemukan.' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      message: 'Promo berhasil dihapus.'
    })
  } catch (error: any) {
    console.error('Unexpected error deleting promotion:', error)
    return NextResponse.json({ error: 'Promo belum dapat dihapus. Silakan coba lagi.' }, { status: 500 })
  }
}
