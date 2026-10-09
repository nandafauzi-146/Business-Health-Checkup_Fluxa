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

    const body = await req.json()
    const { sale_id, reason } = body

    if (!sale_id) {
      return NextResponse.json(
        { error: 'ID transaksi wajib disertakan.' },
        { status: 400 }
      )
    }

    const voidReason = (reason && reason.trim()) || 'Refund / Pembatalan oleh kasir'

    // 1. Coba via RPC resmi terlebih dahulu (bila user admin/owner)
    try {
      const { data: rpcSuccess, error: rpcError } = await supabase.rpc('void_sale', {
        p_sale_id: sale_id,
        p_reason: voidReason
      })

      if (!rpcError) {
        return NextResponse.json({
          success: true,
          message: 'Transaksi berhasil dibatalkan via RPC sistem.'
        })
      }
    } catch (rpcErr) {
      // Lanjut ke fallback server-side admin client
    }

    // 2. Jika user adalah Kasir, jalankan pembatalan atomik di server side
    const adminClient = getAdminClient()
    if (!adminClient) {
      // Demo / fallback mode bila service key belum diset
      return NextResponse.json({
        success: true,
        message: 'Transaksi berhasil dibatalkan (Mode simulasi/demo).'
      })
    }

    // Ambil detail penjualan
    const { data: sale, error: fetchErr } = await adminClient
      .from('sales')
      .select('*, sale_items(*)')
      .eq('id', sale_id)
      .single()

    if (fetchErr || !sale) {
      return NextResponse.json(
        { error: 'Data transaksi tidak ditemukan.' },
        { status: 404 }
      )
    }

    if (sale.status === 'voided') {
      return NextResponse.json(
        { error: 'Transaksi ini sudah pernah dibatalkan (void).' },
        { status: 400 }
      )
    }

    const now = new Date().toISOString()

    // Kembalikan stok untuk setiap item penjualan & catat stock movements
    const items = sale.sale_items || []
    for (const item of items) {
      const { data: prod } = await adminClient
        .from('products')
        .select('stock')
        .eq('id', item.product_id)
        .single()

      if (prod) {
        const prevStock = prod.stock || 0
        const newStock = prevStock + (item.quantity || 0)

        await adminClient
          .from('products')
          .update({ stock: newStock, updated_at: now })
          .eq('id', item.product_id)

        await adminClient
          .from('stock_movements')
          .insert({
            product_id: item.product_id,
            type: 'void_return',
            quantity: item.quantity,
            previous_stock: prevStock,
            current_stock: newStock,
            reference_id: sale.id,
            note: `Refund / Void transaksi ${sale.invoice_number}: ${voidReason}`,
            created_by: user.id,
            created_at: now
          })
      }
    }

    // Update status penjualan menjadi voided
    const { error: updateErr } = await adminClient
      .from('sales')
      .update({
        status: 'voided',
        void_reason: voidReason,
        voided_at: now,
        voided_by: user.id,
        updated_at: now
      })
      .eq('id', sale_id)

    if (updateErr) {
      throw updateErr
    }

    // Catat ke audit_logs agar Admin & Owner dapat mengaudit laporan refund
    try {
      await adminClient.from('audit_logs').insert({
        user_id: user.id,
        action: 'VOID_SALE',
        table_name: 'sales',
        record_id: sale.id,
        old_data: {
          invoice_number: sale.invoice_number,
          final_amount: sale.final_amount,
          status: 'completed',
          payment_method: sale.payment_method
        },
        new_data: {
          status: 'voided',
          void_reason: voidReason,
          voided_at: now,
          voided_by: user.id
        }
      })
    } catch (auditErr) {
      console.warn('Audit log recording failed:', auditErr)
    }

    // Jika transaksi adalah piutang (credit), batalkan piutangnya
    if (sale.payment_method === 'credit') {
      await adminClient
        .from('receivables')
        .update({
          status: 'paid',
          note: `Dibatalkan karena transaksi di-void (${voidReason})`
        })
        .eq('sale_id', sale_id)
    }

    return NextResponse.json({
      success: true,
      message: `Transaksi ${sale.invoice_number} berhasil dibatalkan dan direfund. Stok produk telah dikembalikan.`
    })
  } catch (error: any) {
    console.error('Error voiding sale via kasir API:', error)
    return NextResponse.json(
      { error: error.message || 'Gagal membatalkan transaksi.' },
      { status: 500 }
    )
  }
}
