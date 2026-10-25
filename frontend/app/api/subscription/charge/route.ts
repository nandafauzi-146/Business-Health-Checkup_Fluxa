import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import {
  createCoreApiCharge,
  getMidtransConfig,
  SUPPORTED_BANKS,
  type SupportedBank,
} from '@/lib/midtrans'

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
    .select('role, approval_status, email, full_name, phone, trial_ends_at, registration_path')
    .eq('id', user.id)
    .maybeSingle()

  if (error && String(error.message || '').includes('registration_path')) {
    const fallback = await supabase
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

/**
 * POST /api/subscription/charge
 * Creates a Core API charge for a specific payment method (QRIS or bank_transfer).
 *
 * Body: { planId: string, paymentMethod: 'qris' | 'bank_transfer', bank?: string }
 *
 * Returns: { orderId, paymentMethod, qrCodeUrl?, vaNumber?, vaBank?, expiryTime?, expiresAt, snapToken?, snapUrl? }
 */
export async function POST(request: Request) {
  try {
    const auth = await requireOwner()
    if (auth.response) return auth.response
    if (!auth.user) return NextResponse.json({ error: 'Sesi Owner tidak valid.' }, { status: 401 })

    const body: unknown = await request.json().catch(() => ({}))
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 })
    }

    const { planId, paymentMethod, bank, name: bodyName, email: bodyEmail, phone: bodyPhone } = body as Record<string, unknown>
    if (typeof planId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(planId)) {
      return NextResponse.json({ error: 'ID paket tidak valid.' }, { status: 400 })
    }
    if (paymentMethod !== 'qris' && paymentMethod !== 'bank_transfer') {
      return NextResponse.json({ error: 'Metode pembayaran harus qris atau bank_transfer.' }, { status: 400 })
    }
    if (paymentMethod === 'bank_transfer') {
      if (typeof bank !== 'string' || !SUPPORTED_BANKS.includes(bank as SupportedBank)) {
        return NextResponse.json({ error: 'Bank VA tidak didukung. Pilih: bca, bni, bri, atau permata.' }, { status: 400 })
      }
    }

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

    const admin = getServiceClient()

    // Save phone to profile if it wasn't saved before
    if (customerPhone && !auth.user.profile.phone) {
      void admin.from('profiles').update({ phone: customerPhone, updated_at: new Date().toISOString() }).eq('id', auth.user.id)
    }

    // Fetch plan
    const { data: plan, error: planError } = await admin.from('subscription_plans')
      .select('id, name, price, duration_days')
      .eq('id', planId)
      .eq('is_active', true)
      .maybeSingle()
    if (planError) throw planError
    if (!plan) return NextResponse.json({ error: 'Paket tidak ditemukan atau sudah tidak aktif.' }, { status: 404 })
    if (plan.price <= 0) return NextResponse.json({ error: 'Paket gratis tidak memerlukan pembayaran.' }, { status: 400 })

    const config = getMidtransConfig()

    // Deduplication: check for recent pending payment for the same plan (within 30 seconds)
    const { data: recentPayment } = await admin.from('subscription_payments')
      .select('id, order_id, snap_token, snap_url, expires_at, created_at, status')
      .eq('owner_id', auth.user.id)
      .eq('plan_id', plan.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // If there's a valid pending payment created in the last 30 seconds, don't create a new one
    if (recentPayment && recentPayment.expires_at) {
      const diffMs = Date.now() - new Date(recentPayment.created_at).getTime()
      if (diffMs < 30000) {
        // Try to create the Core API charge using the existing order ID
        const chargeResult = await createCoreApiCharge(
          recentPayment.order_id,
          plan.price,
          paymentMethod as 'qris' | 'bank_transfer',
          customerName,
          customerEmail,
          `Fluxa ${plan.name}`,
          paymentMethod === 'bank_transfer' ? (bank as SupportedBank) : undefined,
          config,
          customerPhone,
        )

        if (chargeResult.ok) {
          return NextResponse.json({
            orderId: recentPayment.order_id,
            paymentMethod: chargeResult.paymentMethod,
            qrCodeUrl: chargeResult.qrCodeUrl,
            vaNumber: chargeResult.vaNumber,
            vaBank: chargeResult.vaBank,
            expiryTime: chargeResult.expiryTime,
            expiresAt: recentPayment.expires_at,
            snapToken: recentPayment.snap_token,
            snapUrl: recentPayment.snap_url,
            reused: true,
          })
        }
        // If Core API charge failed (e.g. order_id already used for different payment type),
        // fall through and create a new order
      }
    }

    // Create a fresh order
    const orderId = `FLX-${crypto.randomUUID()}`
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    const { data: payment, error: paymentError } = await admin.from('subscription_payments')
      .insert({
        order_id: orderId,
        owner_id: auth.user.id,
        plan_id: plan.id,
        plan_name: plan.name,
        duration_days: plan.duration_days,
        amount: plan.price,
        expires_at: expiresAt,
      })
      .select('id')
      .single()
    if (paymentError) throw paymentError

    // Create Core API charge
    const chargeResult = await createCoreApiCharge(
      orderId,
      plan.price,
      paymentMethod as 'qris' | 'bank_transfer',
      customerName,
      customerEmail,
      `Fluxa ${plan.name}`,
      paymentMethod === 'bank_transfer' ? (bank as SupportedBank) : undefined,
      config,
      customerPhone,
    )

    if (!chargeResult.ok) {
      // Mark payment as failed if Core API charge fails
      await admin.from('subscription_payments')
        .update({ status: 'failed', updated_at: new Date().toISOString() })
        .eq('id', payment.id)

      console.error('Core API charge failed:', chargeResult.errorMessage, chargeResult.rawData)
      return NextResponse.json({
        error: chargeResult.errorMessage || 'Midtrans tidak dapat memproses pembayaran. Silakan coba metode lain.',
      }, { status: 502 })
    }

    // Audit log
    try {
      await admin.from('audit_logs').insert({
        user_id: auth.user.id,
        action: 'SUBSCRIPTION_CORE_CHARGE_CREATED',
        table_name: 'subscription_payments',
        record_id: payment.id,
        new_data: {
          order_id: orderId,
          plan_name: plan.name,
          amount: plan.price,
          payment_method: paymentMethod,
          bank: bank ?? null,
          expires_at: expiresAt,
        },
      })
    } catch (auditErr) {
      console.error('Audit log for Core API charge failed (non-fatal):', auditErr)
    }

    return NextResponse.json({
      orderId,
      paymentMethod: chargeResult.paymentMethod,
      qrCodeUrl: chargeResult.qrCodeUrl,
      vaNumber: chargeResult.vaNumber,
      vaBank: chargeResult.vaBank,
      expiryTime: chargeResult.expiryTime,
      expiresAt,
    }, { status: 201 })
  } catch (error) {
    console.error('Unable to create Core API charge.', error)
    const message = error instanceof Error && error.message.includes('MIDTRANS_SERVER_KEY')
      ? 'Pembayaran belum dikonfigurasi. Hubungi administrator.'
      : 'Transaksi belum dapat dibuat. Silakan coba kembali.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
