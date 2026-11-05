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

// PATCH — Perbarui informasi hutang/piutang tanpa mengubah catatan pembayaran.
export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAdminOrOwner()
    if (!auth) {
      return NextResponse.json({ error: 'Akses ditolak. Hanya admin atau owner yang dapat mengubah hutang/piutang.' }, { status: 403 })
    }

    const businessId = auth.profile.business_id
    if (!businessId) {
      return NextResponse.json({ error: 'Akun belum terhubung ke data bisnis.' }, { status: 422 })
    }

    const body = await req.json() as {
      id?: unknown
      party_name?: unknown
      type?: unknown
      category?: unknown
      description?: unknown
      total_amount?: unknown
      due_date?: unknown
      note?: unknown
    }
    if (typeof body.id !== 'string' || !body.id.trim()) {
      return NextResponse.json({ error: 'ID hutang/piutang tidak valid.' }, { status: 400 })
    }

    const partyName = typeof body.party_name === 'string' ? body.party_name.trim() : ''
    const category = typeof body.category === 'string' ? body.category.trim() : ''
    const description = typeof body.description === 'string' ? body.description.trim() : ''
    const type = body.type
    const amount = typeof body.total_amount === 'number' ? body.total_amount : Number(body.total_amount)
    const dueDate = body.due_date === '' || body.due_date === null ? null : body.due_date
    const note = body.note === null || body.note === '' ? null : body.note

    if (!partyName || !category || !description) {
      return NextResponse.json({ error: 'Nama pihak, kategori, dan keterangan wajib diisi.' }, { status: 400 })
    }
    if (type !== 'payable' && type !== 'receivable') {
      return NextResponse.json({ error: 'Jenis transaksi tidak valid.' }, { status: 400 })
    }
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Nominal harus berupa angka bulat lebih dari 0.' }, { status: 400 })
    }
    if (dueDate !== null) {
      if (typeof dueDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
        return NextResponse.json({ error: 'Tanggal jatuh tempo tidak valid.' }, { status: 400 })
      }
      const parsedDueDate = new Date(`${dueDate}T00:00:00.000Z`)
      if (Number.isNaN(parsedDueDate.getTime()) || parsedDueDate.toISOString().slice(0, 10) !== dueDate) {
        return NextResponse.json({ error: 'Tanggal jatuh tempo tidak valid.' }, { status: 400 })
      }
    }
    if (note !== null && typeof note !== 'string') {
      return NextResponse.json({ error: 'Catatan tidak valid.' }, { status: 400 })
    }

    const admin = getServiceClient()
    const { data: current, error: currentError } = await admin
      .from('supplier_payables')
      .select('id, type, total_amount, paid_amount, status, updated_at')
      .eq('id', body.id)
      .eq('business_id', businessId)
      .maybeSingle()
    if (currentError) throw currentError
    if (!current) return NextResponse.json({ error: 'Data hutang/piutang tidak ditemukan.' }, { status: 404 })
    if (amount < current.paid_amount) {
      return NextResponse.json({ error: 'Total nominal tidak boleh lebih kecil dari jumlah yang sudah dibayar.' }, { status: 400 })
    }

    const { count: paymentCount, error: paymentError } = await admin
      .from('supplier_payments')
      .select('id', { count: 'exact', head: true })
      .eq('supplier_payable_id', body.id)
    if (paymentError) throw paymentError
    const hasPaymentHistory = (paymentCount ?? 0) > 0 || current.paid_amount > 0 || current.status !== 'unpaid'
    if (hasPaymentHistory && (amount !== current.total_amount || type !== current.type)) {
      return NextResponse.json({
        error: 'Jenis transaksi dan nominal tidak dapat diubah karena sudah memiliki riwayat pembayaran.',
      }, { status: 409 })
    }

    const { data: updated, error: updateError } = await admin
      .from('supplier_payables')
      .update({
        party_name: partyName,
        supplier_name: partyName,
        type,
        category,
        description,
        total_amount: amount,
        due_date: dueDate,
        note: typeof note === 'string' ? note.trim() || null : null,
      })
      .eq('id', body.id)
      .eq('business_id', businessId)
      .eq('paid_amount', current.paid_amount)
      .eq('status', current.status)
      .eq('updated_at', current.updated_at)
      .select('*')
      .maybeSingle()
    if (updateError) throw updateError
    if (!updated) {
      return NextResponse.json({
        error: 'Data berubah bersamaan dengan proses ini. Muat ulang data lalu coba lagi.',
      }, { status: 409 })
    }

    return NextResponse.json({ item: updated })
  } catch (err: unknown) {
    console.error('[debt-receivables PATCH] Unexpected error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Terjadi kesalahan saat memperbarui hutang/piutang.' }, { status: 500 })
  }
}

// DELETE — Hanya hapus catatan yang belum memiliki pembayaran.
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAdminOrOwner()
    if (!auth) {
      return NextResponse.json({ error: 'Akses ditolak. Hanya admin atau owner yang dapat menghapus hutang/piutang.' }, { status: 403 })
    }

    const businessId = auth.profile.business_id
    if (!businessId) {
      return NextResponse.json({ error: 'Akun belum terhubung ke data bisnis.' }, { status: 422 })
    }

    const body = await req.json() as { id?: unknown }
    if (typeof body.id !== 'string' || !body.id.trim()) {
      return NextResponse.json({ error: 'ID hutang/piutang tidak valid.' }, { status: 400 })
    }

    const admin = getServiceClient()
    const { data: current, error: currentError } = await admin
      .from('supplier_payables')
      .select('id, paid_amount, status')
      .eq('id', body.id)
      .eq('business_id', businessId)
      .maybeSingle()
    if (currentError) throw currentError
    if (!current) return NextResponse.json({ error: 'Data hutang/piutang tidak ditemukan.' }, { status: 404 })

    const { count: paymentCount, error: paymentError } = await admin
      .from('supplier_payments')
      .select('id', { count: 'exact', head: true })
      .eq('supplier_payable_id', body.id)
    if (paymentError) throw paymentError
    if ((paymentCount ?? 0) > 0 || current.paid_amount > 0 || current.status !== 'unpaid') {
      return NextResponse.json({
        error: 'Data tidak dapat dihapus karena sudah memiliki pembayaran atau statusnya bukan Belum Lunas.',
      }, { status: 409 })
    }

    const { data: deleted, error: deleteError } = await admin
      .from('supplier_payables')
      .delete()
      .eq('id', body.id)
      .eq('business_id', businessId)
      .eq('paid_amount', 0)
      .eq('status', 'unpaid')
      .select('id')
      .maybeSingle()
    if (deleteError) throw deleteError
    if (!deleted) {
      return NextResponse.json({
        error: 'Data berubah bersamaan dengan proses ini. Muat ulang data lalu coba lagi.',
      }, { status: 409 })
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    console.error('[debt-receivables DELETE] Unexpected error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Terjadi kesalahan saat menghapus hutang/piutang.' }, { status: 500 })
  }
}
