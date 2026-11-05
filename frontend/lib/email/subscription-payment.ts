import 'server-only'

interface SubscriptionPaymentEmail {
  paymentId: string
  email: string
  fullName: string
  planName: string
  amount: number
  orderId: string
  paidAt: string
  subscriptionEndsAt: string | null
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(value))
}

export async function sendSubscriptionPaymentEmail({
  paymentId,
  email,
  fullName,
  planName,
  amount,
  orderId,
  paidAt,
  subscriptionEndsAt,
}: SubscriptionPaymentEmail) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL
  if (!apiKey || !from) {
    console.error('Subscription payment is confirmed, but email is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL.')
    return
  }

  const loginUrl = `${(process.env.NEXT_PUBLIC_SITE_URL || 'https://business-health-checkup-fluxa.vercel.app').replace(/\/+$/, '')}/login`
  const safeName = escapeHtml(fullName)
  const safePlanName = escapeHtml(planName)
  const formattedAmount = `Rp ${new Intl.NumberFormat('id-ID').format(amount)}`
  const formattedPaidAt = formatDate(paidAt)
  const endDate = subscriptionEndsAt ? formatDate(subscriptionEndsAt) : null
  const text = [
    `Halo ${fullName},`,
    '',
    'Pembayaran langganan Fluxa Anda telah berhasil.',
    `Paket: ${planName}`,
    `Nominal: ${formattedAmount}`,
    `Nomor tagihan: ${orderId}`,
    `Waktu pembayaran: ${formattedPaidAt}`,
    ...(endDate ? [`Langganan aktif sampai: ${endDate}`] : []),
    '',
    `Masuk ke akun Fluxa: ${loginUrl}`,
    '',
    'Terima kasih telah berlangganan Fluxa.',
  ].join('\n')

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `fluxa-subscription-payment-${paymentId}`,
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: 'Pembayaran langganan Fluxa berhasil',
      text,
      html: `
        <div style="background:#f4f7fb;padding:32px 16px;font-family:Arial,sans-serif;color:#172033">
          <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5eaf2;border-radius:16px;padding:32px">
            <p style="margin:0 0 24px;color:#315efb;font-size:20px;font-weight:700">Fluxa</p>
            <h1 style="margin:0 0 16px;font-size:24px">Pembayaran berhasil</h1>
            <p style="font-size:15px;line-height:1.6">Halo ${safeName}, pembayaran langganan Fluxa Anda telah berhasil kami terima.</p>
            <div style="padding:16px;border-radius:10px;background:#f4f7fb;font-size:14px;line-height:1.9">
              <div>Paket: <strong>${safePlanName}</strong></div>
              <div>Nominal: <strong>${formattedAmount}</strong></div>
              <div>Nomor tagihan: <strong>${escapeHtml(orderId)}</strong></div>
              <div>Waktu pembayaran: <strong>${formattedPaidAt}</strong></div>
              ${endDate ? `<div>Langganan aktif sampai: <strong>${endDate}</strong></div>` : ''}
            </div>
            <p style="margin:28px 0">
              <a href="${loginUrl}" style="display:inline-block;background:#315efb;color:#fff;text-decoration:none;padding:12px 20px;border-radius:9px;font-weight:700">Masuk ke Fluxa</a>
            </p>
            <p style="margin:24px 0 0;color:#667085;font-size:13px;line-height:1.6">Terima kasih telah berlangganan Fluxa.</p>
          </div>
        </div>
      `,
    }),
    signal: AbortSignal.timeout(10000),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Resend request failed (${response.status}): ${errorText.slice(0, 500)}`)
  }
}
