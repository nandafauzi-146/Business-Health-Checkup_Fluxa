import { NextResponse } from 'next/server'
import {
  getSuperAdminServiceClient,
  requireSuperAdmin,
  writeSuperAdminAudit,
} from '@/lib/supabase/super-admin'
import { syncPlanPaymentLink } from '@/lib/plan-payment-link'

export async function POST(request: Request) {
  try {
    const auth = await requireSuperAdmin()
    if (auth.response) return auth.response
    if (!auth.actorId) return NextResponse.json({ error: 'Sesi Super Admin tidak valid.' }, { status: 401 })

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const planId = typeof body.planId === 'string' ? body.planId.trim() : ''

    if (!planId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(planId)) {
      return NextResponse.json({ error: 'ID paket tidak valid.' }, { status: 400 })
    }

    const admin = getSuperAdminServiceClient()
    const result = await syncPlanPaymentLink(admin, planId, { forceNew: true })

    if (result.payment_link_status === 'failed') {
      await writeSuperAdminAudit(
        admin,
        auth.actorId,
        'SUPER_ADMIN_PAYMENT_LINK_SYNC_FAILED',
        planId,
        {},
        { error: result.payment_link_error || 'Gagal sinkronisasi link Midtrans' }
      )
      return NextResponse.json(
        { error: result.payment_link_error || 'Gagal membuat payment link di Midtrans.', details: result },
        { status: 502 }
      )
    }

    await writeSuperAdminAudit(
      admin,
      auth.actorId,
      'SUPER_ADMIN_PAYMENT_LINK_SYNCED',
      planId,
      {},
      {
        payment_link_url: result.payment_link_url,
        payment_link_order_id: result.payment_link_order_id,
        status: result.payment_link_status,
      }
    )

    return NextResponse.json({
      success: true,
      paymentLink: result,
      message: 'Payment link berhasil dibuat dan disinkronkan dengan Midtrans.',
    })
  } catch (error) {
    console.error('Error syncing plan payment link:', error)
    return NextResponse.json({ error: 'Terjadi kendala saat sinkronisasi link pembayaran.' }, { status: 500 })
  }
}
