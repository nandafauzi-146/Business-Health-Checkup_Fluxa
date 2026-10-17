import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// In-memory fallback jika tabel refund_requests belum di-create di database Supabase
declare global {
  var __refund_requests_store: any[] | undefined
}
if (!globalThis.__refund_requests_store) {
  globalThis.__refund_requests_store = []
}

function getAdminSupa() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createAdminClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

// GET — admin mengambil daftar pengajuan refund
export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized: profil tidak ditemukan.' }, { status: 401 })
    }

    const isPrivileged = ['admin', 'owner'].includes(profile.role)

    const adminSupa = getAdminSupa()
    if (!adminSupa) {
      const store = globalThis.__refund_requests_store || []
      const filtered = isPrivileged ? store : store.filter((r: any) => r.requested_by === user.id)
      return NextResponse.json({ requests: filtered })
    }

    // 1. Coba query ke tabel database Supabase
    try {
      let query = adminSupa
        .from('refund_requests')
        .select(`
          id, status, reason, reject_note, created_at, reviewed_at,
          requested_by, reviewed_by,
          sale:sale_id (
            id, invoice_number, final_amount, payment_method, created_at
          ),
          requester:requested_by (
            full_name
          )
        `)
        .order('created_at', { ascending: false })

      // Jika kasir, hanya ambil pengajuan miliknya sendiri
      if (!isPrivileged) {
        query = query.eq('requested_by', user.id)
      }

      const { data: requests, error } = await query

      if (!error && requests) {
        return NextResponse.json({ requests })
      }
    } catch (e) {
      // Tabel belum ada, lanjut ke fallback di bawah
    }

    // 2. Fallback memory store jika tabel belum ada di Supabase
    const allStore = globalThis.__refund_requests_store || []
    const store = isPrivileged ? allStore : allStore.filter((r: any) => r.requested_by === user.id)
    const populated = await Promise.all(
      store.map(async (item) => {
        try {
          const { data: sale } = await adminSupa
            .from('sales')
            .select('id, invoice_number, final_amount, payment_method, created_at')
            .eq('id', item.sale_id)
            .maybeSingle()

          const { data: requester } = await adminSupa
            .from('profiles')
            .select('full_name')
            .eq('id', item.requested_by)
            .maybeSingle()

          return {
            ...item,
            sale: sale || {
              id: item.sale_id,
              invoice_number: item.invoice_number || 'INV-POS',
              final_amount: item.amount || 0,
              payment_method: item.payment_method || 'cash',
              created_at: item.created_at
            },
            requester: requester || { full_name: 'Kasir' }
          }
        } catch {
          return item
        }
      })
    )

    return NextResponse.json({ requests: populated })
  } catch (err: any) {
    console.error('Error GET refund-requests:', err)
    return NextResponse.json({ requests: globalThis.__refund_requests_store || [] })
  }
}

// POST — kasir submit pengajuan refund
export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'kasir') {
      return NextResponse.json({ error: 'Hanya kasir yang dapat mengajukan permintaan refund.' }, { status: 403 })
    }

    const body = await req.json()
    const { sale_id, reason } = body

    if (!sale_id || !reason?.trim()) {
      return NextResponse.json({ error: 'sale_id dan alasan wajib diisi.' }, { status: 400 })
    }

    const adminSupa = getAdminSupa()

    // Ambil info transaksi
    let sale: any = null
    if (adminSupa) {
      const { data } = await adminSupa
        .from('sales')
        .select('id, invoice_number, status, final_amount, payment_method')
        .eq('id', sale_id)
        .maybeSingle()
      sale = data
    }

    if (!sale) {
      const { data } = await supabase
        .from('sales')
        .select('id, invoice_number, status, final_amount, payment_method')
        .eq('id', sale_id)
        .maybeSingle()
      sale = data
    }

    if (!sale) return NextResponse.json({ error: 'Transaksi tidak ditemukan.' }, { status: 404 })
    if (sale.status === 'voided') return NextResponse.json({ error: 'Transaksi sudah dibatalkan.' }, { status: 400 })

    // 1. Coba simpan ke tabel refund_requests di database
    if (adminSupa) {
      try {
        const { data: existing } = await adminSupa
          .from('refund_requests')
          .select('id, status')
          .eq('sale_id', sale_id)
          .eq('status', 'pending')
          .maybeSingle()

        if (existing) {
          return NextResponse.json({ error: 'Sudah ada pengajuan refund yang sedang menunggu persetujuan admin untuk transaksi ini.' }, { status: 409 })
        }

        const { data: newRequest, error: insertErr } = await adminSupa
          .from('refund_requests')
          .insert({
            sale_id,
            requested_by: user.id,
            reason: reason.trim(),
            status: 'pending'
          })
          .select()
          .single()

        if (!insertErr && newRequest) {
          return NextResponse.json({
            success: true,
            request_id: newRequest.id,
            message: `Pengajuan refund untuk ${sale.invoice_number} telah dikirim. Menunggu persetujuan admin.`
          })
        }
      } catch (e) {
        // Fallback jika tabel belum ada di database
      }
    }

    // 2. Simpan ke memory fallback jika tabel belum ada
    const fallbackStore = globalThis.__refund_requests_store || []
    const existing = fallbackStore.find(r => r.sale_id === sale_id && r.status === 'pending')
    if (existing) {
      return NextResponse.json({ error: 'Sudah ada pengajuan refund yang sedang menunggu persetujuan admin untuk transaksi ini.' }, { status: 409 })
    }

    const fallbackItem = {
      id: `req-${Date.now()}`,
      sale_id,
      requested_by: user.id,
      reason: reason.trim(),
      status: 'pending',
      reject_note: null,
      reviewed_by: null,
      reviewed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      invoice_number: sale.invoice_number,
      amount: sale.final_amount,
      payment_method: sale.payment_method,
      requester_name: profile.full_name || 'Kasir'
    }

    fallbackStore.unshift(fallbackItem)
    globalThis.__refund_requests_store = fallbackStore

    return NextResponse.json({
      success: true,
      request_id: fallbackItem.id,
      message: `Pengajuan refund untuk ${sale.invoice_number} telah dikirim. Menunggu persetujuan admin.`
    })
  } catch (err: any) {
    console.error('Error POST refund-requests:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// PATCH — admin approve atau reject pengajuan refund
export async function PATCH(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'owner'].includes(profile.role)) {
      return NextResponse.json({ error: 'Hanya admin/owner yang dapat memproses pengajuan refund.' }, { status: 403 })
    }

    const body = await req.json()
    const { request_id, action, reject_note } = body // action: 'approve' | 'reject'

    if (!request_id || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'request_id dan action (approve/reject) wajib diisi.' }, { status: 400 })
    }

    const adminSupa = getAdminSupa()
    const now = new Date().toISOString()

    // 1. Coba update via database Supabase jika tabel ada
    if (adminSupa) {
      try {
        const { data: reqData } = await adminSupa
          .from('refund_requests')
          .select('*, sale:sale_id(*)')
          .eq('id', request_id)
          .maybeSingle()

        if (reqData && reqData.status === 'pending') {
          if (action === 'reject') {
            await adminSupa
              .from('refund_requests')
              .update({ status: 'rejected', reviewed_by: user.id, reviewed_at: now, reject_note: reject_note?.trim() || null })
              .eq('id', request_id)

            return NextResponse.json({ success: true, message: 'Pengajuan refund ditolak.' })
          }

          // action === 'approve'
          const sale = reqData.sale as any
          if (sale) {
            // Kembalikan stok item
            const { data: items } = await adminSupa.from('sale_items').select('*').eq('sale_id', sale.id)
            for (const item of items || []) {
              const { data: prod } = await adminSupa.from('products').select('stock').eq('id', item.product_id).single()
              if (prod) {
                const newStock = (prod.stock || 0) + (item.quantity || 0)
                await adminSupa.from('products').update({ stock: newStock, updated_at: now }).eq('id', item.product_id)
                await adminSupa.from('stock_movements').insert({
                  product_id: item.product_id,
                  type: 'void_return',
                  quantity: item.quantity,
                  previous_stock: prod.stock,
                  current_stock: newStock,
                  reference_id: sale.id,
                  note: `Refund disetujui admin: ${reqData.reason}`,
                  created_by: user.id,
                  created_at: now
                })
              }
            }

            // Update status sales
            await adminSupa.from('sales')
              .update({ status: 'voided', void_reason: reqData.reason, voided_at: now, voided_by: user.id, updated_at: now })
              .eq('id', sale.id)

            // Update status request
            await adminSupa.from('refund_requests')
              .update({ status: 'approved', reviewed_by: user.id, reviewed_at: now })
              .eq('id', request_id)

            return NextResponse.json({ success: true, message: `Refund transaksi ${sale.invoice_number} disetujui. Stok telah dikembalikan.` })
          }
        }
      } catch (e) {
        // Tabel database belum ada, lanjut ke fallback memory di bawah
      }
    }

    // 2. Fallback memory store
    const fallbackStore = globalThis.__refund_requests_store || []
    const itemIndex = fallbackStore.findIndex(r => r.id === request_id)
    if (itemIndex === -1) {
      return NextResponse.json({ error: 'Pengajuan tidak ditemukan.' }, { status: 404 })
    }

    const reqItem = fallbackStore[itemIndex]
    if (action === 'reject') {
      reqItem.status = 'rejected'
      reqItem.reviewed_by = user.id
      reqItem.reviewed_at = now
      reqItem.reject_note = reject_note?.trim() || null
      fallbackStore[itemIndex] = reqItem
      globalThis.__refund_requests_store = fallbackStore
      return NextResponse.json({ success: true, message: 'Pengajuan refund ditolak.' })
    }

    // action === 'approve' pada fallback memory
    reqItem.status = 'approved'
    reqItem.reviewed_by = user.id
    reqItem.reviewed_at = now
    fallbackStore[itemIndex] = reqItem
    globalThis.__refund_requests_store = fallbackStore

    // Batalkan penjualan di database sales (yang tabelnya ada di Supabase)
    if (adminSupa && reqItem.sale_id) {
      try {
        const { data: sale } = await adminSupa.from('sales').select('id, invoice_number').eq('id', reqItem.sale_id).single()
        if (sale) {
          const { data: items } = await adminSupa.from('sale_items').select('*').eq('sale_id', sale.id)
          for (const item of items || []) {
            const { data: prod } = await adminSupa.from('products').select('stock').eq('id', item.product_id).single()
            if (prod) {
              const newStock = (prod.stock || 0) + (item.quantity || 0)
              await adminSupa.from('products').update({ stock: newStock, updated_at: now }).eq('id', item.product_id)
            }
          }
          await adminSupa.from('sales')
            .update({ status: 'voided', void_reason: reqItem.reason, voided_at: now, voided_by: user.id, updated_at: now })
            .eq('id', sale.id)
        }
      } catch (e) {
        console.error('Error voiding sale in fallback:', e)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Refund transaksi disetujui. Status transaksi telah diperbarui.`
    })
  } catch (err: any) {
    console.error('Error PATCH refund-requests:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
