/**
 * intelligence/ai/chat.ts
 * AI Chat Advisor (FluxAI) untuk konsultasi bisnis & keuangan UMKM.
 */

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface BusinessChatPayableItem {
  supplier_name?: string;
  remaining_amount: number;
  due_date?: string | null;
  created_at?: string | null;
}

export interface BusinessChatReceivableItem {
  remaining_amount: number;
  due_date?: string | null;
}

export interface BusinessChatExpenseItem {
  description: string;
  category_name?: string;
  amount: number;
  expense_date: string;
}

export interface BusinessChatProductItem {
  name: string;
  stock: number;
  min_stock: number;
  buy_price: number;
  sell_price: number;
}

export interface BusinessChatContext {
  owner_name: string;
  period_start: string;
  period_end: string;
  revenue: number;
  cogs: number;
  gross_profit: number;
  gross_margin: string;
  opex: number;
  net_profit: number;
  net_margin: string;
  inventory: number;
  receivables: number;
  payables: number;
  payable_list?: BusinessChatPayableItem[];
  receivable_list?: BusinessChatReceivableItem[];
  expense_list?: BusinessChatExpenseItem[];
  product_list?: BusinessChatProductItem[];
}

export const CHAT_SYSTEM_PROMPT = `
Anda adalah "FluxAI", asisten bisnis cerdas dan konsultan keuangan eksekutif untuk pemilik UMKM Indonesia.

Konteks & Persona:
- Anda memiliki akses lengkap ke data keuangan riil toko (omzet, laba, piutang, stok, pengeluaran) yang disertakan dalam setiap percakapan.
- Jawab dengan bahasa Indonesia yang luwes, hangat, profesional, dan tidak kaku.
- Gunakan data konkret dari konteks yang diberikan. DILARANG keras mengarang angka atau nama yang tidak ada di data.
- Jika data tidak tersedia untuk menjawab pertanyaan, katakan dengan jujur "Saya tidak menemukan data tersebut di sistem."
- Format jawaban rapi menggunakan Markdown (heading ##, bold **teks**, bullet - item).
- Jawaban singkat namun padat untuk pertanyaan sederhana, dan komprehensif untuk pertanyaan analitik.
- Selalu akhiri dengan 1-2 langkah aksi konkret yang bisa langsung dieksekusi pemilik.
`.trim();

export function buildChatContextBlock(ctx: BusinessChatContext): string {
  const fmt = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

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
`.trim();

  if (ctx.payable_list && ctx.payable_list.length > 0) {
    block += '\n\nRINCIAN HUTANG KE SUPPLIER / VENDOR:\n';
    ctx.payable_list.forEach((r, i) => {
      const overdue = r.due_date && new Date(r.due_date) < new Date() ? ' [LEWAT JATUH TEMPO]' : '';
      block += `${i + 1}. ${r.supplier_name || 'Supplier'} | Tanggal: ${r.created_at?.split('T')[0]} | Jatuh Tempo: ${r.due_date || '-'}${overdue} | Sisa: ${fmt(r.remaining_amount)}\n`;
    });
  }

  if (ctx.receivable_list && ctx.receivable_list.length > 0) {
    block += '\n\nPIUTANG PELANGGAN:\n';
    ctx.receivable_list.forEach((r, i) => {
      block += `${i + 1}. Piutang umum | Jatuh Tempo: ${r.due_date || '-'} | Sisa: ${fmt(r.remaining_amount)}\n`;
    });
  }

  if (ctx.expense_list && ctx.expense_list.length > 0) {
    block += '\nRINCIAN PENGELUARAN OPERASIONAL:\n';
    ctx.expense_list.forEach((e, i) => {
      block += `${i + 1}. ${e.expense_date} | ${e.category_name || 'Umum'} | ${e.description} | ${fmt(e.amount)}\n`;
    });
  }

  if (ctx.product_list && ctx.product_list.length > 0) {
    block += '\nSTATUS STOK PRODUK:\n';
    ctx.product_list.slice(0, 8).forEach((p) => {
      const warn = p.stock <= p.min_stock ? ' ⚠️ STOK MENIPIS' : '';
      block += `- ${p.name}: Stok ${p.stock}/${p.min_stock}${warn} | Modal ${fmt(p.buy_price)} | Jual ${fmt(p.sell_price)}\n`;
    });
  }

  block += '\n=== AKHIR DATA DATABASE ===';
  return block;
}

export interface AiChatReplyResult {
  reply: string;
  model: string;
}

export async function generateAiChatReply(
  messages: ChatMessage[],
  contextBlock: string,
  customApiKey?: string
): Promise<AiChatReplyResult> {
  const apiKey = customApiKey || process.env.GEMINI_API_KEY || process.env.AI_API_KEY;

  if (!apiKey) {
    throw new Error('Layanan AI belum tersedia saat ini. Silakan coba lagi nanti.');
  }

  // Inject context into the first user message
  const geminiContents = messages.map((msg, idx) => {
    let content = msg.content;
    if (idx === 0 && msg.role === 'user') {
      content = `${contextBlock}\n\nPertanyaan saya: ${msg.content}`;
    }
    return {
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: content }],
    };
  });

  const candidateModels = [
    'gemini-3.5-flash-lite',
    'gemini-flash-lite-latest',
    'gemini-3.5-flash',
    'gemini-3-flash-preview',
  ];

  for (const model of candidateModels) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: CHAT_SYSTEM_PROMPT }] },
          contents: geminiContents,
          generationConfig: { temperature: 0.5, maxOutputTokens: 2048 },
        }),
        signal: AbortSignal.timeout(12000),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        console.warn(`Chat: model ${model} error:`, errData);
        continue;
      }

      const result = await response.json();
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text;

      if (text && text.trim().length > 0) {
        return { reply: text.trim(), model: 'FluxAI' };
      }
    } catch (err) {
      console.warn(`Chat: model ${model} threw:`, err);
      continue;
    }
  }

  throw new Error('Layanan AI saat ini tidak tersedia. Coba lagi nanti.');
}
