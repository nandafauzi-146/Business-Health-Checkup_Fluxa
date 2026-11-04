import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { generateCustomerServiceChatReply, ChatMessage } from '@intelligence/index'

// --- 1. Skema Validasi Ketat dengan Zod (Section 13: API Route and Input Validation) ---
const ChatMessageSchema = z.discriminatedUnion('role', [
  z.object({
    role: z.literal('user'),
    content: z
      .string()
      .trim()
      .min(1, 'Pesan tidak boleh kosong')
      .max(1000, 'Pesan melebihi batas maksimal 1000 karakter'),
  }),
  z.object({
    role: z.literal('assistant'),
    content: z
      .string()
      .trim()
      .min(1, 'Pesan tidak boleh kosong')
      .max(5000, 'Pesan asisten melebihi batas maksimal 5000 karakter'),
  }),
])

const ChatRequestBodySchema = z.object({
  messages: z
    .array(ChatMessageSchema)
    .min(1, 'Minimal harus ada 1 pesan')
    .max(10, 'Riwayat pesan maksimal 10 pesan'),
}).strict()

// --- 2. Rate Limiting Sederhana Berbasis Sliding Window (Section 14: Abuse Prevention) ---
interface RateLimitRecord {
  timestamps: number[]
}

const RATE_LIMIT_WINDOW_MS = 60 * 1000 // 1 menit
const MAX_REQUESTS_PER_WINDOW = 15 // Maks 15 request per IP per menit
const ipRateLimitStore = new Map<string, RateLimitRecord>()

// Bersihkan data lama setiap 5 menit
setInterval(() => {
  const now = Date.now()
  for (const [ip, record] of ipRateLimitStore.entries()) {
    record.timestamps = record.timestamps.filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS)
    if (record.timestamps.length === 0) {
      ipRateLimitStore.delete(ip)
    }
  }
}, 5 * 60 * 1000)

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const record = ipRateLimitStore.get(ip) || { timestamps: [] }
  record.timestamps = record.timestamps.filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS)

  if (record.timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    ipRateLimitStore.set(ip, record)
    return true
  }

  record.timestamps.push(now)
  ipRateLimitStore.set(ip, record)
  return false
}

export async function POST(req: NextRequest) {
  try {
    // A. Periksa Content-Type
    const contentType = req.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) {
      return NextResponse.json(
        { error: 'Format permintaan harus application/json' },
        { status: 415 }
      )
    }

    // B. Periksa Batas Ukuran Request Body (Maksimal 32 KB)
    const contentLength = Number(req.headers.get('content-length') || '0')
    if (contentLength > 32 * 1024) {
      return NextResponse.json(
        { error: 'Ukuran payload permintaan melebihi batas (maks 32KB)' },
        { status: 413 }
      )
    }

    // C. Abuse Prevention / Rate Limiting per IP
    const clientIp =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      req.headers.get('x-real-ip') ||
      'unknown-client'

    if (isRateLimited(clientIp)) {
      return NextResponse.json(
        {
          error: 'Terlalu banyak permintaan. Silakan tunggu beberapa saat sebelum mengirim pesan lagi.',
        },
        { status: 429 }
      )
    }

    // D. Parsing JSON Aman
    let rawBody: unknown
    try {
      rawBody = await req.json()
    } catch {
      return NextResponse.json({ error: 'Format JSON tidak valid' }, { status: 400 })
    }

    // E. Validasi Skema Zod
    const parseResult = ChatRequestBodySchema.safeParse(rawBody)
    if (!parseResult.success) {
      console.warn('Support Chat validation failed:', parseResult.error.format())
      return NextResponse.json(
        {
          error: 'Struktur pesan tidak valid atau melebihi batas yang diizinkan.',
        },
        { status: 400 }
      )
    }

    const { messages } = parseResult.data

    // F. Pesan terakhir harus berasal dari pengguna (role: 'user')
    if (messages[messages.length - 1].role !== 'user') {
      return NextResponse.json(
        { error: 'Pesan terakhir harus berasal dari pengguna.' },
        { status: 400 }
      )
    }

    // G. MURNI ASISTEN INFORMASI PUBLIK:
    // Tidak ada panggilan database Supabase, tidak ada query data toko, tidak ada autentikasi token internal.
    const result = await generateCustomerServiceChatReply(messages as ChatMessage[])

    // H. Kembalikan respons yang bersih & aman tanpa kebocoran server
    return NextResponse.json({
      reply: result.reply,
      source: result.source,
    })
  } catch (err: unknown) {
    // Redact internal stack traces from client responses (Section 13 & 17)
    console.error('Support Chat API error: [REDACTED]')
    return NextResponse.json(
      {
        reply:
          'Layanan asisten informasi sedang mengalami kendala teknis sementara. Silakan tanyakan langsung melalui kanal dukungan resmi Fluxa di WhatsApp +62 898-0148-297.',
        source: 'error_fallback',
      },
      { status: 200 }
    )
  }
}
