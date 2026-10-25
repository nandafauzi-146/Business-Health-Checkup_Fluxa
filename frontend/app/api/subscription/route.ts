import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import {
  fetchMidtransTransactionStatus,
  getMidtransConfig,
  mapMidtransStatus,
  midtransAuthorization,
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

  // 1. Check Bearer token in Authorization header if present
  const authHeader = request?.headers.get('authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '').trim()
    const admin = getServiceClient()
    const { data: tokenUser } = await admin.auth.getUser(token)
    if (tokenUser?.user) {
      user = tokenUser.user
    }
  }

  // 2. Check Supabase cookies if no user yet
  if (!user) {
    const supabase = await createClient()
    const { data: cookieUser, error: userError } = await supabase.auth.getUser()
    if (!userError && cookieUser?.user) {
      user = cookieUser.user
    }
  }

  if (!user) {
    return { response: NextResponse.json({ error: 'Silakan login.' }, { status: 401 }), user: null }
  }

  const adminClient = getServiceClient()
  let { data: profile, error } = await adminClient
    .from('profiles')
    .select('role, approval_status, email, full_name, phone, trial_ends_at, registration_path')
    .eq('id', user.id)
    .maybeSingle()

  if (error && String(error.message || '').includes('registration_path')) {
    const fallback = await adminClient
      .from('profiles')
      .select('role, approval_status, email, full_name, phone, trial_ends_at')
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

  const isOwner = profile.role === 'owner'
  const isAllowedStatus = profile.approval_status === 'approved' || profile.approval_status === 'pending'

  if (!isOwner || !isAllowedStatus) {
    return {
      response: NextResponse.json(
        { error: 'Fitur ini khusus Owner yang disetujui atau sedang menyelesaikan langganan awal.' },
        { status: 403 },
      ),
      user: null,
    }
  }

  // If pending owner, ensure registration_path is marked as subscribe
  if (profile.approval_status === 'pending' && profile.registration_path !== 'subscribe') {
    void adminClient.from('profiles').update({
      registration_path: 'subscribe',
      updated_at: new Date().toISOString(),
    }).eq('id', user.id)
    profile.registration_path = 'subscribe'
  }

  return { response: null, user: { ...user, profile } }
}

export async function GET(request: Request) {
  try {
    const auth = await requireOwner(request)
    if (auth.response) return auth.response
    if (!auth.user) return NextResponse.json({ error: 'Sesi Owner tidak valid.' }, { status: 401 })

    const admin = getServiceClient()
    const [plansResult, subscriptionResult, paymentsResult] = await Promise.all([
      admin.from('subscription_plans')
        .select('id, name, description, price, duration_days, max_users, features')
        .eq('is_active', true)
        .order('price', { ascending: true }),
      admin.from('subscriptions')
        .select('status, current_period_start, current_period_end, cancel_at_period_end, plan:subscription_plans(name)')
        .eq('owner_id', auth.user.id)
        .maybeSingle(),
      admin.from('subscription_payments')
        .select('id, order_id, plan_name, amount, status, snap_token, snap_url, created_at, paid_at, expires_at')
        .eq('owner_id', auth.user.id)
        .order('created_at', { ascending: false })
        .limit(50),
    ])
    const error = plansResult.error || subscriptionResult.error || paymentsResult.error
    if (error) throw error

    let payments = paymentsResult.data ?? []
    let subscription = subscriptionResult.data

    // If the latest payment is pending and created recently (last 24 hours), attempt a silent sync
    const latestPending = payments.find((p) => p.status === 'pending')
    if (latestPending) {
      const createdTime = new Date(latestPending.created_at).getTime()
      const now = Date.now()
      if (now - createdTime < 24 * 60 * 60 * 1000) {
        try {
          const config = getMidtransConfig()
          const midtransRes = await fetchMidtransTransactionStatus(latestPending.order_id, config)
          if (midtransRes.ok && midtransRes.data) {
            const mapped = mapMidtransStatus(midtransRes.data.transaction_status, midtransRes.data.fraud_status)
            if (mapped && mapped !== 'pending') {
              await applySubscriptionPayment(admin, {
                orderId: latestPending.order_id,
                status: mapped,
                transactionId: typeof midtransRes.data.transaction_id === 'string' ? midtransRes.data.transaction_id : null,
                paidAt: typeof midtransRes.data.transaction_time === 'string' ? midtransRes.data.transaction_time : null,
              })

              const [{ data: refreshedPayments }, { data: refreshedSub }] = await Promise.all([
                admin.from('subscription_payments')
                  .select('id, order_id, plan_name, amount, status, snap_token, snap_url, created_at, paid_at, expires_at')
                  .eq('owner_id', auth.user.id)
                  .order('created_at', { ascending: false })
                  .limit(50),
                admin.from('subscriptions')
                  .select('status, current_period_start, current_period_end, cancel_at_period_end, plan:subscription_plans(name)')
                  .eq('owner_id', auth.user.id)
                  .maybeSingle(),
              ])
              if (refreshedPayments) payments = refreshedPayments
              if (refreshedSub) subscription = refreshedSub
            }
          }
        } catch (syncErr) {
          console.warn('Non-fatal silent sync error in GET /api/subscription:', syncErr)
        }
      }
    }

    let clientConfig: { clientKey: string; snapScriptUrl: string; isProduction: boolean } = {
      clientKey: process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY ?? '',
      snapScriptUrl: 'https://app.sandbox.midtrans.com/snap/snap.js',
      isProduction: false,
    }
    try {
      const cfg = getMidtransConfig()
      clientConfig = {
        clientKey: cfg.clientKey,
        snapScriptUrl: cfg.snapScriptUrl,
        isProduction: cfg.isProduction,
      }
    } catch {
      // Configuration fallback if env not yet set
    }

    return NextResponse.json({
      plans: plansResult.data ?? [],
      subscription,
      payments,
      trialEndsAt: auth.user.profile.trial_ends_at ?? null,
      approvalStatus: auth.user.profile.approval_status,
      registrationPath: auth.user.profile.registration_path,
      userProfile: {
        fullName: auth.user.profile.full_name || (auth.user.user_metadata?.full_name as string) || (auth.user.user_metadata?.name as string) || '',
        email: auth.user.email || '',
        phone: auth.user.profile.phone || (auth.user.user_metadata?.phone as string) || (auth.user.phone as string) || '',
      },
      midtransConfig: clientConfig,
    })
  } catch (error) {
    console.error('Unable to load subscription details.', error)
    return NextResponse.json({ error: 'Informasi subscription belum dapat dimuat.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireOwner(request)
    if (auth.response) return auth.response
    if (!auth.user) return NextResponse.json({ error: 'Sesi Owner tidak valid.' }, { status: 401 })

    const body: unknown = await request.json().catch(() => ({}))
    if (!body || typeof body !== 'object' || typeof (body as Record<string, unknown>).planId !== 'string') {
      return NextResponse.json({ error: 'Pilih paket subscription yang valid.' }, { status: 400 })
    }
    const planId = (body as { planId: string }).planId
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(planId)) {
      return NextResponse.json({ error: 'ID paket tidak valid.' }, { status: 400 })
    }

    const admin = getServiceClient()
    const { data: plan, error: planError } = await admin.from('subscription_plans')
      .select('id, name, price, duration_days')
      .eq('id', planId)
      .eq('is_active', true)
      .maybeSingle()
    if (planError) throw planError
    if (!plan) return NextResponse.json({ error: 'Paket tidak ditemukan atau sudah tidak aktif.' }, { status: 404 })
    if (plan.price <= 0) return NextResponse.json({ error: 'Paket gratis tidak memerlukan pembayaran.' }, { status: 400 })

    const config = getMidtransConfig()

    // Deduplication check: If user initiated a checkout for the same plan within the last 15 seconds, return existing token
    const { data: recentPayment } = await admin.from('subscription_payments')
      .select('id, order_id, snap_token, snap_url, expires_at, created_at, status')
      .eq('owner_id', auth.user.id)
      .eq('plan_id', plan.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (recentPayment && recentPayment.snap_token && recentPayment.expires_at) {
      const diffMs = Date.now() - new Date(recentPayment.created_at).getTime()
      if (diffMs < 15000) {
        return NextResponse.json({
          orderId: recentPayment.order_id,
          snapToken: recentPayment.snap_token,
          paymentUrl: recentPayment.snap_url,
          clientKey: config.clientKey,
          snapScriptUrl: config.snapScriptUrl,
          expiresAt: recentPayment.expires_at,
          reused: true,
        }, { status: 200 })
      }
    }

    // Always generate a distinct, unique transaction ID on the server for each new payment attempt
    const orderId = `FLX-${crypto.randomUUID()}`
    const { data: payment, error: paymentError } = await admin.from('subscription_payments')
      .insert({
        order_id: orderId,
        owner_id: auth.user.id,
        plan_id: plan.id,
        plan_name: plan.name,
        duration_days: plan.duration_days,
        amount: plan.price,
      })
      .select('id')
      .single()
    if (paymentError) throw paymentError

    const reqOrigin = request.headers.get('origin') || 'http://localhost:3000'
    const finishUrl = `${reqOrigin.replace(/\/$/, '')}/payment/finish`

    // Extract customer details: Name, Email, Phone (from body or authenticated user/profile/metadata)
    const { name: bodyName, email: bodyEmail, phone: bodyPhone } = body as Record<string, unknown>
    const customerName = (
      (typeof bodyName === 'string' && bodyName.trim()) ||
      auth.user.profile.full_name ||
      (auth.user.user_metadata?.full_name as string) ||
      (auth.user.user_metadata?.name as string) ||
      'Pelanggan Fluxa'
    ).trim().slice(0, 50)

    const customerEmail = (
      (typeof bodyEmail === 'string' && bodyEmail.trim()) ||
      auth.user.email ||
      ''
    ).trim().slice(0, 50)

    const customerPhone = (
      (typeof bodyPhone === 'string' && bodyPhone.trim()) ||
      auth.user.profile.phone ||
      (auth.user.user_metadata?.phone as string) ||
      (auth.user.phone as string) ||
      ''
    ).trim().slice(0, 25)

    // Save phone to profile if it wasn't saved before (especially for Google sign-ups)
    if (customerPhone && !auth.user.profile.phone) {
      void admin.from('profiles').update({ phone: customerPhone, updated_at: new Date().toISOString() }).eq('id', auth.user.id)
    }

    // Build Snap transaction payload with complete customer details (Nama, Email, No HP)
    const snapPayload = {
      transaction_details: {
        order_id: orderId,
        gross_amount: plan.price,
      },
      customer_details: {
        first_name: customerName,
        email: customerEmail,
        ...(customerPhone ? { phone: customerPhone } : {}),
      },
      item_details: [{
        id: plan.id,
        price: plan.price,
        quantity: 1,
        name: `Fluxa ${plan.name}`.slice(0, 50),
      }],
      enabled_payments: [
        'qris',
        'gopay',
        'shopeepay',
        'bank_transfer',
        'bca_va',
        'bni_va',
        'bri_va',
        'permata_va',
        'other_va',
        'credit_card',
      ],
      expiry: { unit: 'hour', duration: 24 },
      callbacks: {
        finish: finishUrl,
      },
    }

    let snapResponse: Response
    try {
      snapResponse = await fetch(config.snapUrl, {
        method: 'POST',
        headers: {
          Authorization: midtransAuthorization(config.serverKey),
          'Content-Type': 'application/json',
          'Idempotency-Key': orderId,
        },
        body: JSON.stringify(snapPayload),
        cache: 'no-store',
      })

      // If Midtrans rejects with 400 because specific payment methods in enabled_payments aren't activated on merchant account, retry with all merchant default methods
      if (!snapResponse.ok && snapResponse.status === 400) {
        console.warn('Midtrans Snap rejected enabled_payments constraint. Retrying with merchant defaults...')
        const fallbackPayload = {
          transaction_details: snapPayload.transaction_details,
          customer_details: snapPayload.customer_details,
          item_details: snapPayload.item_details,
          expiry: snapPayload.expiry,
          callbacks: snapPayload.callbacks,
        }
        snapResponse = await fetch(config.snapUrl, {
          method: 'POST',
          headers: {
            Authorization: midtransAuthorization(config.serverKey),
            'Content-Type': 'application/json',
            'Idempotency-Key': orderId,
          },
          body: JSON.stringify(fallbackPayload),
          cache: 'no-store',
        })
      }
    } catch (error) {
      const { error: updateError } = await admin.from('subscription_payments')
        .update({ status: 'failed', updated_at: new Date().toISOString() })
        .eq('id', payment.id)
      if (updateError) console.error('Unable to mark failed Snap checkout.', updateError)
      console.error('Midtrans Snap request failed.', error)
      return NextResponse.json({ error: 'Midtrans tidak dapat dijangkau. Silakan coba kembali.' }, { status: 502 })
    }

    const snapResult: unknown = await snapResponse.json()
    if (!snapResponse.ok || !snapResult || typeof snapResult !== 'object'
      || typeof (snapResult as Record<string, unknown>).token !== 'string'
      || typeof (snapResult as Record<string, unknown>).redirect_url !== 'string') {
      const { error: updateError } = await admin.from('subscription_payments')
        .update({ status: 'failed', updated_at: new Date().toISOString() })
        .eq('id', payment.id)
      if (updateError) throw updateError
      console.error('Midtrans Snap transaction creation failed.', { status: snapResponse.status, result: snapResult })
      return NextResponse.json({ error: 'Transaksi belum dapat dibuat oleh Midtrans. Silakan coba kembali.' }, { status: 502 })
    }

    const snap = snapResult as { token: string; redirect_url: string }
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    const { error: updateError } = await admin.from('subscription_payments')
      .update({
        snap_token: snap.token,
        snap_url: snap.redirect_url,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', payment.id)
    if (updateError) throw updateError

    // Record financial audit event for order creation as per FR-06
    try {
      await admin.from('audit_logs').insert({
        user_id: auth.user.id,
        action: 'SUBSCRIPTION_PAYMENT_ORDER_CREATED',
        table_name: 'subscription_payments',
        record_id: payment.id,
        new_data: {
          order_id: orderId,
          plan_name: plan.name,
          amount: plan.price,
          currency: 'IDR',
          status: 'pending',
          expires_at: expiresAt,
        },
      })
    } catch (auditErr) {
      console.error('Audit log for order creation failed (non-fatal):', auditErr)
    }

    return NextResponse.json({
      orderId,
      snapToken: snap.token,
      paymentUrl: snap.redirect_url,
      clientKey: config.clientKey,
      snapScriptUrl: config.snapScriptUrl,
      expiresAt,
    }, { status: 201 })
  } catch (error) {
    console.error('Unable to create subscription checkout.', error)
    const message = error instanceof Error && error.message.includes('MIDTRANS_SERVER_KEY')
      ? 'Pembayaran belum dikonfigurasi. Hubungi administrator.'
      : 'Transaksi belum dapat dibuat. Silakan coba kembali.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
