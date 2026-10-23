import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import { getMidtransConfig, midtransAuthorization } from '@/lib/midtrans'

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

export async function GET() {
  try {
    const auth = await requireOwner()
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
        .select('id, order_id, plan_name, amount, status, created_at, paid_at, expires_at')
        .eq('owner_id', auth.user.id)
        .order('created_at', { ascending: false })
        .limit(50),
    ])
    const error = plansResult.error || subscriptionResult.error || paymentsResult.error
    if (error) throw error

    return NextResponse.json({
      plans: plansResult.data ?? [],
      subscription: subscriptionResult.data,
      payments: paymentsResult.data ?? [],
      trialEndsAt: auth.user.profile.trial_ends_at ?? null,
    })
  } catch (error) {
    console.error('Unable to load subscription details.', error)
    return NextResponse.json({ error: 'Informasi subscription belum dapat dimuat.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireOwner()
    if (auth.response) return auth.response
    if (!auth.user) return NextResponse.json({ error: 'Sesi Owner tidak valid.' }, { status: 401 })

    const body: unknown = await request.json()
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

    let snapResponse: Response
    try {
      snapResponse = await fetch(config.snapUrl, {
        method: 'POST',
        headers: {
          Authorization: midtransAuthorization(config.serverKey),
          'Content-Type': 'application/json',
          'Idempotency-Key': orderId,
        },
        body: JSON.stringify({
          transaction_details: { order_id: orderId, gross_amount: plan.price },
          customer_details: {
            first_name: auth.user.profile.full_name,
            email: auth.user.email,
          },
          item_details: [{
            id: plan.id,
            price: plan.price,
            quantity: 1,
            name: `Fluxa ${plan.name}`.slice(0, 50),
          }],
          expiry: { unit: 'hour', duration: 24 },
        }),
        cache: 'no-store',
      })
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
      console.error('Midtrans Snap transaction creation failed.', { status: snapResponse.status })
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
        },
      })
    } catch (auditErr) {
      console.error('Audit log for order creation failed (non-fatal):', auditErr)
    }

    return NextResponse.json({
      orderId,
      snapToken: snap.token,
      paymentUrl: snap.redirect_url,
      clientKey: process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY ?? '',
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
