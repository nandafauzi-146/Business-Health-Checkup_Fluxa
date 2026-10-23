import { createHash, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { getMidtransConfig, midtransAuthorization } from '@/lib/midtrans'
import { getSuperAdminServiceClient } from '@/lib/supabase/super-admin'

type MidtransNotification = {
  order_id?: unknown
  status_code?: unknown
  gross_amount?: unknown
  signature_key?: unknown
  transaction_id?: unknown
  transaction_status?: unknown
  fraud_status?: unknown
  transaction_time?: unknown
}

function verifySignature(notification: MidtransNotification, serverKey: string) {
  if (typeof notification.order_id !== 'string'
    || typeof notification.status_code !== 'string'
    || typeof notification.gross_amount !== 'string'
    || typeof notification.signature_key !== 'string') return false

  const expected = createHash('sha512')
    .update(`${notification.order_id}${notification.status_code}${notification.gross_amount}${serverKey}`)
    .digest()
  let actual: Buffer
  try {
    actual = Buffer.from(notification.signature_key, 'hex')
  } catch {
    return false
  }
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export async function POST(request: Request) {
  try {
    const text = await request.text()
    if (text.length > 32_768) {
      return NextResponse.json({ error: 'Notifikasi terlalu besar.' }, { status: 413 })
    }

    let notification: MidtransNotification
    try {
      notification = JSON.parse(text) as MidtransNotification
    } catch {
      return NextResponse.json({ error: 'Format notifikasi tidak valid.' }, { status: 400 })
    }

    const config = getMidtransConfig()
    if (!verifySignature(notification, config.serverKey)) {
      return NextResponse.json({ error: 'Signature notifikasi tidak valid.' }, { status: 401 })
    }
    if (typeof notification.order_id !== 'string'
      || !/^FLX-[0-9a-f-]{36}$/i.test(notification.order_id)) {
      return NextResponse.json({ error: 'Order ID tidak valid.' }, { status: 400 })
    }

    const admin = getSuperAdminServiceClient()
    const { data: payment, error: paymentError } = await admin.from('subscription_payments')
      .select('id, amount, status')
      .eq('order_id', notification.order_id)
      .maybeSingle()
    if (paymentError) throw paymentError
    if (!payment) return NextResponse.json({ error: 'Transaksi tidak ditemukan.' }, { status: 404 })

    const statusResponse = await fetch(
      `${config.apiUrl}/${encodeURIComponent(notification.order_id)}/status`,
      {
        headers: { Authorization: midtransAuthorization(config.serverKey) },
        cache: 'no-store',
      },
    )
    const verified: unknown = await statusResponse.json()
    if (!statusResponse.ok || !verified || typeof verified !== 'object') {
      console.error('Unable to verify Midtrans transaction status.', { status: statusResponse.status })
      return NextResponse.json({ error: 'Status transaksi belum dapat diverifikasi.' }, { status: 502 })
    }

    const result = verified as Record<string, unknown>
    if (result.order_id !== notification.order_id
      || typeof result.gross_amount !== 'string'
      || Number(result.gross_amount) !== payment.amount) {
      return NextResponse.json({ error: 'Detail transaksi tidak cocok.' }, { status: 400 })
    }

    let status: 'pending' | 'success' | 'failed' | 'expired' | 'cancelled' | 'refunded'
    switch (result.transaction_status) {
      case 'settlement':
        status = 'success'
        break
      case 'capture':
        status = result.fraud_status === 'accept' ? 'success' : 'pending'
        break
      case 'pending':
        status = 'pending'
        break
      case 'expire':
        status = 'expired'
        break
      case 'cancel':
        status = 'cancelled'
        break
      case 'deny':
        status = 'failed'
        break
      case 'refund':
        status = 'refunded'
        break
      case 'partial_refund':
        return NextResponse.json({ error: 'Refund parsial perlu rekonsiliasi manual sebelum diproses.' }, { status: 422 })
      default:
        return NextResponse.json({ error: 'Status Midtrans belum didukung.' }, { status: 400 })
    }

    const { error: applyError } = await admin.rpc('apply_midtrans_subscription_payment', {
      p_order_id: notification.order_id,
      p_status: status,
      p_transaction_id: typeof result.transaction_id === 'string' ? result.transaction_id : null,
      p_paid_at: typeof result.transaction_time === 'string' ? result.transaction_time : null,
    })
    if (applyError) throw applyError

    // Record financial audit event as per FR-06
    try {
      await admin.from('audit_logs').insert({
        action: 'MIDTRANS_WEBHOOK_PROCESSED',
        table_name: 'subscription_payments',
        record_id: payment.id,
        old_data: { status: payment.status },
        new_data: {
          status,
          order_id: notification.order_id,
          transaction_id: typeof result.transaction_id === 'string' ? result.transaction_id : null,
          payment_type: typeof result.payment_type === 'string' ? result.payment_type : 'unknown',
        },
      })
    } catch (auditErr) {
      console.error('Audit log for midtrans webhook failed (non-fatal):', auditErr)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Unable to process Midtrans notification.', error)
    return NextResponse.json({ error: 'Notifikasi pembayaran belum dapat diproses.' }, { status: 500 })
  }
}
