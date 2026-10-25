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

async function requireAuthenticatedUser(request?: Request) {
  let user: any = null

  // Support Bearer token for post-registration Snap callback flows
  const authHeader = request?.headers.get('authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '').trim()
    const admin = getServiceClient()
    const { data: tokenUser } = await admin.auth.getUser(token)
    if (tokenUser?.user) {
      user = tokenUser.user
    }
  }

  // Fallback to cookie-based auth
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

  const admin = getServiceClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('role, approval_status, email, full_name')
    .eq('id', user.id)
    .maybeSingle()

  return { response: null, user: { ...user, profile } }
}

export async function GET(request: Request) {
  try {
    const auth = await requireAuthenticatedUser(request)
    if (auth.response) return auth.response
    if (!auth.user) return NextResponse.json({ error: 'Sesi tidak valid.' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const orderId = (searchParams.get('order_id') || searchParams.get('orderId') || searchParams.get('id') || '').trim()

    const admin = getServiceClient()

    // 1. Check if user already has an active subscription
    const { data: activeSub } = await admin
      .from('subscriptions')
      .select('status, current_period_start, current_period_end, cancel_at_period_end, plan:subscription_plans(name, price)')
      .eq('owner_id', auth.user.id)
      .eq('status', 'active')
      .maybeSingle()

    // 2. Query payment record
    let payment: {
      id: string
      order_id: string
      owner_id: string
      plan_id: string
      plan_name: string
      duration_days: number
      amount: number
      status: string
      gateway_transaction_id: string | null
      snap_token: string | null
      snap_url: string | null
      expires_at: string | null
      paid_at: string | null
      created_at: string
    } | null = null

    if (orderId) {
      const { data: matchedPayment } = await admin
        .from('subscription_payments')
        .select('id, order_id, owner_id, plan_id, plan_name, duration_days, amount, status, gateway_transaction_id, snap_token, snap_url, expires_at, paid_at, created_at')
        .eq('order_id', orderId)
        .maybeSingle()

      if (matchedPayment) {
        // Security check: Only the owner who owns this payment or Super Admin can check/sync status
        if (matchedPayment.owner_id !== auth.user.id && auth.user.profile?.role !== 'super_admin') {
          return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 })
        }
        payment = matchedPayment
      }
    }

    if (!payment) {
      // Fallback: check the user's latest payment record
      const { data: latestPayment } = await admin
        .from('subscription_payments')
        .select('id, order_id, owner_id, plan_id, plan_name, duration_days, amount, status, gateway_transaction_id, snap_token, snap_url, expires_at, paid_at, created_at')
        .eq('owner_id', auth.user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (latestPayment) {
        payment = latestPayment
      }
    }

    // 3. If user already has an active subscription and no pending payment to sync
    if (activeSub && (!payment || payment.status === 'success')) {
      const planName = payment?.plan_name || (Array.isArray(activeSub.plan) ? activeSub.plan[0]?.name : (activeSub.plan as { name?: string })?.name) || 'Langganan Aktif'
      const planPrice = payment?.amount || (Array.isArray(activeSub.plan) ? activeSub.plan[0]?.price : (activeSub.plan as { price?: number })?.price) || 0

      return NextResponse.json({
        order_id: payment?.order_id || orderId || 'ACTIVE-SUBSCRIPTION',
        orderId: payment?.order_id || orderId || 'ACTIVE-SUBSCRIPTION',
        status: 'success',
        plan_name: planName,
        amount: planPrice,
        created_at: payment?.created_at || activeSub.current_period_start,
        paid_at: payment?.paid_at || activeSub.current_period_start,
        expires_at: activeSub.current_period_end,
        subscription: activeSub,
        verified: true,
      })
    }

    // 4. If neither payment nor active subscription exists
    if (!payment) {
      return NextResponse.json({
        order_id: orderId || null,
        orderId: orderId || null,
        status: 'unknown',
        notFound: true,
        verified: false,
        error: 'Data tagihan belum ditemukan untuk akun Anda. Silakan pilih paket langganan untuk melanjutkan.',
      }, { status: 200 })
    }

    // 5. If payment is already completed or refunded, return current status directly
    if (payment.status === 'success' || payment.status === 'refunded') {
      const { data: sub } = await admin
        .from('subscriptions')
        .select('status, current_period_start, current_period_end, cancel_at_period_end, plan:subscription_plans(name)')
        .eq('owner_id', auth.user.id)
        .maybeSingle()

      return NextResponse.json({
        order_id: payment.order_id,
        orderId: payment.order_id,
        status: payment.status,
        plan_name: payment.plan_name,
        amount: payment.amount,
        created_at: payment.created_at,
        paid_at: payment.paid_at,
        expires_at: payment.expires_at,
        subscription: sub || activeSub,
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
        order_id: payment.order_id,
        orderId: payment.order_id,
        status: payment.status,
        plan_name: payment.plan_name,
        amount: payment.amount,
        created_at: payment.created_at,
        expires_at: payment.expires_at,
        snap_token: payment.snap_token,
        snap_url: payment.snap_url,
        verified: false,
        warning: 'Kunci Midtrans belum dikonfigurasi.',
      })
    }

    // Use payment.order_id (from DB) — always authoritative even if URL orderId is empty
    const midtransOrderId = payment.order_id || orderId
    const midtransRes = await fetchMidtransTransactionStatus(midtransOrderId, config)
    if (!midtransRes.ok || !midtransRes.data) {
      // Return existing pending status from database
      return NextResponse.json({
        order_id: payment.order_id,
        orderId: payment.order_id,
        status: payment.status,
        plan_name: payment.plan_name,
        amount: payment.amount,
        created_at: payment.created_at,
        expires_at: payment.expires_at,
        snap_token: payment.snap_token,
        snap_url: payment.snap_url,
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
        order_id: payment.order_id,
        orderId: payment.order_id,
        status: payment.status,
        plan_name: payment.plan_name,
        amount: payment.amount,
        created_at: payment.created_at,
        expires_at: payment.expires_at,
        snap_token: payment.snap_token,
        snap_url: payment.snap_url,
        verified: false,
        rawStatus: result.transaction_status,
      })
    }

    const transactionId = typeof result.transaction_id === 'string' ? result.transaction_id : null
    const paidAt = typeof result.transaction_time === 'string' ? result.transaction_time : null

    // If status changed or needs applying:
    if (mappedStatus !== payment.status || mappedStatus === 'success') {
      const applyResult = await applySubscriptionPayment(admin, {
        orderId: payment.order_id,
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
        console.error('Audit log error:', auditErr)
      }
    }

    const [{ data: updatedPayment }, { data: updatedSub }] = await Promise.all([
      admin.from('subscription_payments')
        .select('id, order_id, owner_id, plan_id, plan_name, duration_days, amount, status, gateway_transaction_id, snap_token, snap_url, expires_at, paid_at, created_at')
        .eq('order_id', payment.order_id)
        .maybeSingle(),
      admin.from('subscriptions')
        .select('status, current_period_start, current_period_end, cancel_at_period_end, plan:subscription_plans(name)')
        .eq('owner_id', auth.user.id)
        .maybeSingle(),
    ])

    return NextResponse.json({
      order_id: updatedPayment?.order_id ?? payment.order_id,
      orderId: updatedPayment?.order_id ?? payment.order_id,
      status: mappedStatus,
      plan_name: updatedPayment?.plan_name ?? payment.plan_name,
      amount: updatedPayment?.amount ?? payment.amount,
      created_at: updatedPayment?.created_at ?? payment.created_at,
      paid_at: updatedPayment?.paid_at ?? null,
      expires_at: updatedPayment?.expires_at ?? payment.expires_at,
      snap_token: updatedPayment?.snap_token ?? payment.snap_token,
      snap_url: updatedPayment?.snap_url ?? payment.snap_url,
      subscription: updatedSub,
      verified: true,
      payment_type: result.payment_type ?? null,
    })
  } catch (error) {
    console.error('Error in GET /api/payments/status:', error)
    return NextResponse.json({ error: 'Gagal memeriksa status pembayaran.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  // Allow POST requests with JSON body as well for compatibility
  try {
    const auth = await requireAuthenticatedUser()
    if (auth.response) return auth.response
    if (!auth.user) return NextResponse.json({ error: 'Sesi tidak valid.' }, { status: 401 })

    const body: unknown = await request.json().catch(() => ({}))
    const orderId = typeof (body as { order_id?: string; orderId?: string })?.order_id === 'string'
      ? (body as { order_id: string }).order_id.trim()
      : typeof (body as { orderId?: string })?.orderId === 'string'
        ? (body as { orderId: string }).orderId.trim()
        : ''

    const fakeUrl = new URL(`/api/payments/status?order_id=${encodeURIComponent(orderId)}`, request.url)
    return GET(new Request(fakeUrl, { headers: request.headers }))
  } catch (err) {
    return NextResponse.json({ error: 'Gagal memproses permintaan.' }, { status: 500 })
  }
}
