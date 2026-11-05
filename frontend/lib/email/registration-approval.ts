import 'server-only'

interface RegistrationApprovalEmail {
  email: string
  fullName: string
  trialEndsAt: string
}

type ResendResult =
  | { sent: true }
  | { sent: false; message: string }

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

export async function sendRegistrationApprovalEmail({
  email,
  fullName,
  trialEndsAt,
}: RegistrationApprovalEmail): Promise<ResendResult> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL
  if (!apiKey || !from) {
    return {
      sent: false,
      message: 'Email belum dikirim. Lengkapi RESEND_API_KEY dan RESEND_FROM_EMAIL di environment server.',
    }
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://business-health-checkup-fluxa.vercel.app')
    .replace(/\/+$/, '')
  const loginUrl = `${siteUrl}/login`
  const trialEndDate = new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'long',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(trialEndsAt))
  const safeName = escapeHtml(fullName)

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: 'Pendaftaran Fluxa Anda telah disetujui',
      text: [
        `Halo ${fullName},`,
        '',
        'Kabar baik! Pendaftaran akun Fluxa Anda telah disetujui.',
        `Masa uji coba gratis Anda aktif sampai ${trialEndDate}.`,
        '',
        `Masuk ke akun Anda: ${loginUrl}`,
        '',
        'Terima kasih telah menggunakan Fluxa.',
      ].join('\n'),
      html: `
        <div style="background:#f4f7fb;padding:32px 16px;font-family:Arial,sans-serif;color:#172033">
          <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5eaf2;border-radius:16px;padding:32px">
            <p style="margin:0 0 24px;color:#315efb;font-size:20px;font-weight:700">Fluxa</p>
            <h1 style="margin:0 0 16px;font-size:24px">Pendaftaran Anda disetujui</h1>
            <p style="font-size:15px;line-height:1.6">Halo ${safeName}, pendaftaran akun Fluxa Anda sudah disetujui. Anda kini dapat masuk dan mulai menggunakan layanan Fluxa.</p>
            <p style="font-size:15px;line-height:1.6">Masa uji coba gratis Anda aktif sampai <strong>${trialEndDate}</strong>.</p>
            <p style="margin:28px 0">
              <a href="${loginUrl}" style="display:inline-block;background:#315efb;color:#fff;text-decoration:none;padding:12px 20px;border-radius:9px;font-weight:700">Masuk ke Fluxa</a>
            </p>
            <p style="margin:24px 0 0;color:#667085;font-size:13px;line-height:1.6">Jika Anda tidak merasa mendaftar di Fluxa, silakan abaikan email ini.</p>
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

  return { sent: true }
}
