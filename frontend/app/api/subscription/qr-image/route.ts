import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import {
  fetchMidtransTransactionStatus,
  getMidtransConfig,
  midtransAuthorization,
} from '@/lib/midtrans'
import { generateQrSvg } from '@/lib/qr-generator'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('Konfigurasi Supabase server belum lengkap.')
  return createSupabaseAdminClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/**
 * GET /api/subscription/qr-image?order_id=FLX-...
 * Secure authenticated endpoint that serves the QRIS image (PNG or SVG)
 * for an owner's active subscription payment without exposing Midtrans server credentials.
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return new Response('Unauthorized', { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const orderId = searchParams.get('order_id') || searchParams.get('orderId')
    if (!orderId) {
      return new Response('Order ID required', { status: 400 })
    }

    const admin = getServiceClient()
    const { data: payment, error: paymentError } = await admin
      .from('subscription_payments')
      .select('id, order_id, owner_id, status, expires_at, snap_token')
      .eq('order_id', orderId)
      .maybeSingle()

    if (paymentError || !payment) {
      return new Response('Payment not found', { status: 404 })
    }

    // Security check: only the owner or super_admin can view this payment QR code
    if (payment.owner_id !== user.id) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
      if (profile?.role !== 'super_admin') {
        return new Response('Forbidden', { status: 403 })
      }
    }

    // 1. Direct fast path: If snap_token has stored raw EMVCo QRIS (prefixed with qris:), render SVG immediately!
    if (payment.snap_token?.startsWith('qris:')) {
      const rawQr = payment.snap_token.slice(5)
      const svg = generateQrSvg(rawQr)
      return new Response(svg, {
        headers: {
          'Content-Type': 'image/svg+xml; charset=utf-8',
          'Cache-Control': 'public, max-age=86400',
        },
      })
    }

    let config: ReturnType<typeof getMidtransConfig>
    try {
      config = getMidtransConfig()
    } catch {
      return new Response('Midtrans configuration error', { status: 500 })
    }

    const midtransRes = await fetchMidtransTransactionStatus(orderId, config)
    if (!midtransRes.ok || !midtransRes.data) {
      return new Response('QR code not available for this transaction yet', { status: 404 })
    }

    const data = midtransRes.data
    const actions = Array.isArray(data.actions) ? data.actions as Record<string, unknown>[] : []
    const generateQr = actions.find(
      (a) => a.name === 'generate-qr-code' && typeof a.url === 'string'
    )

    // Primary: fetch PNG directly from Midtrans endpoint using Server Key
    if (generateQr && typeof generateQr.url === 'string') {
      try {
        const qrRes = await fetch(generateQr.url, {
          headers: {
            Authorization: midtransAuthorization(config.serverKey),
            Accept: 'image/png, image/*, */*',
          },
          cache: 'no-store',
        })
        if (qrRes.ok) {
          const buffer = await qrRes.arrayBuffer()
          const contentType = qrRes.headers.get('content-type') || 'image/png'
          return new Response(buffer, {
            headers: {
              'Content-Type': contentType,
              'Cache-Control': 'private, max-age=3600',
            },
          })
        }
      } catch (fetchErr) {
        console.warn('Direct Midtrans QR fetch failed, falling back to SVG:', fetchErr)
      }
    }

    // Fallback: Generate SVG from raw EMVCo qr_string
    if (typeof data.qr_string === 'string') {
      const svg = generateQrSvg(data.qr_string)
      return new Response(svg, {
        headers: {
          'Content-Type': 'image/svg+xml; charset=utf-8',
          'Cache-Control': 'private, max-age=3600',
        },
      })
    }

    return new Response('QR code data not found in payment response', { status: 404 })
  } catch (error) {
    console.error('Error serving QR image:', error)
    return new Response('Internal server error', { status: 500 })
  }
}

