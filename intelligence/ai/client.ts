/**
 * intelligence/ai/client.ts
 * AI Advisor client wrapper.
 * Menghubungkan data transaksi & rasio finansial riil ke Google Gemini AI asli.
 */

import { FinancialHealthInput, FinancialHealthMetrics } from '../services/business-health/types';
import { buildDiagnosticPrompt, BUSINESS_HEALTH_SYSTEM_PROMPT } from './prompts';

export interface AiDiagnosisResponse {
  insights: string;
  source: 'ai_llm' | 'heuristic_engine';
  model?: string;
  error?: string;
}

export async function generateAiHealthInsights(
  input: FinancialHealthInput,
  metrics: FinancialHealthMetrics,
  customApiKey?: string
): Promise<AiDiagnosisResponse> {
  const apiKey = customApiKey || process.env.GEMINI_API_KEY || process.env.AI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  const prompt = buildDiagnosticPrompt(input, metrics);

  if (apiKey) {
    const candidateModels = [
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-1.5-flash',
      'gemini-2.5-pro',
      'gemini-3.5-flash-lite',
      'gemini-3.5-flash'
    ];
    let lastError: any = null;

    for (const model of candidateModels) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`;

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            system_instruction: {
              parts: [{ text: BUSINESS_HEALTH_SYSTEM_PROMPT }],
            },
            contents: [
              {
                role: 'user',
                parts: [{ text: prompt }],
              },
            ],
            generationConfig: {
              temperature: 0.4,
              maxOutputTokens: 4096,
            },
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.warn(`Gemini API ${model} returned error:`, errorData);
          lastError = new Error(errorData.error?.message || `HTTP ${response.status}`);
          continue; // coba model berikutnya
        }

        const result = await response.json();
        const generatedText = result.candidates?.[0]?.content?.parts?.[0]?.text;

        if (generatedText && generatedText.trim().length > 0) {
          return {
            insights: generatedText.trim(),
            source: 'ai_llm',
            model: `Google ${model} (Live API)`,
          };
        }
      } catch (err: any) {
        lastError = err;
        continue;
      }
    }

    console.warn('All Gemini candidate models failed:', lastError?.message);
    return {
      insights: generateDeterministicNarrative(input, metrics),
      source: 'heuristic_engine',
      error: `Gemini API: ${lastError?.message || 'Gagal memanggil model'}. Menampilkan analisis rasio akuntansi deterministik.`,
    };
  }

  // Jika API Key belum diatur di env atau parameter
  return {
    insights: generateDeterministicNarrative(input, metrics),
    source: 'heuristic_engine',
  };
}

function generateDeterministicNarrative(input: FinancialHealthInput, metrics: FinancialHealthMetrics): string {
  const statusLabel = metrics.status === 'SEHAT' ? 'zona sehat dan stabil' : metrics.status === 'WASPADA' ? 'zona waspada' : 'zona krisis likuiditas';

  const marginNote = metrics.net_margin_pct >= 15
    ? `Profitabilitas bisnis solid dengan margin bersih ${metrics.net_margin_pct}% (Laba Bersih Rp ${metrics.net_profit.toLocaleString('id-ID')}).`
    : `Margin bersih tercatat ${metrics.net_margin_pct}% — tergolong tipis untuk menghadapi fluktuasi biaya operasional.`;

  const cashNote = metrics.cash_runway_months >= 3
    ? `Cadangan kas riil Rp ${input.cash_on_hand.toLocaleString('id-ID')} mencukupi untuk operasional ${metrics.cash_runway_months} bulan ke depan.`
    : `Peringatan kas: Cadangan kas hanya bertahan ${metrics.cash_runway_months} bulan tanpa adanya omzet masuk.`;

  const debtNote = input.receivables > input.cash_on_hand
    ? `Perhatian piutang: Kasbon pelanggan (Rp ${input.receivables.toLocaleString('id-ID')}) melampaui kas fisik yang tersedia.`
    : `Rasio piutang pelanggan terkendali di bawah saldo kas aktif.`;

  return `Berdasarkan data pembukuan & transaksi riil dari sistem kasir, bisnis Anda saat ini berada di **${statusLabel}** dengan skor komposit **${metrics.health_score}/100**.

**Temuan Utama Kondisi Keuangan:**
- ${marginNote}
- ${cashNote}
- ${debtNote}
- Aset persediaan produk di toko bernilai Rp ${input.inventory_value.toLocaleString('id-ID')}.

**Rekomendasi Rencana Aksi Minggu Ini:**
1. **Amankan Kas:** ${metrics.cash_runway_months < 3 ? 'Prioritaskan penagihan piutang kasbon jatuh tempo untuk menambah likuiditas darurat.' : 'Alokasikan 15% dari keuntungan ke rekening dana darurat bisnis.'}
2. **Efisiensi Beban:** Evaluasi pos beban operasional (Rp ${input.operating_expenses.toLocaleString('id-ID')}) untuk memangkas pengeluaran yang tidak mendukung omzet.
3. **Optimasi Stok:** Pastikan tidak ada penumpukan barang lambat laku (slow-moving) agar modal kerja tidak mengendap di gudang.`;
}
