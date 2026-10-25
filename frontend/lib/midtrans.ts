import { createHash, timingSafeEqual } from 'node:crypto'

export type MidtransPaymentStatus =
  | 'pending'
  | 'success'
  | 'failed'
  | 'expired'
  | 'cancelled'
  | 'refunded'

export function getMidtransConfig() {
  const serverKey = process.env.MIDTRANS_SERVER_KEY
  const clientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY ?? ''
  const isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true'

  if (!serverKey) {
    throw new Error('MIDTRANS_SERVER_KEY belum dikonfigurasi.')
  }

  return {
    serverKey,
    clientKey,
    isProduction,
    snapUrl: isProduction
      ? 'https://app.midtrans.com/snap/v1/transactions'
      : 'https://app.sandbox.midtrans.com/snap/v1/transactions',
    apiUrl: isProduction
      ? 'https://api.midtrans.com/v2'
      : 'https://api.sandbox.midtrans.com/v2',
    paymentLinkApiUrl: isProduction
      ? 'https://api.midtrans.com/v1/payment-links'
      : 'https://api.sandbox.midtrans.com/v1/payment-links',
    snapScriptUrl: isProduction
      ? 'https://app.midtrans.com/snap/snap.js'
      : 'https://app.sandbox.midtrans.com/snap/snap.js',
  }
}

export function midtransAuthorization(serverKey: string) {
  return `Basic ${Buffer.from(`${serverKey}:`).toString('base64')}`
}

export function verifyMidtransSignature(
  orderId: string,
  statusCode: string,
  grossAmount: string,
  serverKey: string,
  signatureKey: string
): boolean {
  if (!orderId || !statusCode || !grossAmount || !serverKey || !signatureKey) {
    return false
  }

  const expected = createHash('sha512')
    .update(`${orderId}${statusCode}${grossAmount}${serverKey}`)
    .digest()

  let actual: Buffer
  try {
    actual = Buffer.from(signatureKey, 'hex')
  } catch {
    return false
  }

  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export function mapMidtransStatus(
  transactionStatus: unknown,
  fraudStatus?: unknown
): MidtransPaymentStatus | null {
  const statusStr = typeof transactionStatus === 'string' ? transactionStatus.toLowerCase() : ''
  const fraudStr = typeof fraudStatus === 'string' ? fraudStatus.toLowerCase() : ''

  switch (statusStr) {
    case 'settlement':
      return 'success'
    case 'capture':
      return fraudStr === 'challenge' ? 'pending' : 'success'
    case 'pending':
      return 'pending'
    case 'expire':
      return 'expired'
    case 'cancel':
      return 'cancelled'
    case 'deny':
    case 'failure':
      return 'failed'
    case 'refund':
      return 'refunded'
    default:
      return null
  }
}

export async function fetchMidtransTransactionStatus(
  orderId: string,
  config?: ReturnType<typeof getMidtransConfig>
) {
  const activeConfig = config ?? getMidtransConfig()
  const response = await fetch(
    `${activeConfig.apiUrl}/${encodeURIComponent(orderId)}/status`,
    {
      headers: {
        Authorization: midtransAuthorization(activeConfig.serverKey),
        Accept: 'application/json',
      },
      cache: 'no-store',
    }
  )

  if (!response.ok) {
    return { ok: false, status: response.status, data: null }
  }

  const data: unknown = await response.json()
  return { ok: true, status: response.status, data: data as Record<string, unknown> }
}

// --- Core API v2 Charge for method-specific payment details ---

export type CoreApiChargeResult = {
  ok: boolean
  paymentMethod: string
  orderId: string
  // QRIS specific
  qrCodeUrl?: string
  // Bank Transfer / VA specific
  vaNumber?: string
  vaBank?: string
  // General
  expiryTime?: string
  rawData?: Record<string, unknown>
  errorMessage?: string
}

export type SupportedBank = 'bca' | 'bni' | 'bri' | 'permata'
export const SUPPORTED_BANKS: SupportedBank[] = ['bca', 'bni', 'bri', 'permata']
export const BANK_LABELS: Record<SupportedBank, string> = {
  bca: 'BCA',
  bni: 'BNI',
  bri: 'BRI',
  permata: 'Permata',
}

export async function createCoreApiCharge(
  orderId: string,
  grossAmount: number,
  paymentMethod: 'qris' | 'bank_transfer',
  customerName: string,
  customerEmail: string,
  itemName: string,
  bank?: SupportedBank,
  config?: ReturnType<typeof getMidtransConfig>,
  customerPhone?: string
): Promise<CoreApiChargeResult> {
  const activeConfig = config ?? getMidtransConfig()

  // Build payment-type-specific payload
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: Record<string, any> = {
    payment_type: paymentMethod === 'qris' ? 'qris' : 'bank_transfer',
    transaction_details: {
      order_id: orderId,
      gross_amount: grossAmount,
    },
    customer_details: {
      first_name: customerName,
      email: customerEmail,
      ...(customerPhone ? { phone: customerPhone } : {}),
    },
    item_details: [{
      id: 'subscription',
      price: grossAmount,
      quantity: 1,
      name: itemName.slice(0, 50),
    }],
  }

  if (paymentMethod === 'qris') {
    payload.qris = { acquirer: 'gopay' }
  } else if (paymentMethod === 'bank_transfer' && bank) {
    payload.bank_transfer = { bank }
  }

  // Add custom expiry (24 hours from creation)
  payload.custom_expiry = {
    expiry_duration: 1440, // 24 hours in minutes
    unit: 'minute',
  }

  const response = await fetch(`${activeConfig.apiUrl}/charge`, {
    method: 'POST',
    headers: {
      Authorization: midtransAuthorization(activeConfig.serverKey),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
  })

  const data = (await response.json()) as Record<string, unknown>

  if (!response.ok || data.status_code === '500' || data.status_code === '400') {
    return {
      ok: false,
      paymentMethod,
      orderId,
      errorMessage: typeof data.status_message === 'string'
        ? data.status_message
        : 'Midtrans charge gagal.',
      rawData: data,
    }
  }

  const result: CoreApiChargeResult = {
    ok: true,
    paymentMethod,
    orderId,
    expiryTime: typeof data.expiry_time === 'string' ? data.expiry_time : undefined,
    rawData: data,
  }

  // Extract QRIS QR code URL from actions array
  if (paymentMethod === 'qris') {
    const actions = Array.isArray(data.actions) ? data.actions as Record<string, unknown>[] : []
    const generateQr = actions.find(
      (a) => a.name === 'generate-qr-code' && typeof a.url === 'string'
    )
    if (generateQr) {
      result.qrCodeUrl = generateQr.url as string
    }
  }

  // Extract VA number from va_numbers array
  if (paymentMethod === 'bank_transfer') {
    const vaNumbers = Array.isArray(data.va_numbers) ? data.va_numbers as Record<string, unknown>[] : []
    if (vaNumbers.length > 0) {
      result.vaNumber = typeof vaNumbers[0].va_number === 'string' ? vaNumbers[0].va_number : undefined
      result.vaBank = typeof vaNumbers[0].bank === 'string' ? vaNumbers[0].bank : undefined
    }
    // Permata uses permata_va_number at top level
    if (!result.vaNumber && typeof data.permata_va_number === 'string') {
      result.vaNumber = data.permata_va_number
      result.vaBank = 'permata'
    }
  }

  return result
}

export async function cancelMidtransTransaction(
  orderId: string,
  config?: ReturnType<typeof getMidtransConfig>
) {
  const activeConfig = config ?? getMidtransConfig()
  const response = await fetch(
    `${activeConfig.apiUrl}/${encodeURIComponent(orderId)}/cancel`,
    {
      method: 'POST',
      headers: {
        Authorization: midtransAuthorization(activeConfig.serverKey),
        Accept: 'application/json',
      },
      cache: 'no-store',
    }
  )
  return { ok: response.ok, status: response.status }
}

// --- Midtrans Payment Link API (v1) ---

export type MidtransPaymentLinkItem = {
  id: string
  name: string
  price: number
  quantity: number
  brand?: string
  category?: string
  merchant_name?: string
}

export type MidtransPaymentLinkPayload = {
  transaction_details: {
    order_id: string
    gross_amount: number
    payment_link_id?: string
  }
  title: string
  item_details?: MidtransPaymentLinkItem[]
  usage_limit?: number
  expiry?: {
    start_time?: string
    duration: number
    unit: 'days' | 'hours' | 'minutes'
  }
  customer_required?: boolean
  customer_details?: {
    first_name?: string
    last_name?: string
    email?: string
    phone?: string
    notes?: string
  }
  enabled_payments?: string[]
}

export type MidtransPaymentLinkResult = {
  ok: boolean
  status: number
  orderId?: string
  paymentUrl?: string
  qrUrl?: string
  errorMessage?: string
  raw?: unknown
}

export async function createMidtransPaymentLink(
  payload: MidtransPaymentLinkPayload,
  config?: ReturnType<typeof getMidtransConfig>
): Promise<MidtransPaymentLinkResult> {
  const activeConfig = config ?? getMidtransConfig()

  try {
    const response = await fetch(activeConfig.paymentLinkApiUrl, {
      method: 'POST',
      headers: {
        Authorization: midtransAuthorization(activeConfig.serverKey),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    })

    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>

    if (!response.ok || !data.payment_url) {
      const errorMsg =
        (Array.isArray(data.error_messages) ? (data.error_messages as string[]).join(', ') : null) ||
        (typeof data.message === 'string' ? data.message : null) ||
        (typeof data.status_message === 'string' ? data.status_message : null) ||
        `Midtrans Payment Link API error (${response.status})`

      return {
        ok: false,
        status: response.status,
        orderId: payload.transaction_details.order_id,
        errorMessage: errorMsg,
        raw: data,
      }
    }

    return {
      ok: true,
      status: response.status,
      orderId: typeof data.order_id === 'string' ? data.order_id : payload.transaction_details.order_id,
      paymentUrl: data.payment_url as string,
      qrUrl: typeof data.qr_url === 'string' ? data.qr_url : undefined,
      raw: data,
    }
  } catch (err) {
    return {
      ok: false,
      status: 500,
      orderId: payload.transaction_details.order_id,
      errorMessage: err instanceof Error ? err.message : 'Koneksi ke Midtrans Payment Link gagal.',
    }
  }
}

export async function getMidtransPaymentLink(
  orderId: string,
  config?: ReturnType<typeof getMidtransConfig>
): Promise<{ ok: boolean; status: number; data?: Record<string, unknown>; error?: string }> {
  const activeConfig = config ?? getMidtransConfig()

  try {
    const response = await fetch(`${activeConfig.paymentLinkApiUrl}/${encodeURIComponent(orderId)}`, {
      headers: {
        Authorization: midtransAuthorization(activeConfig.serverKey),
        Accept: 'application/json',
      },
      cache: 'no-store',
    })

    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>
    if (!response.ok) {
      return { ok: false, status: response.status, error: (data.message as string) || 'Payment Link tidak ditemukan.' }
    }

    return { ok: true, status: response.status, data }
  } catch (err) {
    return { ok: false, status: 500, error: err instanceof Error ? err.message : 'Koneksi ke Midtrans gagal.' }
  }
}

export async function deleteMidtransPaymentLink(
  orderId: string,
  config?: ReturnType<typeof getMidtransConfig>
): Promise<{ ok: boolean; status: number; message?: string }> {
  const activeConfig = config ?? getMidtransConfig()

  try {
    const response = await fetch(`${activeConfig.paymentLinkApiUrl}/${encodeURIComponent(orderId)}`, {
      method: 'DELETE',
      headers: {
        Authorization: midtransAuthorization(activeConfig.serverKey),
        Accept: 'application/json',
      },
      cache: 'no-store',
    })

    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>
    return {
      ok: response.ok,
      status: response.status,
      message: typeof data.message === 'string' ? data.message : undefined,
    }
  } catch {
    return { ok: false, status: 500 }
  }
}
