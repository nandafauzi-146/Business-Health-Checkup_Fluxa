/**
 * /api/admin/debt-receivables
 * API route untuk operasi Hutang & Piutang Usaha (supplier_payables).
 * Menggunakan service client agar business_id dapat disisipkan secara server-side
 * dan tidak tergantung pada RLS client-side yang memerlukan business_id dari pengguna.
 */
import { NextRequest, NextResponse } from 'next/server'
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
/**
 * Memvalidasi sesi dan mengembalikan user + profile + business_id.
 * Hanya admin atau owner yang disetujui yang dapat melanjutkan.
 */
async function requireAdminOrOwner() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, approval_status, business_id')
    .eq('id', user.id)
    .single()

  if (!profile || profile.approval_status !== 'approved') return null
  if (!['admin', 'owner'].includes(profile.role)) return null

  return { user, profile }
}

// ---------------------------------------------------------------------------
// POST — Tambah hutang atau piutang baru
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdminOrOwner()
    if (!auth) {
      return NextResponse.json({ error: 'Akses ditolak. Hanya admin atau owner yang dapat mencatat hutang/piutang.' }, { status: 403 })
    }

    const { user, profile } = auth
    const businessId: string | null = profile.business_id ?? null

    if (!businessId) {
      return NextResponse.json(
        { error: 'Akun belum terhubung ke data bisnis. Hubungi pemilik untuk memeriksa pengaturan akun.' },
        { status: 422 }
      )
    }

    const body = await req.json()
    const {
      party_name,
      type,
      category,
      description,
      total_amount,
      due_date,
      note,
    } = body

    // Validasi field wajib
    if (!party_name?.trim()) {
      return NextResponse.json({ error: 'Nama pihak (supplier/mitra) wajib diisi.' }, { status: 400 })
    }
    if (!description?.trim()) {
      return NextResponse.json({ error: 'Keterangan/deskripsi wajib diisi.' }, { status: 400 })
    }
    if (!type || !['payable', 'receivable'].includes(type)) {
      return NextResponse.json({ error: 'Jenis transaksi tidak valid. Pilih hutang atau piutang.' }, { status: 400 })
    }
    const totalNum = typeof total_amount === 'number' ? total_amount : parseInt(String(total_amount))
    if (isNaN(totalNum) || totalNum <= 0) {
      return NextResponse.json({ error: 'Nominal harus berupa angka lebih dari 0.' }, { status: 400 })
    }

    const admin = getServiceClient()
    const { data: inserted, error } = await admin
      .from('supplier_payables')
      .insert({
        supplier_name: party_name.trim(),
        party_name: party_name.trim(),
        type,
        category: category?.trim() || 'Supplier / Bahan Baku',
        description: description.trim(),
        total_amount: totalNum,
        paid_amount: 0,
        due_date: due_date || null,
        status: 'unpaid',
        note: note?.trim() || null,
        created_by: user.id,
        business_id: businessId,
      })
      .select('*')
      .single()

    if (error) {
      console.error('[debt-receivables POST] DB error:', error.message, error.code)
      return NextResponse.json(
        { error: 'Gagal menyimpan ke database. Silakan coba lagi.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ item: inserted }, { status: 201 })
  } catch (err: any) {
    console.error('[debt-receivables POST] Unexpected error:', err?.message)
    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server. Silakan coba lagi.' },
      { status: 500 }
    )
  }
}
