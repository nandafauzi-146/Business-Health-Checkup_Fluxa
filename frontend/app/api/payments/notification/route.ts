import { NextResponse } from 'next/server'
import {
  fetchMidtransTransactionStatus,
  getMidtransConfig,
  mapMidtransStatus,
  verifyMidtransSignature,
} from '@/lib/midtrans'
import { getSuperAdminServiceClient } from '@/lib/supabase/super-admin'
import { applySubscriptionPayment } from '@/lib/subscription-payment-sync'

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

    const orderId = typeof notification.order_id === 'string' ? notification.order_id : ''
    const statusCode = typeof notification.status_code === 'string' ? notification.status_code : ''
    const grossAmount = typeof notification.gross_amount === 'string' ? notification.gross_amount : ''
    const signatureKey = typeof notification.signature_key === 'string' ? notification.signature_key : ''

    if (!verifyMidtransSignature(orderId, statusCode, grossAmount, config.serverKey, signatureKey)) {
      return NextResponse.json({ error: 'Signature notifikasi tidak valid.' }, { status: 401 })
    }

    if (!orderId || !/^FLX-[0-9a-zA-Z_-]+$/i.test(orderId)) {
      return NextResponse.json({ error: 'Order ID tidak valid.' }, { status: 400 })
    }

    const admin = getSuperAdminServiceClient()
    const { data: payment, error: paymentError } = await admin.from('subscription_payments')
      .select('id, amount, status')
      .eq('order_id', orderId)
      .maybeSingle()
    if (paymentError) throw paymentError
    if (!payment) return NextResponse.json({ error: 'Transaksi tidak ditemukan.' }, { status: 404 })

    // Idempotency: if already success or refunded, return acknowledged
    if (payment.status === 'success' || payment.status === 'refunded') {
      return NextResponse.json({ received: true, alreadyProcessed: true })
    }

    const midtransRes = await fetchMidtransTransactionStatus(orderId, config)
    if (!midtransRes.ok || !midtransRes.data) {
      console.error('Unable to verify Midtrans transaction status.', { status: midtransRes.status })
      return NextResponse.json({ error: 'Status transaksi belum dapat diverifikasi.' }, { status: 502 })
    }

    const result = midtransRes.data
    const verifiedGross = typeof result.gross_amount === 'string'
      ? Math.round(Number.parseFloat(result.gross_amount))
      : Number(result.gross_amount)

    if (result.order_id !== orderId || (verifiedGross && verifiedGross !== payment.amount)) {
      return NextResponse.json({ error: 'Detail transaksi tidak cocok.' }, { status: 400 })
    }

    if (result.transaction_status === 'partial_refund') {
      return NextResponse.json({ error: 'Refund parsial perlu rekonsiliasi manual.' }, { status: 422 })
    }

    const status = mapMidtransStatus(result.transaction_status, result.fraud_status)
    if (!status) {
      return NextResponse.json({ error: 'Status Midtrans belum didukung.' }, { status: 400 })
    }

    const applyResult = await applySubscriptionPayment(admin, {
      orderId,
      status,
      transactionId: typeof result.transaction_id === 'string' ? result.transaction_id : null,
      paidAt: typeof result.transaction_time === 'string' ? result.transaction_time : null,
    })
    if (!applyResult.success) {
      console.error('applySubscriptionPayment warning:', applyResult.error)
    }

    // Record audit log
    try {
      await admin.from('audit_logs').insert({
        action: 'MIDTRANS_WEBHOOK_PROCESSED',
        table_name: 'subscription_payments',
        record_id: payment.id,
        new_data: {
          order_id: orderId,
          status,
          transaction_id: result.transaction_id,
          endpoint: '/api/payments/notification',
        },
      })
    } catch (auditErr) {
      console.error('Audit log non-fatal error:', auditErr)
    }

    return NextResponse.json({ received: true, status })
  } catch (error) {
    console.error('Error handling Midtrans payment notification:', error)
    return NextResponse.json({ error: 'Notifikasi belum dapat diproses.' }, { status: 500 })
  }
}
