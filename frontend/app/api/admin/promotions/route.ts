import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

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

const DATA_FILE = path.join(process.cwd(), 'data', 'promotions.json')

// Data default jika file belum ada
const DEFAULT_PROMOTIONS = [
  {
    id: 'p-1',
    code: 'HEMAT10',
    name: 'Diskon Belanja 10%',
    type: 'percentage',
    value: 10,
    min_purchase: 50000,
    max_discount: 25000,
    start_date: '2026-10-01',
    end_date: null,
    is_active: true,
    description: 'Diskon 10% minimal belanja Rp50.000, maksimal potongan Rp25.000'
  },
  {
    id: 'p-2',
    code: 'FLUXA20K',
    name: 'Potongan Langsung Rp20.000',
    type: 'fixed',
    value: 20000,
    min_purchase: 100000,
    max_discount: null,
    start_date: '2026-10-01',
    end_date: null,
    is_active: true,
    description: 'Potongan langsung Rp20.000 untuk belanja di atas Rp100.000'
  },
  {
    id: 'p-3',
    code: 'MEMBER5K',
    name: 'Spesial Member Baru',
    type: 'fixed',
    value: 5000,
    min_purchase: 25000,
    max_discount: null,
    start_date: '2026-09-01',
    end_date: null,
    is_active: true,
    description: 'Potongan Rp5.000 tanpa syarat khusus untuk pelanggan terdaftar'
  },
  {
    id: 'p-4',
    code: 'PROMOFLASH',
    name: 'Flash Sale 25%',
    type: 'percentage',
    value: 25,
    min_purchase: 75000,
    max_discount: 50000,
    start_date: '2026-10-05',
    end_date: '2026-10-31',
    is_active: true,
    description: 'Flash sale spesial diskon 25%'
  }
]

function readLocalPromotions(): any[] {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, 'utf8')
      const parsed = JSON.parse(content)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
      }
    }
  } catch (err) {
    console.error('Error reading local promotions:', err)
  }
  return DEFAULT_PROMOTIONS
}

function writeLocalPromotions(data: any[]): void {
  try {
    const dir = path.dirname(DATA_FILE)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8')
  } catch (err) {
    console.error('Error writing local promotions:', err)
  }
}

// GET: Ambil daftar promosi
export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(req.url)
    const activeOnly = searchParams.get('active') === 'true'

    // 1. Coba baca dari database Supabase terlebih dahulu
    try {
      const { data: promotions, error } = await supabase
        .from('promotions')
        .select('*')
        .order('created_at', { ascending: false })

      if (!error && promotions && promotions.length > 0) {
        const result = activeOnly ? promotions.filter((p: any) => p.is_active) : promotions
        return NextResponse.json({ success: true, data: result })
      }
    } catch {}

    // 2. Fallback ke file JSON persisten server
    const local = readLocalPromotions()
    const result = activeOnly ? local.filter((p: any) => p.is_active) : local
    return NextResponse.json({ success: true, data: result, source: 'local' })
  } catch (error: any) {
    const local = readLocalPromotions()
    return NextResponse.json({ success: true, data: local, source: 'fallback' })
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
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'owner'].includes(profile.role)) {
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
      start_date = new Date().toISOString().split('T')[0],
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

    const newPromoItem = {
      id: `promo-${Date.now()}`,
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
      created_by: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    // 1. Coba simpan ke Supabase
    let savedToDb = false
    try {
      const adminClient = getAdminClient() || supabase
      const { data: created, error } = await adminClient
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

      if (!error && created) {
        newPromoItem.id = created.id
        savedToDb = true
      }
    } catch {}

    // 2. Simpan juga ke file JSON persisten agar Kasir selalu mendapatkan data yang sama
    const local = readLocalPromotions()
    const existingIndex = local.findIndex((p: any) => p.code === cleanCode)
    if (existingIndex >= 0) {
      local[existingIndex] = newPromoItem
    } else {
      local.unshift(newPromoItem)
    }
    writeLocalPromotions(local)

    return NextResponse.json({
      success: true,
      message: `Promo ${cleanCode} berhasil disimpan dan aktif untuk terminal Kasir.`,
      data: newPromoItem,
      dbSynced: savedToDb
    })
  } catch (error: any) {
    console.error('Error creating promotion:', error)
    return NextResponse.json({ error: error.message || 'Gagal membuat promo' }, { status: 500 })
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
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'ID promo wajib disertakan' }, { status: 400 })
    }

    if (updates.code) {
      updates.code = updates.code.trim().toUpperCase()
    }
    if (updates.value !== undefined) {
      updates.value = parseInt(updates.value)
    }
    if (updates.min_purchase !== undefined) {
      updates.min_purchase = parseInt(updates.min_purchase) || 0
    }
    if (updates.max_discount !== undefined) {
      updates.max_discount = updates.max_discount ? parseInt(updates.max_discount) : null
    }
    if (updates.is_active !== undefined) {
      updates.is_active = Boolean(updates.is_active)
    }
    updates.updated_at = new Date().toISOString()

    // 1. Coba update di Supabase
    try {
      const adminClient = getAdminClient() || supabase
      await adminClient
        .from('promotions')
        .update(updates)
        .eq('id', id)
    } catch {}

    // 2. Update di file JSON persisten
    const local = readLocalPromotions()
    let updatedPromo = null
    const newLocal = local.map((p: any) => {
      if (p.id === id || (updates.code && p.code === updates.code)) {
        updatedPromo = { ...p, ...updates }
        return updatedPromo
      }
      return p
    })

    if (updatedPromo) {
      writeLocalPromotions(newLocal)
    }

    return NextResponse.json({
      success: true,
      message: 'Status promo berhasil diperbarui dan disinkronkan ke Kasir.',
      data: updatedPromo || updates
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal memperbarui promo' }, { status: 500 })
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

    // 1. Coba delete di Supabase
    try {
      const adminClient = getAdminClient() || supabase
      await adminClient
        .from('promotions')
        .delete()
        .eq('id', id)
    } catch {}

    // 2. Delete di file JSON persisten
    const local = readLocalPromotions()
    const newLocal = local.filter((p: any) => p.id !== id)
    writeLocalPromotions(newLocal)

    return NextResponse.json({
      success: true,
      message: 'Promo berhasil dihapus.'
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal menghapus promo' }, { status: 500 })
  }
}
