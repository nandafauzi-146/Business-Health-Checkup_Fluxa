import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import {
  cancelMidtransTransaction,
  fetchMidtransTransactionStatus,
  getMidtransConfig,
  mapMidtransStatus,
} from '@/lib/midtrans'
import { applySubscriptionPayment } from '@/lib/subscription-payment-sync'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('Konfigurasi Supabase server belum lengkap.')
  return createSupabaseAdminClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function requireOwner(request?: Request) {
  let user: any = null

  const authHeader = request?.headers.get('authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '').trim()
    const admin = getServiceClient()
    const { data: tokenUser } = await admin.auth.getUser(token)
    if (tokenUser?.user) {
      user = tokenUser.user
    }
  }

  if (!user) {
    const supabase = await createClient()
    const { data: cookieUser, error: userError } = await supabase.auth.getUser()
    if (!userError && cookieUser?.user) {
      user = cookieUser.user
    }
  }

  if (!user) {
    return { response: NextResponse.json({ error: 'Silakan login terlebih dahulu.' }, { status: 401 }), user: null }
  }

  const adminClient = getServiceClient()
  const { data: profile } = await adminClient
    .from('profiles')
    .select('role, approval_status, email, full_name')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || (profile.role !== 'owner' && profile.role !== 'super_admin')) {
    return {
      response: NextResponse.json({ error: 'Akses ditolak: Hanya Owner yang dapat membatalkan tagihan pembayaran.' }, { status: 403 }),
      user: null,
    }
  }

  return { response: null, user: { ...user, profile } }
}

export async function POST(request: Request) {
  try {
    const auth = await requireOwner(request)
    if (auth.response) return auth.response
    if (!auth.user) return NextResponse.json({ error: 'Sesi tidak valid.' }, { status: 401 })

    const body: unknown = await request.json().catch(() => ({}))
    const orderId = typeof (body as { orderId?: unknown; order_id?: unknown })?.orderId === 'string'
      ? (body as { orderId: string }).orderId.trim()
      : typeof (body as { order_id?: unknown })?.order_id === 'string'
        ? (body as { order_id: string }).order_id.trim()
        : ''

    if (!orderId || !/^FLX-[0-9a-zA-Z_-]+$/i.test(orderId)) {
      return NextResponse.json({ error: 'Order ID tidak valid.' }, { status: 400 })
    }

    const admin = getServiceClient()

    // 1. Fetch payment record
    const { data: payment, error: pError } = await admin
      .from('subscription_payments')
      .select('id, order_id, owner_id, plan_name, amount, status, created_at')
      .eq('order_id', orderId)
      .maybeSingle()

    if (pError || !payment) {
      return NextResponse.json({ error: 'Data pembayaran tidak ditemukan.' }, { status: 404 })
    }

    // 2. Multi-tenant security check: Only the owning user or super admin can cancel
    if (payment.owner_id !== auth.user.id && auth.user.profile.role !== 'super_admin') {
      return NextResponse.json({ error: 'Akses ditolak: Anda tidak memiliki akses ke tagihan ini.' }, { status: 403 })
    }

    // 3. Reject cancellation if already paid or refunded
    if (payment.status === 'success' || payment.status === 'refunded') {
      return NextResponse.json({
        error: 'Pembayaran ini sudah berhasil dan tidak dapat dibatalkan.',
        status: payment.status,
      }, { status: 400 })
    }

    if (payment.status === 'cancelled') {
      return NextResponse.json({
        success: true,
        message: 'Tagihan pembayaran ini sudah dibatalkan sebelumnya.',
        status: 'cancelled',
      }, { status: 200 })
    }

    // 4. Verify authoritative Midtrans transaction status before cancelling
    let config: ReturnType<typeof getMidtransConfig> | null = null
    try {
      config = getMidtransConfig()
    } catch {
      // Configuration fallback
    }

    if (config) {
      try {
        const midtransRes = await fetchMidtransTransactionStatus(orderId, config)
        if (midtransRes.ok && midtransRes.data) {
          const mapped = mapMidtransStatus(midtransRes.data.transaction_status, midtransRes.data.fraud_status)
          if (mapped === 'success') {
            // Apply payment as success, reject cancellation
            await applySubscriptionPayment(admin, {
              orderId,
              status: 'success',
              transactionId: typeof midtransRes.data.transaction_id === 'string' ? midtransRes.data.transaction_id : null,
              paidAt: typeof midtransRes.data.transaction_time === 'string' ? midtransRes.data.transaction_time : null,
            })
            return NextResponse.json({
              error: 'Pembayaran telah berhasil terkonfirmasi di Midtrans dan tidak dapat dibatalkan.',
              status: 'success',
            }, { status: 400 })
          }

          // If transaction is still open/pending on Midtrans, request Midtrans cancellation
          if (mapped === 'pending') {
            await cancelMidtransTransaction(orderId, config)
          }
        }
      } catch (mtErr) {
        console.warn('Midtrans status check/cancel non-fatal error:', mtErr)
      }
    }

    // 5. Update local payment record to 'cancelled'
    const nowIso = new Date().toISOString()
    const { error: updateError } = await admin
      .from('subscription_payments')
      .update({
        status: 'cancelled',
        updated_at: nowIso,
      })
      .eq('id', payment.id)

    if (updateError) {
      console.error('Error updating payment to cancelled:', updateError)
      return NextResponse.json({ error: 'Gagal memperbarui status pembatalan.' }, { status: 500 })
    }

    // 6. Record audit log
    try {
      await admin.from('audit_logs').insert({
        user_id: auth.user.id,
        action: 'SUBSCRIPTION_PAYMENT_CANCELLED',
        table_name: 'subscription_payments',
        record_id: payment.id,
        old_data: { status: payment.status },
        new_data: {
          order_id: orderId,
          plan_name: payment.plan_name,
          amount: payment.amount,
          status: 'cancelled',
          cancelled_at: nowIso,
          cancelled_by: auth.user.id,
        },
      })
    } catch (auditErr) {
      console.error('Audit log for cancellation failed (non-fatal):', auditErr)
    }

    return NextResponse.json({
      success: true,
      message: 'Tagihan pembayaran berhasil dibatalkan. Anda dapat memilih paket langganan kembali.',
      orderId,
      status: 'cancelled',
    }, { status: 200 })
  } catch (error) {
    console.error('Error in POST /api/subscription/cancel:', error)
    return NextResponse.json({ error: 'Terjadi kendala saat membatalkan pembayaran.' }, { status: 500 })
  }
}
