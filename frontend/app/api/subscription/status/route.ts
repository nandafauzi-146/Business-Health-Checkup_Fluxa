import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import {
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

async function requireOwner() {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return { response: NextResponse.json({ error: 'Silakan login.' }, { status: 401 }), user: null }
  }

  let { data: profile, error } = await supabase
    .from('profiles')
    .select('role, approval_status, email, full_name, trial_ends_at, registration_path')
    .eq('id', user.id)
    .maybeSingle()

  if (error && String(error.message || '').includes('registration_path')) {
    const fallback = await supabase
      .from('profiles')
      .select('role, approval_status, email, full_name, trial_ends_at')
      .eq('id', user.id)
      .maybeSingle()
    if (fallback.data) {
      profile = { ...fallback.data, registration_path: null }
      error = null
    }
  }

  if (error || !profile) {
    return { response: NextResponse.json({ error: 'Profil pengguna tidak ditemukan.' }, { status: 403 }), user: null }
  }

  const isApprovedOwner = profile.role === 'owner' && profile.approval_status === 'approved'
  const isPendingSubscribeOwner =
    profile.role === 'owner' &&
    profile.approval_status === 'pending' &&
    profile.registration_path === 'subscribe'

  if (!isApprovedOwner && !isPendingSubscribeOwner) {
    return {
      response: NextResponse.json(
        { error: 'Fitur ini khusus Owner yang disetujui atau sedang menyelesaikan langganan awal.' },
        { status: 403 },
      ),
      user: null,
    }
  }
  return { response: null, user: { ...user, profile } }
}

export async function POST(request: Request) {
  try {
    const auth = await requireOwner()
    if (auth.response) return auth.response
    if (!auth.user) return NextResponse.json({ error: 'Sesi Owner tidak valid.' }, { status: 401 })

    const body: unknown = await request.json().catch(() => ({}))
    const orderId = typeof (body as { orderId?: unknown })?.orderId === 'string'
      ? (body as { orderId: string }).orderId.trim()
      : ''

    if (!orderId || !/^FLX-[0-9a-zA-Z_-]+$/i.test(orderId)) {
      return NextResponse.json({ error: 'Order ID tidak valid.' }, { status: 400 })
    }

    const admin = getServiceClient()
    const { data: payment, error: paymentError } = await admin
      .from('subscription_payments')
      .select('id, order_id, owner_id, plan_id, plan_name, duration_days, amount, status, gateway_transaction_id, snap_token, snap_url, expires_at, paid_at, created_at')
      .eq('order_id', orderId)
      .maybeSingle()

    if (paymentError) throw paymentError
    if (!payment) {
      return NextResponse.json({ error: 'Transaksi tidak ditemukan.' }, { status: 404 })
    }

    // Security: Only owner who owns this payment or Super Admin can check/sync status
    if (payment.owner_id !== auth.user.id && auth.user.profile.role !== 'super_admin') {
      return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 })
    }

    // If payment is already completed or refunded, return current status directly
    if (payment.status === 'success' || payment.status === 'refunded') {
      const { data: sub } = await admin
        .from('subscriptions')
        .select('status, current_period_start, current_period_end, cancel_at_period_end, plan:subscription_plans(name)')
        .eq('owner_id', auth.user.id)
        .maybeSingle()

      return NextResponse.json({
        orderId: payment.order_id,
        status: payment.status,
        payment,
        subscription: sub,
        verified: true,
      })
    }

    // Call Midtrans API to check authoritative transaction status
    let config: ReturnType<typeof getMidtransConfig>
    try {
      config = getMidtransConfig()
    } catch (cfgError) {
      console.warn('Midtrans config not set while syncing status:', cfgError)
      return NextResponse.json({
        orderId: payment.order_id,
        status: payment.status,
        payment,
        verified: false,
        warning: 'Kunci Midtrans belum dikonfigurasi.',
      })
    }

    const midtransRes = await fetchMidtransTransactionStatus(orderId, config)
    if (!midtransRes.ok || !midtransRes.data) {
      // Transaction might not have been opened/attempted in Midtrans yet
      return NextResponse.json({
        orderId: payment.order_id,
        status: payment.status,
        payment,
        verified: false,
        midtransStatus: null,
      })
    }

    const result = midtransRes.data
    const grossAmount = typeof result.gross_amount === 'string'
      ? Math.round(Number.parseFloat(result.gross_amount))
      : Number(result.gross_amount)

    if (grossAmount && grossAmount !== payment.amount) {
      return NextResponse.json({ error: 'Nominal transaksi tidak cocok dengan Midtrans.' }, { status: 400 })
    }

    const mappedStatus = mapMidtransStatus(result.transaction_status, result.fraud_status)
    if (!mappedStatus) {
      return NextResponse.json({
        orderId: payment.order_id,
        status: payment.status,
        payment,
        verified: false,
        rawStatus: result.transaction_status,
      })
    }

    const transactionId = typeof result.transaction_id === 'string' ? result.transaction_id : null
    const paidAt = typeof result.transaction_time === 'string' ? result.transaction_time : null

    // If status changed or needs applying:
    if (mappedStatus !== payment.status || mappedStatus === 'success') {
      const applyResult = await applySubscriptionPayment(admin, {
        orderId,
        status: mappedStatus,
        transactionId,
        paidAt,
      })
      if (!applyResult.success) {
        console.error('applySubscriptionPayment warning:', applyResult.error)
      }

      // Record audit event
      try {
        await admin.from('audit_logs').insert({
          user_id: auth.user.id,
          action: 'SUBSCRIPTION_STATUS_SYNCHRONIZED',
          table_name: 'subscription_payments',
          record_id: payment.id,
          old_data: { status: payment.status },
          new_data: {
            status: mappedStatus,
            order_id: orderId,
            transaction_id: transactionId,
            payment_type: typeof result.payment_type === 'string' ? result.payment_type : 'unknown',
          },
        })
      } catch (auditErr) {
        console.error('Audit log for status sync non-fatal error:', auditErr)
      }
    }

    const [{ data: updatedPayment }, { data: updatedSub }] = await Promise.all([
      admin.from('subscription_payments')
        .select('id, order_id, owner_id, plan_id, plan_name, duration_days, amount, status, gateway_transaction_id, snap_token, snap_url, expires_at, paid_at, created_at')
        .eq('order_id', orderId)
        .maybeSingle(),
      admin.from('subscriptions')
        .select('status, current_period_start, current_period_end, cancel_at_period_end, plan:subscription_plans(name)')
        .eq('owner_id', auth.user.id)
        .maybeSingle(),
    ])

    return NextResponse.json({
      orderId,
      status: mappedStatus,
      payment: updatedPayment ?? payment,
      subscription: updatedSub,
      verified: true,
      paymentType: result.payment_type ?? null,
    })
  } catch (error) {
    console.error('Error synchronizing subscription payment status:', error)
    return NextResponse.json({ error: 'Gagal memperbarui status transaksi.' }, { status: 500 })
  }
}
