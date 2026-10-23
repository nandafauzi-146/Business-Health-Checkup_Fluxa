import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function isUuid(value: unknown): value is string {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

async function getApprovedProfile(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  return supabase
    .from('profiles')
    .select('role, approval_status')
    .eq('id', userId)
    .single()
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Silakan login.' }, { status: 401 })

    const { data: profile } = await getApprovedProfile(supabase, user.id)
    if (profile?.approval_status !== 'approved' || !['kasir', 'admin', 'owner'].includes(profile.role)) {
      return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 })
    }

    let query = supabase
      .from('refund_requests')
      .select('id, sale_id, status, reason, reject_note, created_at, reviewed_at, requested_by, reviewed_by')
      .order('created_at', { ascending: false })

    if (profile.role === 'kasir') query = query.eq('requested_by', user.id)

    const { data, error } = await query
    if (error) throw error

    const saleIds = [...new Set((data || []).map(request => request.sale_id))]
    const profileIds = [...new Set((data || []).flatMap(request =>
      [request.requested_by, request.reviewed_by].filter((id): id is string => Boolean(id)),
    ))]
    const [salesResult, profilesResult] = await Promise.all([
      saleIds.length
        ? supabase.from('sales').select('id, invoice_number, final_amount').in('id', saleIds)
        : Promise.resolve({ data: [], error: null }),
      profileIds.length
        ? supabase.from('profiles').select('id, full_name').in('id', profileIds)
        : Promise.resolve({ data: [], error: null }),
    ])
    if (salesResult.error) throw salesResult.error
    if (profilesResult.error) throw profilesResult.error

    const salesById = new Map((salesResult.data || []).map(sale => [sale.id, sale]))
    const profilesById = new Map((profilesResult.data || []).map(requester => [requester.id, requester]))
    const requests = (data || []).map(request => ({
      ...request,
      sale: salesById.get(request.sale_id) || null,
      requester: profilesById.get(request.requested_by) || null,
      reviewer: request.reviewed_by ? profilesById.get(request.reviewed_by) || null : null,
    }))

    return NextResponse.json({ requests }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Unable to load refund requests:', error)
    return NextResponse.json({ error: 'Pengajuan refund belum dapat dimuat.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Silakan login.' }, { status: 401 })

    const { data: profile } = await getApprovedProfile(supabase, user.id)
    if (profile?.role !== 'kasir' || profile.approval_status !== 'approved') {
      return NextResponse.json({ error: 'Hanya Kasir yang disetujui dapat mengajukan refund.' }, { status: 403 })
    }

    const body: unknown = await request.json()
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Data pengajuan refund tidak valid.' }, { status: 400 })
    }
    const { sale_id, reason } = body as Record<string, unknown>
    if (!isUuid(sale_id) || typeof reason !== 'string' || reason.trim().length < 3 || reason.trim().length > 500) {
      return NextResponse.json({ error: 'Transaksi dan alasan refund (3–500 karakter) wajib diisi.' }, { status: 400 })
    }

    const { data: requestId, error: insertError } = await supabase.rpc('request_sale_refund', {
      p_sale_id: sale_id,
      p_reason: reason.trim(),
    })
    if (insertError) {
      console.error('Unable to create refund request:', insertError)
      const code = insertError.code
      const message = insertError.message.toLowerCase()

      if (code === 'PGRST202' || code === '42883') {
        const { data: sale, error: saleError } = await supabase
          .from('sales')
          .select('id, cashier_id, status')
          .eq('id', sale_id)
          .maybeSingle()
        if (saleError) {
          console.error('Unable to validate sale for refund fallback:', saleError)
          return NextResponse.json(
            { error: 'Transaksi belum dapat divalidasi untuk pengajuan refund. Silakan coba lagi.' },
            { status: 503 },
          )
        }
        if (!sale || sale.cashier_id !== user.id) {
          return NextResponse.json(
            { error: 'Transaksi tidak ditemukan atau Anda tidak memiliki akses untuk mengajukannya.' },
            { status: 404 },
          )
        }
        if (sale.status !== 'completed') {
          return NextResponse.json(
            { error: 'Refund hanya dapat diajukan untuk transaksi yang telah selesai.' },
            { status: 409 },
          )
        }

        const { data: existingRequest, error: existingError } = await supabase
          .from('refund_requests')
          .select('id')
          .eq('sale_id', sale_id)
          .eq('status', 'pending')
          .maybeSingle()
        if (existingError) {
          console.error('Unable to check for an existing refund request:', existingError)
          return NextResponse.json(
            { error: 'Fitur pengajuan refund belum siap. Silakan hubungi Admin.' },
            { status: 503 },
          )
        }
        if (existingRequest) {
          return NextResponse.json(
            { error: 'Pengajuan refund untuk transaksi ini masih menunggu persetujuan Admin.' },
            { status: 409 },
          )
        }

        const { data: fallbackRequest, error: fallbackError } = await supabase
          .from('refund_requests')
          .insert({
            sale_id,
            requested_by: user.id,
            reason: reason.trim(),
            status: 'pending',
          })
          .select('id')
          .single()
        if (fallbackError) {
          console.error('Unable to save refund request through the compatibility path:', fallbackError)
          if (fallbackError.code === '23505') {
            return NextResponse.json(
              { error: 'Pengajuan refund untuk transaksi ini masih menunggu persetujuan Admin.' },
              { status: 409 },
            )
          }
          return NextResponse.json(
            { error: 'Fitur pengajuan refund belum siap. Silakan hubungi Admin.' },
            { status: 503 },
          )
        }

        return NextResponse.json({
          success: true,
          request_id: fallbackRequest.id,
          message: 'Pengajuan refund dikirim untuk ditinjau Admin.',
        }, { status: 201 })
      }
      if (message.includes('sudah ada pengajuan refund')) {
        return NextResponse.json(
          { error: 'Pengajuan refund untuk transaksi ini masih menunggu persetujuan Admin.' },
          { status: 409 },
        )
      }
      if (message.includes('transaksi tidak ditemukan atau bukan milik anda')) {
        return NextResponse.json(
          { error: 'Transaksi tidak ditemukan atau Anda tidak memiliki akses untuk mengajukannya.' },
          { status: 404 },
        )
      }
      if (message.includes('hanya transaksi selesai')) {
        return NextResponse.json(
          { error: 'Refund hanya dapat diajukan untuk transaksi yang telah selesai.' },
          { status: 409 },
        )
      }
      if (message.includes('alasan refund')) {
        return NextResponse.json(
          { error: 'Alasan refund harus berisi 3 hingga 500 karakter.' },
          { status: 400 },
        )
      }
      if (message.includes('hanya kasir')) {
        return NextResponse.json(
          { error: 'Akun Anda belum memiliki akses untuk mengajukan refund.' },
          { status: 403 },
        )
      }
      throw insertError
    }
    if (!requestId) {
      console.error('Refund request RPC returned no request identifier.')
      return NextResponse.json(
        { error: 'Pengajuan refund belum dapat disimpan. Silakan coba lagi.' },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      request_id: requestId,
      message: 'Pengajuan refund dikirim untuk ditinjau Admin.',
    }, { status: 201 })
  } catch (error) {
    console.error('Unable to create refund request:', error)
    return NextResponse.json({ error: 'Pengajuan refund belum dapat disimpan.' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Silakan login.' }, { status: 401 })

    const { data: profile } = await getApprovedProfile(supabase, user.id)
    if (profile?.approval_status !== 'approved' || !['admin', 'owner'].includes(profile.role)) {
      return NextResponse.json({ error: 'Hanya Admin atau Owner yang disetujui dapat memproses refund.' }, { status: 403 })
    }

    const body: unknown = await request.json()
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Data keputusan refund tidak valid.' }, { status: 400 })
    }
    const { request_id, action, reject_note } = body as Record<string, unknown>
    if (!isUuid(request_id) || !['approve', 'reject'].includes(String(action))) {
      return NextResponse.json({ error: 'ID pengajuan atau tindakan tidak valid.' }, { status: 400 })
    }
    if (action === 'reject' && reject_note !== undefined && reject_note !== null && (typeof reject_note !== 'string' || reject_note.length > 500)) {
      return NextResponse.json({ error: 'Catatan penolakan maksimal 500 karakter.' }, { status: 400 })
    }

    if (action === 'approve') {
      const { error: approvalError } = await supabase.rpc('approve_sale_refund_request', {
        p_request_id: request_id,
      })
      if (approvalError) {
        console.error('Unable to approve refund request:', approvalError)
        if (approvalError.code === 'PGRST202' || approvalError.code === '42883') {
          return NextResponse.json(
            { error: 'Persetujuan refund belum siap. Silakan hubungi Admin untuk mengaktifkan proses ini.' },
            { status: 503 },
          )
        }
        if (approvalError.message.toLowerCase().includes('sudah diproses')) {
          return NextResponse.json(
            { error: 'Pengajuan ini sudah diproses. Segarkan daftar untuk melihat status terbaru.' },
            { status: 409 },
          )
        }
        if (approvalError.message.toLowerCase().includes('akses tidak diizinkan')) {
          return NextResponse.json(
            { error: 'Akun Anda belum memiliki akses untuk menyetujui refund.' },
            { status: 403 },
          )
        }
        throw approvalError
      }
      return NextResponse.json({
        success: true,
        message: 'Pengajuan refund disetujui dan transaksi dibatalkan.',
      })
    }

    const updates = {
      status: 'rejected',
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      reject_note: typeof reject_note === 'string' ? reject_note.trim() || null : null,
    }
    const { data: updated, error: updateError } = await supabase
      .from('refund_requests')
      .update(updates)
      .eq('id', request_id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle()
    if (updateError) throw updateError
    if (!updated) return NextResponse.json({ error: 'Pengajuan telah diproses oleh pengguna lain.' }, { status: 409 })

    return NextResponse.json({
      success: true,
      message: 'Pengajuan refund ditolak.',
    })
  } catch (error) {
    console.error('Unable to process refund request:', error)
    return NextResponse.json({
      error: 'Pengajuan refund belum dapat diproses. Silakan coba lagi.',
    }, { status: 500 })
  }
}
