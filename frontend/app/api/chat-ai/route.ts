import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { buildChatContextBlock, generateAiChatReply, BusinessChatContext, ChatMessage } from '@intelligence/index'
import { fetchBusinessFinancialContext } from '@backend/index'

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json()
    if (!body || typeof body !== 'object' || !Array.isArray((body as { messages?: unknown }).messages)) {
      return NextResponse.json({ error: 'Format pesan tidak valid' }, { status: 400 })
    }
    const messages = (body as { messages: unknown[] }).messages
    if (
      messages.length === 0 ||
      messages.length > 20 ||
      messages.some(message =>
        !message || typeof message !== 'object' ||
        !['user', 'assistant'].includes(String((message as { role?: unknown }).role)) ||
        typeof (message as { content?: unknown }).content !== 'string' ||
        !(message as { content: string }).content.trim() ||
        (message as { content: string }).content.length > 4000
      ) ||
      (messages[messages.length - 1] as { role?: string }).role !== 'user'
    ) {
      return NextResponse.json({ error: 'Pesan tidak valid atau melebihi batas percakapan.' }, { status: 400 })
    }
    const validMessages = messages as { role: 'user' | 'assistant'; content: string }[]

    // Fetch business context from DB
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Silakan login.' }, { status: 401 })

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('full_name, role, approval_status')
      .eq('id', user.id)
      .single()
    if (profileError || profile?.role !== 'owner' || profile.approval_status !== 'approved') {
      return NextResponse.json({ error: 'Fitur ini hanya tersedia untuk Owner yang disetujui.' }, { status: 403 })
    }

    // Exclude AI Agent from free trial: require active paid subscription
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('status, current_period_end')
      .eq('owner_id', user.id)
      .maybeSingle()

    const hasActivePaidSubscription = Boolean(
      subscription &&
      ['active', 'cancelled'].includes(subscription.status) &&
      new Date(subscription.current_period_end).getTime() > Date.now()
    )

    if (!hasActivePaidSubscription) {
      return NextResponse.json(
        {
          error: 'Asisten AI (FluxAI) adalah fitur premium eksklusif paket berbayar dan tidak tercakup dalam free trial. Silakan aktifkan langganan Anda di menu Langganan.',
        },
        { status: 403 }
      )
    }

    const ctx = await fetchBusinessFinancialContext(supabase, {
      ownerName: profile.full_name || 'Pemilik',
    })

    const contextBlock = buildChatContextBlock(ctx)
    try {
      const result = await generateAiChatReply(validMessages as ChatMessage[], contextBlock)
      return NextResponse.json(result)
    } catch (aiErr: any) {
      return NextResponse.json(
        { error: aiErr?.message || 'Layanan AI saat ini tidak tersedia. Coba lagi nanti.' },
        { status: 503 }
      )
    }

  } catch (err: any) {
    console.error('Chat AI route error:', err)
    return NextResponse.json({ error: 'Layanan AI belum dapat memproses permintaan. Silakan coba lagi.' }, { status: 500 })
  }
}
