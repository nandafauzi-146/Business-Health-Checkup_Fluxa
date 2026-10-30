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

function cleanUUID(val: any): string | null {
  if (!val || typeof val !== 'string') return null
  const trimmed = val.trim()
  if (!trimmed) return null
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(trimmed) ? trimmed : null
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized: Silakan login terlebih dahulu.' },
        { status: 401 }
      )
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, approval_status, full_name, email')
      .eq('id', user.id)
      .single()

    if (profileError || profile?.approval_status !== 'approved') {
      return NextResponse.json(
        { error: 'Akses ditolak: Akun belum disetujui atau tidak aktif.' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const { amount, description, categoryId, shiftId, cashImpact = true, receiptUrl } = body

    const amountNum = typeof amount === 'number' ? amount : parseInt(String(amount).replace(/\D/g, '')) || 0
    if (!amountNum || amountNum <= 0) {
      return NextResponse.json(
        { error: 'Nominal pengeluaran harus lebih besar dari Rp0.' },
        { status: 400 }
      )
    }

    if (typeof description !== 'string' || !description.trim()) {
      return NextResponse.json(
        { error: 'Keterangan atau alasan pengeluaran wajib diisi.' },
        { status: 400 }
      )
    }

    const pureDescription = description.trim()
    const now = new Date()

    const validCategoryId = cleanUUID(categoryId)
    const validShiftId = cleanUUID(shiftId)
    const admin = getServiceClient()

    // 1. Coba lewat RPC submit_cashier_expense jika ada
    try {
      const { data: rpcId, error: rpcErr } = await admin.rpc('submit_cashier_expense', {
        p_amount: amountNum,
        p_description: pureDescription,
        p_category_id: validCategoryId,
        p_shift_id: validShiftId,
        p_cash_impact: cashImpact,
        p_receipt_url: receiptUrl || null,
      })
      if (!rpcErr && rpcId) {
        return NextResponse.json({ success: true, id: rpcId })
      }
    } catch {
      // Lanjut ke insert tabel
    }

    // 2. Insert tabel dengan status approved langsung (tidak perlu verifikasi admin)
    const fullPayload: Record<string, any> = {
      category_id: validCategoryId,
      amount: amountNum,
      description: pureDescription,
      expense_date: now.toISOString().split('T')[0],
      created_by: user.id,
      status: 'approved', // Langsung disetujui tanpa verifikasi admin
      cash_impact: Boolean(cashImpact),
    }

    if (validShiftId) fullPayload.shift_id = validShiftId
    if (receiptUrl) fullPayload.receipt_url = receiptUrl

    const { data: inserted, error: insertErr } = await admin
      .from('expenses')
      .insert(fullPayload)
      .select('id')
      .single()

    if (!insertErr && inserted) {
      return NextResponse.json({ success: true, id: inserted.id })
    }

    // 3. Fallback jika kolom status/shift_id belum ada di schema database
    if (insertErr && (insertErr.code === 'PGRST204' || insertErr.message?.includes('shift_id') || insertErr.message?.includes('status'))) {
      const basicPayload = {
        category_id: validCategoryId,
        amount: amountNum,
        description: pureDescription,
        expense_date: now.toISOString().split('T')[0],
        created_by: user.id,
      }
      const { data: basicInserted, error: basicErr } = await admin
        .from('expenses')
        .insert(basicPayload)
        .select('id')
        .single()

      if (basicErr) throw basicErr
      return NextResponse.json({ success: true, id: basicInserted?.id })
    }

    if (insertErr) throw insertErr
    return NextResponse.json({ error: 'Gagal mencatat pengeluaran.' }, { status: 500 })
  } catch (error: any) {
    console.error('Error submitting cashier expense:', error)
    return NextResponse.json(
      { error: error?.message || 'Pengeluaran belum dapat disimpan. Coba lagi.' },
      { status: 500 }
    )
  }
}
