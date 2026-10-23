import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const CHAT_SYSTEM_PROMPT = `
Anda adalah "FluxAI", asisten bisnis cerdas dan konsultan keuangan eksekutif untuk pemilik UMKM Indonesia.

Konteks & Persona:
- Anda memiliki akses lengkap ke data keuangan riil toko (omzet, laba, piutang, stok, pengeluaran) yang disertakan dalam setiap percakapan.
- Jawab dengan bahasa Indonesia yang luwes, hangat, profesional, dan tidak kaku.
- Gunakan data konkret dari konteks yang diberikan. DILARANG keras mengarang angka atau nama yang tidak ada di data.
- Jika data tidak tersedia untuk menjawab pertanyaan, katakan dengan jujur "Saya tidak menemukan data tersebut di sistem."
- Format jawaban rapi menggunakan Markdown (heading ##, bold **teks**, bullet - item).
- Jawaban singkat namun padat untuk pertanyaan sederhana, dan komprehensif untuk pertanyaan analitik.
- Selalu akhiri dengan 1-2 langkah aksi konkret yang bisa langsung dieksekusi pemilik.
`.trim()

function buildChatContextBlock(ctx: any): string {
  const fmt = (n: number) => `Rp ${n.toLocaleString('id-ID')}`

  let block = `
=== DATA BISNIS REAL-TIME DARI DATABASE ===
Pemilik: ${ctx.owner_name || 'Pemilik'}
Periode: ${ctx.period_start} s/d ${ctx.period_end}

RINGKASAN KEUANGAN:
- Omzet: ${fmt(ctx.revenue)}
- HPP: ${fmt(ctx.cogs)}
- Laba Kotor: ${fmt(ctx.gross_profit)} (${ctx.gross_margin}%)
- Biaya Operasional: ${fmt(ctx.opex)}
- Laba Bersih: ${fmt(ctx.net_profit)} (${ctx.net_margin}%)
- Nilai Stok: ${fmt(ctx.inventory)}
- Piutang pelanggan belum lunas: ${fmt(ctx.receivables)}
- Hutang supplier belum lunas: ${fmt(ctx.payables)}
`.trim()

  if (ctx.payable_list && ctx.payable_list.length > 0) {
    block += '\n\nRINCIAN HUTANG KE SUPPLIER / VENDOR:\n'
    ctx.payable_list.forEach((r: any, i: number) => {
      const overdue = r.due_date && new Date(r.due_date) < new Date() ? ' [LEWAT JATUH TEMPO]' : ''
      block += `${i + 1}. ${r.supplier_name || 'Supplier'} | Tanggal: ${r.created_at?.split('T')[0]} | Jatuh Tempo: ${r.due_date || '-'}${overdue} | Sisa: ${fmt(r.remaining_amount)}\n`
    })
  }

  if (ctx.receivable_list && ctx.receivable_list.length > 0) {
    block += '\n\nPIUTANG PELANGGAN:\n'
    ctx.receivable_list.forEach((r: any, i: number) => {
      block += `${i + 1}. Piutang umum | Jatuh Tempo: ${r.due_date || '-'} | Sisa: ${fmt(r.remaining_amount)}\n`
    })
  }

  if (ctx.expense_list && ctx.expense_list.length > 0) {
    block += '\nRINCIAN PENGELUARAN OPERASIONAL:\n'
    ctx.expense_list.forEach((e: any, i: number) => {
      block += `${i + 1}. ${e.expense_date} | ${e.category_name || 'Umum'} | ${e.description} | ${fmt(e.amount)}\n`
    })
  }

  if (ctx.product_list && ctx.product_list.length > 0) {
    block += '\nSTATUS STOK PRODUK:\n'
    ctx.product_list.slice(0, 8).forEach((p: any) => {
      const warn = p.stock <= p.min_stock ? ' ⚠️ STOK MENIPIS' : ''
      block += `- ${p.name}: Stok ${p.stock}/${p.min_stock}${warn} | Modal ${fmt(p.buy_price)} | Jual ${fmt(p.sell_price)}\n`
    })
  }

  block += '\n=== AKHIR DATA DATABASE ==='
  return block
}

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

    const now = new Date()
    const dateParts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now)
    const year = Number(dateParts.find(part => part.type === 'year')?.value)
    const month = Number(dateParts.find(part => part.type === 'month')?.value)
    const day = Number(dateParts.find(part => part.type === 'day')?.value)
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const today = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const startTimestamp = new Date(`${startDate}T00:00:00+07:00`).toISOString()
    const nextMonth = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10)
    const nextMonthTimestamp = new Date(`${nextMonth}T00:00:00+07:00`).toISOString()

    const [salesRes, expensesRes, receivablesRes, payablesRes, productsRes] = await Promise.all([
      supabase.from('sales').select('final_amount, sale_items(quantity, buy_price)').eq('status', 'completed').gte('created_at', startTimestamp).lt('created_at', nextMonthTimestamp),
      supabase.from('expenses').select('amount, description, expense_date, expense_categories(name)').gte('expense_date', startDate).lt('expense_date', nextMonth).order('expense_date', { ascending: false }).limit(100),
      supabase.from('receivables').select('total_amount, paid_amount, due_date, created_at, note').neq('status', 'paid').order('created_at', { ascending: false }),
      supabase.from('supplier_payables').select('supplier_name, due_date, created_at, total_amount, paid_amount').neq('status', 'paid').order('created_at', { ascending: false }),
      supabase.from('products').select('name, stock, min_stock, buy_price, sell_price').eq('is_active', true),
    ])
    const queryError = [salesRes.error, expensesRes.error, receivablesRes.error, payablesRes.error, productsRes.error].find(Boolean)
    if (queryError) throw queryError

    const sales = salesRes.data || []
    const expenses = expensesRes.data || []
    const receivables = receivablesRes.data || []
    const payables = payablesRes.data || []
    const products = productsRes.data || []

    let revenue = 0, cogs = 0
    sales.forEach((s: any) => {
      revenue += s.final_amount || 0
      ;(s.sale_items || []).forEach((item: any) => { cogs += (item.quantity || 0) * (item.buy_price || 0) })
    })
    const opex = expenses.reduce((sum: number, e: any) => sum + (e.amount || 0), 0)
    const grossProfit = revenue - cogs
    const netProfit = grossProfit - opex
    const inventory = products.reduce((sum: number, p: any) => sum + (Math.max(0, p.stock || 0) * (p.buy_price || 0)), 0)
    const totalReceivables = receivables.reduce((sum: number, r: any) => sum + (r.total_amount - r.paid_amount), 0)
    const totalPayables = payables.reduce((sum: number, r: any) => sum + (r.total_amount - r.paid_amount), 0)
    const ctx = {
      owner_name: profile.full_name || 'Pemilik',
      period_start: startDate,
      period_end: today,
      revenue,
      cogs,
      gross_profit: grossProfit,
      gross_margin: revenue > 0 ? ((grossProfit / revenue) * 100).toFixed(1) : '38.2',
      opex,
      net_profit: netProfit,
      net_margin: revenue > 0 ? ((netProfit / revenue) * 100).toFixed(1) : '25.5',
      inventory,
      receivables: totalReceivables,
      payables: totalPayables,
      receivable_list: receivables.map((r: any) => ({
        remaining_amount: r.total_amount - r.paid_amount,
        due_date: r.due_date,
      })),
      payable_list: payables.map((r: any) => ({
        supplier_name: r.supplier_name,
        remaining_amount: r.total_amount - r.paid_amount,
        due_date: r.due_date,
        created_at: r.created_at,
      })),
      expense_list: expenses.map((e: any) => ({
        description: e.description,
        category_name: (e.expense_categories as any)?.name || 'Umum',
        amount: e.amount,
        expense_date: e.expense_date,
      })),
      product_list: products,
    }
    if (revenue === 0) {
      ctx.gross_margin = '0'
      ctx.net_margin = '0'
    }

    const contextBlock = buildChatContextBlock(ctx)
    const apiKey = process.env.GEMINI_API_KEY || process.env.AI_API_KEY

    if (!apiKey) {
      return NextResponse.json({ error: 'Layanan AI belum tersedia saat ini. Silakan coba lagi nanti.' }, { status: 503 })
    }

    // Build Gemini multi-turn contents
    // Inject context into the first user message
    const geminiContents = validMessages.map((msg, idx) => {
      let content = msg.content
      if (idx === 0 && msg.role === 'user') {
        content = `${contextBlock}\n\nPertanyaan saya: ${msg.content}`
      }
      return {
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: content }],
      }
    })

    const candidateModels = [
      'gemini-3.5-flash-lite',
      'gemini-flash-lite-latest',
      'gemini-3.5-flash',
      'gemini-3-flash-preview',
    ]

    for (const model of candidateModels) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: CHAT_SYSTEM_PROMPT }] },
            contents: geminiContents,
            generationConfig: { temperature: 0.5, maxOutputTokens: 2048 },
          }),
          signal: AbortSignal.timeout(12000),
        })

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}))
          console.warn(`Chat: model ${model} error:`, errData)
          continue
        }

        const result = await response.json()
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text

        if (text && text.trim().length > 0) {
          return NextResponse.json({ reply: text.trim(), model: 'FluxAI' })
        }
      } catch (err) {
        console.warn(`Chat: model ${model} threw:`, err)
        continue
      }
    }

    return NextResponse.json({ error: 'Layanan AI saat ini tidak tersedia. Coba lagi nanti.' }, { status: 503 })

  } catch (err: any) {
    console.error('Chat AI route error:', err)
    return NextResponse.json({ error: 'Layanan AI belum dapat memproses permintaan. Silakan coba lagi.' }, { status: 500 })
  }
}
