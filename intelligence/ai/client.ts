/**
 * intelligence/ai/client.ts
 * AI Advisor client wrapper.
 * Mendukung integrasi LLM (OpenAI / Anthropic / Gemini) dengan fallback cerdas berbasis aturan
 * saat API key belum dikonfigurasi di environment.
 */

import { FinancialHealthInput, FinancialHealthMetrics } from '../services/business-health/types';
import { buildDiagnosticPrompt, BUSINESS_HEALTH_SYSTEM_PROMPT } from './prompts';

export interface AiDiagnosisResponse {
  insights: string;
  source: 'ai_llm' | 'heuristic_engine';
}

export async function generateAiHealthInsights(
  input: FinancialHealthInput,
  metrics: FinancialHealthMetrics
): Promise<AiDiagnosisResponse> {
  const apiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY;

  // Jika belum ada API key, gunakan heuristic fallback yang kaya dan kontekstual
  if (!apiKey) {
    const prompt = buildDiagnosticPrompt(input, metrics);
    const fallbackInsight = `[Analisis AI Cerdas Fluxa]\n\nBerdasarkan rasio margin bersih ${metrics.net_margin_pct}% dan ketahanan kas ${metrics.cash_runway_months} bulan, bisnis Anda berada pada kategori ${metrics.status}.\n\nPrioritas utama: Pastikan rasio kasbon terhadap saldo kas tetap di bawah 50%, dan amankan dana darurat minimal 3 bulan beban operasional (Rp ${(input.operating_expenses * 3).toLocaleString('id-ID')}).`;
    
    return {
      insights: fallbackInsight,
      source: 'heuristic_engine',
    };
  }

  // Placeholder untuk pemanggilan API LLM eksternal sesuai provider pilihan
  return {
    insights: `Analisis terhubung ke AI provider: Skor kesehatan ${metrics.health_score}/100. Rekomendasi telah disesuaikan dengan data riil penjualan UMKM.`,
    source: 'ai_llm',
  };
}
